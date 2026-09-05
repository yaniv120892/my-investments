import { describe, expect, it } from "vitest";
import { AssetClass } from "@prisma/client";
import { planContribution } from "@/lib/pricing/contributionPlanner";
import type {
  ClassTarget,
  ContributionPlanAccepted,
  ContributionPlanRequest,
  InvestableHolding,
} from "@/lib/pricing/contributionPlanner";

const EQUITY_VALUE_NIS = 1_364_219;
const CRYPTO_VALUE_NIS = 109_966;
const NON_EQUITY_VALUE_NIS = 100_000;
const INVESTABLE_VALUE_NIS =
  EQUITY_VALUE_NIS + CRYPTO_VALUE_NIS + NON_EQUITY_VALUE_NIS;

const BALANCED_TARGETS: ClassTarget[] = [
  { assetClass: AssetClass.EQUITY, targetPercent: 70 },
  { assetClass: AssetClass.CRYPTO, targetPercent: 10 },
  { assetClass: AssetClass.NON_EQUITY, targetPercent: 20 },
];

function buildHolding(
  holdingId: string,
  assetClass: AssetClass,
  valueInNis: number,
  withinClassWeight: number | null = 1
): InvestableHolding {
  return {
    holdingId,
    assetName: `${holdingId} asset`,
    assetClass,
    platformName: "Test platform",
    valueInNis,
    withinClassWeight,
  };
}

const REAL_PORTFOLIO: InvestableHolding[] = [
  buildHolding("equity", AssetClass.EQUITY, EQUITY_VALUE_NIS),
  buildHolding("crypto", AssetClass.CRYPTO, CRYPTO_VALUE_NIS),
  buildHolding("nonEquity", AssetClass.NON_EQUITY, NON_EQUITY_VALUE_NIS),
];

function buildRequest(
  overrides: Partial<ContributionPlanRequest> = {}
): ContributionPlanRequest {
  return {
    contributionNis: 10_000,
    investableHoldings: REAL_PORTFOLIO,
    classTargets: BALANCED_TARGETS,
    minimumTicketNis: 0,
    excludedAssetClasses: [],
    excludedHoldingIds: [],
    totalValueNis: INVESTABLE_VALUE_NIS,
    ...overrides,
  };
}

function planOrFail(
  overrides: Partial<ContributionPlanRequest> = {}
): ContributionPlanAccepted {
  const plan = planContribution(buildRequest(overrides));
  if (plan.status !== "planned") {
    throw new Error(`Expected a plan, got refusal: ${plan.reason}`);
  }
  return plan;
}

function classAmount(
  plan: ContributionPlanAccepted,
  assetClass: AssetClass
): number {
  const allocation = plan.byAssetClass.find(
    (candidate) => candidate.assetClass === assetClass
  );
  if (!allocation) {
    throw new Error(`No allocation for ${assetClass}`);
  }
  return allocation.contributionNis;
}

describe("planContribution", () => {
  it("refuses when pricing is incomplete, even though every holding has a value", () => {
    const plan = planContribution(buildRequest({ totalValueNis: null }));

    expect(plan.status).toBe("refused");
    if (plan.status !== "refused") {
      throw new Error("unreachable");
    }
    expect(plan.reason).toBe("PRICING_INCOMPLETE");
  });

  it("throws on unbalanced stored targets, which the write path cannot produce", () => {
    expect(() =>
      planContribution(
        buildRequest({
          classTargets: [
            { assetClass: AssetClass.EQUITY, targetPercent: 70 },
            { assetClass: AssetClass.CRYPTO, targetPercent: 10 },
            { assetClass: AssetClass.NON_EQUITY, targetPercent: 19.5 },
          ],
        })
      )
    ).toThrow("99.5");
  });

  it("refuses when no targets are stored at all", () => {
    const plan = planContribution(buildRequest({ classTargets: [] }));

    expect(plan.status).toBe("refused");
    if (plan.status !== "refused") {
      throw new Error("unreachable");
    }
    expect(plan.reason).toBe("NO_TARGETS_SET");
  });

  it("accepts a target sum within the rounding tolerance", () => {
    const plan = planOrFail({
      classTargets: [
        { assetClass: AssetClass.EQUITY, targetPercent: 70.005 },
        { assetClass: AssetClass.CRYPTO, targetPercent: 10 },
        { assetClass: AssetClass.NON_EQUITY, targetPercent: 20 },
      ],
    });

    expect(plan.status).toBe("planned");
  });

  it("sends a small contribution entirely to the most underweight class", () => {
    const plan = planOrFail({ contributionNis: 10_000 });

    expect(classAmount(plan, AssetClass.NON_EQUITY)).toBeCloseTo(10_000, 6);
    expect(classAmount(plan, AssetClass.CRYPTO)).toBe(0);
    expect(classAmount(plan, AssetClass.EQUITY)).toBe(0);
  });

  it("splits across the two most underweight classes past the first breakpoint", () => {
    const plan = planOrFail({ contributionNis: 200_000 });

    expect(classAmount(plan, AssetClass.NON_EQUITY)).toBeCloseTo(
      173_310.6667,
      3
    );
    expect(classAmount(plan, AssetClass.CRYPTO)).toBeCloseTo(26_689.3333, 3);
    expect(classAmount(plan, AssetClass.EQUITY)).toBe(0);
  });

  it("lands exactly on target when the contribution is large enough", () => {
    const plan = planOrFail({ contributionNis: 500_000 });

    expect(classAmount(plan, AssetClass.EQUITY)).toBeCloseTo(87_710.5, 6);
    expect(classAmount(plan, AssetClass.CRYPTO)).toBeCloseTo(97_452.5, 6);
    expect(classAmount(plan, AssetClass.NON_EQUITY)).toBeCloseTo(314_837, 6);

    for (const allocation of plan.byAssetClass) {
      expect(allocation.percentAfter).toBeCloseTo(allocation.targetPercent, 6);
    }
  });

  it("splits tied fill ratios in proportion to target, invariant to input order", () => {
    const tied: InvestableHolding[] = [
      buildHolding("equity", AssetClass.EQUITY, 400),
      buildHolding("crypto", AssetClass.CRYPTO, 200),
      buildHolding("nonEquity", AssetClass.NON_EQUITY, 4_000),
    ];
    const targets: ClassTarget[] = [
      { assetClass: AssetClass.EQUITY, targetPercent: 40 },
      { assetClass: AssetClass.CRYPTO, targetPercent: 20 },
      { assetClass: AssetClass.NON_EQUITY, targetPercent: 40 },
    ];
    const request = {
      investableHoldings: tied,
      classTargets: targets,
      contributionNis: 300,
      totalValueNis: 4_600,
    };

    const plan = planOrFail(request);
    const shuffled = planOrFail({
      ...request,
      investableHoldings: [tied[2], tied[0], tied[1]],
      classTargets: [targets[1], targets[2], targets[0]],
    });

    expect(classAmount(plan, AssetClass.EQUITY)).toBeCloseTo(200, 6);
    expect(classAmount(plan, AssetClass.CRYPTO)).toBeCloseTo(100, 6);
    expect(classAmount(plan, AssetClass.NON_EQUITY)).toBe(0);
    expect(shuffled.byAssetClass).toEqual(plan.byAssetClass);
  });

  it("orders classes by the enum, not by input or insertion order", () => {
    const plan = planOrFail({
      classTargets: [
        { assetClass: AssetClass.NON_EQUITY, targetPercent: 20 },
        { assetClass: AssetClass.CRYPTO, targetPercent: 10 },
        { assetClass: AssetClass.EQUITY, targetPercent: 70 },
      ],
    });

    expect(
      plan.byAssetClass.map((allocation) => allocation.assetClass)
    ).toEqual([AssetClass.EQUITY, AssetClass.CRYPTO, AssetClass.NON_EQUITY]);
  });

  it("never allocates a negative amount and always spends the whole contribution", () => {
    for (const contributionNis of [1, 10_000, 200_000, 500_000, 5_000_000]) {
      const plan = planOrFail({ contributionNis });
      const total = plan.byAssetClass.reduce(
        (sum, allocation) => sum + allocation.contributionNis,
        0
      );

      expect(total).toBeCloseTo(contributionNis, 6);
      for (const allocation of plan.byAssetClass) {
        expect(allocation.contributionNis).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("splits a class across its holdings by normalized within-class weight", () => {
    const plan = planOrFail({
      contributionNis: 10_000,
      investableHoldings: [
        buildHolding("equity", AssetClass.EQUITY, EQUITY_VALUE_NIS),
        buildHolding("crypto", AssetClass.CRYPTO, CRYPTO_VALUE_NIS),
        buildHolding("nonEquityA", AssetClass.NON_EQUITY, 50_000, 2),
        buildHolding("nonEquityB", AssetClass.NON_EQUITY, 25_000, 1),
        buildHolding("nonEquityC", AssetClass.NON_EQUITY, 25_000, 1),
      ],
    });

    const amountById = new Map(
      plan.byHolding.map((allocation) => [
        allocation.holdingId,
        allocation.contributionNis,
      ])
    );
    expect(amountById.get("nonEquityA")).toBeCloseTo(5_000, 6);
    expect(amountById.get("nonEquityB")).toBeCloseTo(2_500, 6);
    expect(amountById.get("nonEquityC")).toBeCloseTo(2_500, 6);
  });

  it("gives nothing to a holding with no within-class weight", () => {
    const plan = planOrFail({
      contributionNis: 10_000,
      investableHoldings: [
        buildHolding("equity", AssetClass.EQUITY, EQUITY_VALUE_NIS),
        buildHolding("crypto", AssetClass.CRYPTO, CRYPTO_VALUE_NIS),
        buildHolding("nonEquityFunded", AssetClass.NON_EQUITY, 50_000, 1),
        buildHolding(
          "nonEquityUnweighted",
          AssetClass.NON_EQUITY,
          50_000,
          null
        ),
      ],
    });

    const funded = plan.byHolding.map((allocation) => allocation.holdingId);
    expect(funded).toContain("nonEquityFunded");
    expect(funded).not.toContain("nonEquityUnweighted");
  });

  it("refuses when a funded class has no weighted holding, naming the class", () => {
    const plan = planContribution(
      buildRequest({
        contributionNis: 10_000,
        investableHoldings: [
          buildHolding("equity", AssetClass.EQUITY, EQUITY_VALUE_NIS),
          buildHolding("crypto", AssetClass.CRYPTO, CRYPTO_VALUE_NIS),
          buildHolding(
            "nonEquity",
            AssetClass.NON_EQUITY,
            NON_EQUITY_VALUE_NIS,
            null
          ),
        ],
      })
    );

    expect(plan.status).toBe("refused");
    if (plan.status !== "refused") {
      throw new Error("unreachable");
    }
    expect(plan.reason).toBe("CLASS_HAS_NO_WEIGHTED_HOLDING");
    expect(plan.explanation).toContain(AssetClass.NON_EQUITY);
  });

  it("drops a sub-ticket holding leg and redistributes its money", () => {
    const plan = planOrFail({
      contributionNis: 10_000,
      minimumTicketNis: 500,
      investableHoldings: [
        buildHolding("equity", AssetClass.EQUITY, EQUITY_VALUE_NIS),
        buildHolding("crypto", AssetClass.CRYPTO, CRYPTO_VALUE_NIS),
        buildHolding("nonEquityBig", AssetClass.NON_EQUITY, 50_000, 98),
        buildHolding("nonEquityTiny", AssetClass.NON_EQUITY, 50_000, 1),
      ],
    });

    const total = plan.byHolding.reduce(
      (sum, allocation) => sum + allocation.contributionNis,
      0
    );
    expect(total).toBeCloseTo(10_000, 6);
    for (const allocation of plan.byHolding) {
      expect(allocation.contributionNis).toBeGreaterThanOrEqual(500);
    }
    expect(plan.dropped.map((entry) => entry.reason)).toContain(
      "BELOW_MINIMUM_TICKET"
    );
  });

  it("refuses when the whole contribution is below the minimum ticket", () => {
    const plan = planContribution(
      buildRequest({ contributionNis: 100, minimumTicketNis: 500 })
    );

    expect(plan.status).toBe("refused");
    if (plan.status !== "refused") {
      throw new Error("unreachable");
    }
    expect(plan.reason).toBe("CONTRIBUTION_BELOW_MINIMUM_TICKET");
  });

  it("removes an excluded class from both the target base and the value base", () => {
    const plan = planOrFail({
      contributionNis: 500_000,
      excludedAssetClasses: [AssetClass.CRYPTO],
    });

    expect(
      plan.byAssetClass.map((allocation) => allocation.assetClass)
    ).not.toContain(AssetClass.CRYPTO);
    expect(plan.investableValueNis).toBeCloseTo(
      EQUITY_VALUE_NIS + NON_EQUITY_VALUE_NIS,
      6
    );

    const targetSum = plan.byAssetClass.reduce(
      (sum, allocation) => sum + allocation.targetPercent,
      0
    );
    expect(targetSum).toBeCloseTo(100, 6);
  });

  it("keeps an excluded holding's value in its class while giving it nothing", () => {
    const holdings: InvestableHolding[] = [
      buildHolding("equity", AssetClass.EQUITY, EQUITY_VALUE_NIS),
      buildHolding("crypto", AssetClass.CRYPTO, CRYPTO_VALUE_NIS),
      buildHolding("nonEquityA", AssetClass.NON_EQUITY, 50_000, 1),
      buildHolding("nonEquityB", AssetClass.NON_EQUITY, 50_000, 1),
    ];

    const baseline = planOrFail({
      contributionNis: 10_000,
      investableHoldings: holdings,
    });
    const excluded = planOrFail({
      contributionNis: 10_000,
      investableHoldings: holdings,
      excludedHoldingIds: ["nonEquityB"],
    });

    expect(classAmount(excluded, AssetClass.NON_EQUITY)).toBeCloseTo(
      classAmount(baseline, AssetClass.NON_EQUITY),
      6
    );
    expect(excluded.investableValueNis).toBeCloseTo(
      baseline.investableValueNis,
      6
    );
    expect(
      excluded.byHolding.map((allocation) => allocation.holdingId)
    ).not.toContain("nonEquityB");
  });

  it("plans a zero contribution without producing NaN", () => {
    const plan = planOrFail({ contributionNis: 0 });

    for (const allocation of plan.byAssetClass) {
      expect(allocation.contributionNis).toBe(0);
      expect(Number.isNaN(allocation.percentAfter)).toBe(false);
    }
  });

  it("splits purely by target weight when the portfolio is empty", () => {
    const plan = planOrFail({
      contributionNis: 1_000,
      totalValueNis: 0,
      investableHoldings: [
        buildHolding("equity", AssetClass.EQUITY, 0),
        buildHolding("crypto", AssetClass.CRYPTO, 0),
        buildHolding("nonEquity", AssetClass.NON_EQUITY, 0),
      ],
    });

    expect(classAmount(plan, AssetClass.EQUITY)).toBeCloseTo(700, 6);
    expect(classAmount(plan, AssetClass.CRYPTO)).toBeCloseTo(100, 6);
    expect(classAmount(plan, AssetClass.NON_EQUITY)).toBeCloseTo(200, 6);
  });

  it("gives a zero-target class nothing without dividing by zero", () => {
    const plan = planOrFail({
      contributionNis: 10_000,
      classTargets: [
        { assetClass: AssetClass.EQUITY, targetPercent: 100 },
        { assetClass: AssetClass.CRYPTO, targetPercent: 0 },
        { assetClass: AssetClass.NON_EQUITY, targetPercent: 0 },
      ],
    });

    expect(classAmount(plan, AssetClass.EQUITY)).toBeCloseTo(10_000, 6);
    expect(classAmount(plan, AssetClass.CRYPTO)).toBe(0);
    expect(Number.isFinite(classAmount(plan, AssetClass.NON_EQUITY))).toBe(
      true
    );
  });

  it("refuses when every class with a positive target is excluded", () => {
    const plan = planContribution(
      buildRequest({
        excludedAssetClasses: [
          AssetClass.EQUITY,
          AssetClass.CRYPTO,
          AssetClass.NON_EQUITY,
        ],
      })
    );

    expect(plan.status).toBe("refused");
    if (plan.status !== "refused") {
      throw new Error("unreachable");
    }
    expect(plan.reason).toBe("NO_INVESTABLE_CLASS");
  });

  it("still spends the whole contribution after a class is dropped for the ticket", () => {
    // NON_EQUITY is furthest behind and takes nearly everything; CRYPTO's sliver
    // falls under the ticket and must be redistributed, not quietly lost.
    const plan = planOrFail({
      contributionNis: 121_000,
      minimumTicketNis: 2_000,
    });

    const total = plan.byAssetClass.reduce(
      (sum, allocation) => sum + allocation.contributionNis,
      0
    );
    expect(total).toBeCloseTo(121_000, 6);

    const droppedClasses = plan.dropped.filter(
      (entry) => entry.scope === "assetClass"
    );
    expect(droppedClasses.length).toBeGreaterThan(0);
    for (const entry of droppedClasses) {
      const allocation = plan.byAssetClass.find(
        (candidate) => candidate.assetClass === entry.label
      );
      expect(allocation?.contributionNis).toBe(0);
    }
  });

  it("refuses a negative or non-finite contribution rather than planning one", () => {
    for (const contributionNis of [
      -5_000,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(() =>
        planContribution(buildRequest({ contributionNis }))
      ).toThrow();
    }
  });

  it("treats a class whose only holding is excluded as excluded, not unfundable", () => {
    const plan = planOrFail({
      contributionNis: 50_000,
      excludedHoldingIds: ["crypto"],
    });

    expect(
      plan.byAssetClass.map((allocation) => allocation.assetClass)
    ).not.toContain(AssetClass.CRYPTO);
    const total = plan.byAssetClass.reduce(
      (sum, allocation) => sum + allocation.contributionNis,
      0
    );
    expect(total).toBeCloseTo(50_000, 6);
  });

  it("still refuses when a targeted class has no weighted holding at all", () => {
    const plan = planContribution(
      buildRequest({
        contributionNis: 50_000,
        investableHoldings: [
          buildHolding("equity", AssetClass.EQUITY, EQUITY_VALUE_NIS),
          buildHolding("crypto", AssetClass.CRYPTO, CRYPTO_VALUE_NIS, null),
          buildHolding(
            "nonEquity",
            AssetClass.NON_EQUITY,
            NON_EQUITY_VALUE_NIS
          ),
        ],
      })
    );

    expect(plan.status).toBe("refused");
    if (plan.status !== "refused") {
      throw new Error("unreachable");
    }
    expect(plan.reason).toBe("CLASS_HAS_NO_WEIGHTED_HOLDING");
  });

  it("is deterministic", () => {
    expect(
      planContribution(buildRequest({ contributionNis: 200_000 }))
    ).toEqual(planContribution(buildRequest({ contributionNis: 200_000 })));
  });
});
