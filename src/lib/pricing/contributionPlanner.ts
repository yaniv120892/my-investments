import { AssetClass } from "@prisma/client";
import {
  TOTAL_TARGET_PERCENT,
  isTargetSumBalanced,
  sumTargetPercent,
} from "@/lib/targets/targetPercentRules";
import type {
  ClassAllocation,
  ClassTarget,
  ContributionPlan,
  ContributionPlanRefusal,
  ContributionPlanRequest,
  ContributionRefusalReason,
  DroppedAllocation,
  HoldingAllocation,
  InvestableHolding,
} from "@/lib/pricing/contributionPlanner.types";

export type {
  ClassAllocation,
  ClassTarget,
  ContributionPlan,
  ContributionPlanAccepted,
  ContributionPlanRefusal,
  ContributionPlanRequest,
  ContributionRefusalReason,
  DroppedAllocation,
  HoldingAllocation,
  InvestableHolding,
} from "@/lib/pricing/contributionPlanner.types";

const ASSET_CLASS_SORT_INDEX = {
  [AssetClass.EQUITY]: 0,
  [AssetClass.CRYPTO]: 1,
  [AssetClass.NON_EQUITY]: 2,
} satisfies Record<AssetClass, number>;

interface FundableClass {
  assetClass: AssetClass;
  targetPercent: number;
  currentValueNis: number;
}

type WeightedHolding = InvestableHolding & { withinClassWeight: number };

export function planContribution(
  request: ContributionPlanRequest
): ContributionPlan {
  const refusal = findRefusal(request);
  if (refusal) {
    return refusal;
  }

  const excludedHoldingIds = new Set(request.excludedHoldingIds);
  const requestedClasses = includedAssetClasses(request);
  const requestedHoldings = request.investableHoldings.filter((holding) =>
    requestedClasses.has(holding.assetClass)
  );

  // Excluding a class's only holding is a narrower instruction than "this class
  // has nowhere to put money". Deciding that here keeps the two apart: a class
  // whose candidates were all excluded drops out like an excluded class, and
  // only a class with no weighted holding at all refuses the plan.
  const fundableClasses = new Set<AssetClass>();
  for (const target of request.classTargets) {
    if (!requestedClasses.has(target.assetClass) || target.targetPercent <= 0) {
      continue;
    }
    const weighted = requestedHoldings.filter(
      (holding): holding is WeightedHolding =>
        holding.assetClass === target.assetClass &&
        holding.withinClassWeight !== null &&
        holding.withinClassWeight > 0
    );
    if (weighted.length === 0) {
      return refuse(
        "CLASS_HAS_NO_WEIGHTED_HOLDING",
        `${target.assetClass} has a target but no liquid holding with a within-class weight, so there is nowhere to put its share. Set a weight on at least one ${target.assetClass} holding.`
      );
    }
    const hasCandidate = weighted.some(
      (holding) => !excludedHoldingIds.has(holding.holdingId)
    );
    if (hasCandidate) {
      fundableClasses.add(target.assetClass);
    }
  }

  const includedClasses = new Set(
    [...requestedClasses].filter(
      (assetClass) =>
        fundableClasses.has(assetClass) ||
        !hasPositiveTarget(request, assetClass)
    )
  );
  const includedHoldings = requestedHoldings.filter((holding) =>
    includedClasses.has(holding.assetClass)
  );
  const currentValueByClass = sumValueByClass(includedHoldings);
  const investableValueNis = includedHoldings.reduce(
    (total, holding) => total + holding.valueInNis,
    0
  );
  const targetByClass = renormalizeTargets(
    request.classTargets.filter((target) =>
      includedClasses.has(target.assetClass)
    )
  );

  const dropped: DroppedAllocation[] = [];
  const classContributions = allocateAcrossClasses(
    buildFundableClasses(targetByClass, currentValueByClass),
    request.contributionNis,
    request.minimumTicketNis,
    dropped
  );

  if (classContributions.size === 0) {
    return refuse(
      "CONTRIBUTION_BELOW_MINIMUM_TICKET",
      `No asset class can receive at least ${request.minimumTicketNis} NIS from a contribution of ${request.contributionNis} NIS.`
    );
  }

  const byHolding: HoldingAllocation[] = [];

  for (const [assetClass, amountNis] of classContributions) {
    if (amountNis <= 0) {
      continue;
    }
    const candidates = includedHoldings.filter(
      (holding): holding is WeightedHolding =>
        holding.assetClass === assetClass &&
        !excludedHoldingIds.has(holding.holdingId) &&
        holding.withinClassWeight !== null &&
        holding.withinClassWeight > 0
    );
    byHolding.push(
      ...splitWithinClass(
        candidates,
        amountNis,
        request.minimumTicketNis,
        dropped
      )
    );
  }

  return {
    status: "planned",
    contributionNis: request.contributionNis,
    investableValueNis,
    byAssetClass: buildClassAllocations(
      targetByClass,
      currentValueByClass,
      classContributions,
      investableValueNis,
      request.contributionNis
    ),
    byHolding: sortHoldingAllocations(byHolding),
    dropped,
  };
}

function findRefusal(
  request: ContributionPlanRequest
): ContributionPlanRefusal | null {
  assertPlannableAmount("contributionNis", request.contributionNis);
  assertPlannableAmount("minimumTicketNis", request.minimumTicketNis);

  if (request.totalValueNis === null) {
    return refuse(
      "PRICING_INCOMPLETE",
      "The portfolio could not be priced in full, so a contribution plan would be built on partial data. Fix the pricing failures first."
    );
  }

  if (request.classTargets.length === 0) {
    return refuse(
      "NO_TARGETS_SET",
      "No asset class targets are stored, so there is nothing to aim at. Set them on the Advisor page first."
    );
  }

  // Not a refusal: `targetWriteValidator` is the only path by which targets are
  // stored and it rejects an unbalanced set, so reaching here means a caller
  // skipped that boundary — exactly the caller that needs telling.
  const negative = request.classTargets.find(
    (target) => target.targetPercent < 0
  );
  if (negative) {
    throw new Error(
      `Stored asset class target is negative (assetClass: ${negative.assetClass}, target: ${negative.targetPercent})`
    );
  }

  const targetSum = sumTargetPercent(request.classTargets);
  if (!isTargetSumBalanced(targetSum)) {
    throw new Error(
      `Stored asset class targets sum to ${targetSum}, not ${TOTAL_TARGET_PERCENT} (classTargets: ${JSON.stringify(
        request.classTargets
      )})`
    );
  }

  const includedClasses = includedAssetClasses(request);
  const hasFundableClass = request.classTargets.some(
    (target) =>
      includedClasses.has(target.assetClass) && target.targetPercent > 0
  );
  if (!hasFundableClass) {
    return refuse(
      "NO_INVESTABLE_CLASS",
      "Every asset class with a positive target was excluded, so there is nothing to allocate to."
    );
  }

  return null;
}

/**
 * Water-filling: raise a common level L, where allocation(c) = L*target(c) - value(c),
 * until the money runs out. Filling the most underweight class first, exact-to-target
 * once the money suffices, and spreading any remainder by target weight are all the
 * same sweep at different budgets — none of them is a special case.
 */
function allocateAcrossClasses(
  fundableClasses: FundableClass[],
  contributionNis: number,
  minimumTicketNis: number,
  dropped: DroppedAllocation[]
): Map<AssetClass, number> {
  const unfundable = new Set<AssetClass>();

  for (;;) {
    const candidates = fundableClasses.filter(
      (fundable) => !unfundable.has(fundable.assetClass)
    );
    if (candidates.length === 0) {
      return new Map();
    }

    const amounts = waterFill(candidates, contributionNis);
    const smallest = smallestBelowTicket(amounts, minimumTicketNis);
    if (smallest === null) {
      return amounts;
    }

    unfundable.add(smallest.assetClass);
    dropped.push({
      scope: "assetClass",
      label: smallest.assetClass,
      amountNis: smallest.amountNis,
      reason: "BELOW_MINIMUM_TICKET",
    });
  }
}

function waterFill(
  candidates: FundableClass[],
  contributionNis: number
): Map<AssetClass, number> {
  const ascendingByFill = [...candidates].sort(
    (a, b) =>
      a.currentValueNis / a.targetPercent - b.currentValueNis / b.targetPercent
  );

  let level =
    ascendingByFill[0].currentValueNis / ascendingByFill[0].targetPercent;
  let remaining = contributionNis;
  let activeTargetSum = 0;

  for (let index = 0; index < ascendingByFill.length; index += 1) {
    activeTargetSum += ascendingByFill[index].targetPercent;

    const next = ascendingByFill[index + 1];
    const nextLevel = next
      ? next.currentValueNis / next.targetPercent
      : Number.POSITIVE_INFINITY;
    const costToNextLevel = (nextLevel - level) * activeTargetSum;

    if (remaining <= costToNextLevel) {
      level += remaining / activeTargetSum;
      break;
    }

    remaining -= costToNextLevel;
    level = nextLevel;
  }

  if (!Number.isFinite(level)) {
    throw new Error(
      `Water level never settled for a contribution of ${contributionNis}`
    );
  }

  const amounts = new Map<AssetClass, number>();
  for (const candidate of candidates) {
    amounts.set(
      candidate.assetClass,
      Math.max(0, level * candidate.targetPercent - candidate.currentValueNis)
    );
  }
  return amounts;
}

function splitWithinClass(
  candidates: WeightedHolding[],
  amountNis: number,
  minimumTicketNis: number,
  dropped: DroppedAllocation[]
): HoldingAllocation[] {
  if (amountNis < minimumTicketNis) {
    throw new Error(
      `Class amount ${amountNis} is below the minimum ticket ${minimumTicketNis}; allocateAcrossClasses should have dropped it`
    );
  }
  let survivors = [...candidates];

  for (;;) {
    const weightSum = survivors.reduce(
      (total, holding) => total + holding.withinClassWeight,
      0
    );
    const allocations = survivors.map((holding) => ({
      holdingId: holding.holdingId,
      assetName: holding.assetName,
      assetClass: holding.assetClass,
      platformName: holding.platformName,
      contributionNis: (amountNis * holding.withinClassWeight) / weightSum,
    }));

    if (survivors.length === 1) {
      return allocations;
    }

    const smallest = allocations.reduce((lowest, allocation) => {
      if (allocation.contributionNis !== lowest.contributionNis) {
        return allocation.contributionNis < lowest.contributionNis
          ? allocation
          : lowest;
      }
      return allocation.holdingId < lowest.holdingId ? allocation : lowest;
    });
    if (smallest.contributionNis >= minimumTicketNis) {
      return allocations;
    }

    dropped.push({
      scope: "holding",
      label: smallest.assetName,
      amountNis: smallest.contributionNis,
      reason: "BELOW_MINIMUM_TICKET",
    });
    survivors = survivors.filter(
      (holding) => holding.holdingId !== smallest.holdingId
    );
  }
}

function buildClassAllocations(
  targetByClass: Map<AssetClass, number>,
  currentValueByClass: Map<AssetClass, number>,
  classContributions: Map<AssetClass, number>,
  investableValueNis: number,
  contributionNis: number
): ClassAllocation[] {
  const valueAfter = investableValueNis + contributionNis;

  return [...targetByClass.entries()]
    .map(([assetClass, targetPercent]) => {
      const currentValueNis = currentValueByClass.get(assetClass) ?? 0;
      const contribution = classContributions.get(assetClass) ?? 0;

      return {
        assetClass,
        currentValueNis,
        currentPercent: percentOf(currentValueNis, investableValueNis),
        targetPercent,
        contributionNis: contribution,
        percentAfter: percentOf(currentValueNis + contribution, valueAfter),
      };
    })
    .sort(
      (a, b) =>
        ASSET_CLASS_SORT_INDEX[a.assetClass] -
        ASSET_CLASS_SORT_INDEX[b.assetClass]
    );
}

function buildFundableClasses(
  targetByClass: Map<AssetClass, number>,
  currentValueByClass: Map<AssetClass, number>
): FundableClass[] {
  return [...targetByClass.entries()]
    .filter(([, targetPercent]) => targetPercent > 0)
    .map(([assetClass, targetPercent]) => ({
      assetClass,
      targetPercent,
      currentValueNis: currentValueByClass.get(assetClass) ?? 0,
    }));
}

/**
 * Display only. Water-filling is scale-invariant — scaling every target by k
 * scales every fill ratio by 1/k and the solved level back by k — so this
 * changes no allocation. It exists so an excluded class does not leave the
 * remaining targets summing to less than 100 in the rendered table.
 */
function renormalizeTargets(targets: ClassTarget[]): Map<AssetClass, number> {
  const targetSum = sumTargetPercent(targets);
  const renormalized = new Map<AssetClass, number>();

  for (const target of targets) {
    renormalized.set(
      target.assetClass,
      targetSum > 0
        ? (target.targetPercent / targetSum) * TOTAL_TARGET_PERCENT
        : 0
    );
  }
  return renormalized;
}

function includedAssetClasses(
  request: ContributionPlanRequest
): Set<AssetClass> {
  const excluded = new Set(request.excludedAssetClasses);
  return new Set(
    request.classTargets
      .map((target) => target.assetClass)
      .filter((assetClass) => !excluded.has(assetClass))
  );
}

function sumValueByClass(
  holdings: InvestableHolding[]
): Map<AssetClass, number> {
  const totals = new Map<AssetClass, number>();
  for (const holding of holdings) {
    totals.set(
      holding.assetClass,
      (totals.get(holding.assetClass) ?? 0) + holding.valueInNis
    );
  }
  return totals;
}

function smallestBelowTicket(
  amounts: Map<AssetClass, number>,
  minimumTicketNis: number
): { assetClass: AssetClass; amountNis: number } | null {
  let smallest: { assetClass: AssetClass; amountNis: number } | null = null;

  for (const [assetClass, amountNis] of amounts) {
    const isUnderfunded = amountNis > 0 && amountNis < minimumTicketNis;
    if (
      isUnderfunded &&
      (smallest === null || amountNis < smallest.amountNis)
    ) {
      smallest = { assetClass, amountNis };
    }
  }
  return smallest;
}

function sortHoldingAllocations(
  allocations: HoldingAllocation[]
): HoldingAllocation[] {
  return [...allocations].sort((a, b) => {
    const byClass =
      ASSET_CLASS_SORT_INDEX[a.assetClass] -
      ASSET_CLASS_SORT_INDEX[b.assetClass];
    if (byClass !== 0) {
      return byClass;
    }
    if (b.contributionNis !== a.contributionNis) {
      return b.contributionNis - a.contributionNis;
    }
    return a.holdingId.localeCompare(b.holdingId);
  });
}

function percentOf(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return (value / total) * TOTAL_TARGET_PERCENT;
}

function refuse(
  reason: ContributionRefusalReason,
  explanation: string
): ContributionPlanRefusal {
  return { status: "refused", reason, explanation };
}

function assertPlannableAmount(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `${name} must be a finite, non-negative number (${name}: ${value})`
    );
  }
}

function hasPositiveTarget(
  request: ContributionPlanRequest,
  assetClass: AssetClass
): boolean {
  return request.classTargets.some(
    (target) => target.assetClass === assetClass && target.targetPercent > 0
  );
}
