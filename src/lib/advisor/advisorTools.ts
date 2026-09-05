import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { AssetClass } from "@prisma/client";
import { loadInvestablePortfolio } from "@/lib/pricing/investablePortfolio";
import { planContribution } from "@/lib/pricing/contributionPlanner";
import type { ContributionRefusalReason } from "@/lib/pricing/contributionPlanner.types";
import { targetRepository } from "@/lib/targets/targetRepository";
import { holdingTrendRepository } from "@/lib/holdings/holdingTrendRepository";
import {
  isTargetSumBalanced,
  sumTargetPercent,
} from "@/lib/targets/targetPercentRules";
import { formatMoney } from "@/utils/format";
import {
  PLAN_SINK_CONTEXT_KEY,
  PORTFOLIO_LOADER_CONTEXT_KEY,
  USER_ID_CONTEXT_KEY,
  type PlanSink,
  type PortfolioLoader,
} from "@/lib/advisor/advisorTools.types";
import type { InvestablePortfolio } from "@/lib/pricing/investablePortfolio.types";
import type { HoldingTrendPoint } from "@/lib/holdings/holdingTrendRepository.types";

export {
  PLAN_SINK_CONTEXT_KEY,
  PORTFOLIO_LOADER_CONTEXT_KEY,
  USER_ID_CONTEXT_KEY,
} from "@/lib/advisor/advisorTools.types";
export type {
  PlanSink,
  PortfolioLoader,
} from "@/lib/advisor/advisorTools.types";

const DEFAULT_TREND_MONTHS = 6;
const MAX_TREND_MONTHS = 120;
const DAYS_PER_MONTH = 30;
const PERCENT_SCALE = 100;
/** formatMoney ignores the rate when the display currency is already NIS. */
const NIS_RATE_IS_UNUSED = 1;

interface ToolContext {
  requestContext?: { get: (key: string) => unknown };
}

export function buildAdvisorTools() {
  const getInvestablePortfolio = createTool({
    id: "getInvestablePortfolio",
    description:
      "The money that can actually receive a contribution: every liquid holding, its value, its asset class, and its within-class weight. Illiquid holdings (pension, keren hishtalmut) are listed separately as fixed background, because new money cannot be directed into them. Call this before discussing any figure about the portfolio.",
    inputSchema: z.object({}),
    execute: async (_input, context: ToolContext) => {
      const portfolio = await loadPortfolio(context);
      const money = nisFormatter(portfolio);

      const isPricingComplete = portfolio.investableValueNis !== null;

      return {
        // Withheld rather than summed from what priced, so the model cannot
        // quote a total the app itself refuses to show.
        investableValueFormatted: isPricingComplete
          ? money(portfolio.pricedInvestableValueNis)
          : null,
        pricedSoFarFormatted: money(portfolio.pricedInvestableValueNis),
        illiquidValueFormatted: money(portfolio.illiquidValueNis),
        isPricingComplete,
        pricingFailures: portfolio.failures.map((failure) => ({
          assetName: failure.assetName,
          reason: failure.reason,
        })),
        byAssetClass: portfolio.byAssetClass.map((position) => ({
          assetClass: position.assetClass,
          valueFormatted: money(position.valueInNis),
          percentOfInvestable: position.percentOfInvestable,
        })),
        holdings: portfolio.investableHoldings.map((holding) => ({
          assetName: holding.assetName,
          assetClass: holding.assetClass,
          platformName: holding.platformName,
          valueFormatted: money(holding.valueInNis),
          withinClassWeight: holding.withinClassWeight,
        })),
        illiquidHoldings: portfolio.illiquidPositions.map((position) => ({
          assetName: position.assetName,
          platformName: position.platformName,
          valueFormatted: money(position.valueInNis),
        })),
      };
    },
  });

  const getTargets = createTool({
    id: "getTargets",
    description:
      "The user's stored asset class targets. A target of 0 means that class should receive nothing. Within-class weights are reported per holding by getInvestablePortfolio.",
    inputSchema: z.object({}),
    execute: async (_input, context: ToolContext) => {
      const classTargets = await targetRepository.findClassTargets(
        requireUserId(context)
      );

      return {
        classTargets,
        hasTargets: classTargets.length > 0,
        sumsTo100: isTargetSumBalanced(sumTargetPercent(classTargets)),
      };
    },
  });

  const validateClassTargets = createTool({
    id: "validateClassTargets",
    description:
      "Checks a hypothetical set of asset class targets without saving anything. Use it to answer 'what if I went 80/15/5' questions.",
    inputSchema: z.object({
      classTargets: z.array(
        z.object({
          assetClass: z.enum(AssetClass),
          targetPercent: z.number(),
        })
      ),
    }),
    execute: async (input) => {
      const targetSum = sumTargetPercent(input.classTargets);
      const provided = new Set(
        input.classTargets.map((target) => target.assetClass)
      );

      return {
        targetSum,
        sumsTo100: isTargetSumBalanced(targetSum),
        missingAssetClasses: Object.values(AssetClass).filter(
          (assetClass) => !provided.has(assetClass)
        ),
      };
    },
  });

  const planContributionTool = createTool({
    id: "planContribution",
    description:
      "Works out how to split a specific amount of new money across the portfolio so it moves toward the stored targets, buying only and never selling. This is the ONLY source of contribution figures — never compute, adjust, or re-split an amount yourself. It returns either a plan or a refusal with a reason; relay a refusal, do not work around it.",
    inputSchema: z.object({
      contributionNis: z
        .number()
        .positive()
        .describe("The amount of new money to invest, in NIS"),
      minimumTicketNis: z
        .number()
        .nonnegative()
        .optional()
        .describe("Smallest amount worth putting into one holding"),
      excludedAssetClasses: z
        .array(z.enum(AssetClass))
        .optional()
        .describe("Asset classes to allocate as if they did not exist"),
      excludedAssetNames: z
        .array(z.string())
        .optional()
        .describe("Holdings by name that should receive nothing this time"),
    }),
    execute: async (input, context: ToolContext) => {
      const userId = requireUserId(context);
      const [portfolio, classTargets] = await Promise.all([
        loadPortfolio(context),
        targetRepository.findClassTargets(userId),
      ]);

      const plan = planContribution({
        contributionNis: input.contributionNis,
        investableHoldings: portfolio.investableHoldings,
        classTargets,
        minimumTicketNis: input.minimumTicketNis ?? 0,
        excludedAssetClasses: input.excludedAssetClasses ?? [],
        excludedHoldingIds: resolveExcludedHoldingIds(
          portfolio.investableHoldings,
          input.excludedAssetNames ?? []
        ),
        totalValueNis: portfolio.totalValueNis,
      });

      if (plan.status === "refused") {
        return {
          status: plan.status,
          reason: plan.reason,
          explanation: describeRefusal(
            plan.reason,
            plan.explanation,
            portfolio
          ),
        };
      }

      getPlanSink(context)?.push(plan);
      const money = nisFormatter(portfolio);

      return {
        status: plan.status,
        contributionFormatted: money(plan.contributionNis),
        byAssetClass: plan.byAssetClass.map((allocation) => ({
          assetClass: allocation.assetClass,
          currentPercent: allocation.currentPercent,
          targetPercent: allocation.targetPercent,
          addFormatted: money(allocation.contributionNis),
          percentAfter: allocation.percentAfter,
        })),
        byHolding: plan.byHolding.map((allocation) => ({
          assetName: allocation.assetName,
          platformName: allocation.platformName,
          addFormatted: money(allocation.contributionNis),
        })),
        dropped: plan.dropped.map((entry) => ({
          label: entry.label,
          reason: entry.reason,
        })),
      };
    },
  });

  const getHoldingPriceTrend = createTool({
    id: "getHoldingPriceTrend",
    description:
      "Daily snapshot history for one holding, so you can say whether a position is up or down over recent months. Context only — it never changes what planContribution returns.",
    inputSchema: z.object({
      assetName: z.string().min(1),
      months: z.number().int().positive().max(MAX_TREND_MONTHS).optional(),
    }),
    execute: async (input, context: ToolContext) => {
      const userId = requireUserId(context);
      const matches = await holdingTrendRepository.findLiquidHoldingsByName(
        userId,
        input.assetName
      );

      if (matches.length === 0) {
        throw new Error(
          `No liquid holding matches that name (assetName: ${input.assetName}). Call getInvestablePortfolio to see the exact names.`
        );
      }
      if (matches.length > 1) {
        throw new Error(
          `That name matches more than one holding (assetName: ${input.assetName}, matches: ${matches
            .map((match) => match.assetName)
            .join(", ")}). Ask which one is meant.`
        );
      }

      const months = input.months ?? DEFAULT_TREND_MONTHS;
      const since = new Date();
      since.setDate(since.getDate() - months * DAYS_PER_MONTH);

      return summariseTrend(
        matches[0].assetName,
        months,
        await holdingTrendRepository.findHoldingTrend(
          userId,
          matches[0].id,
          since
        )
      );
    },
  });

  return {
    getInvestablePortfolio,
    getTargets,
    validateClassTargets,
    planContribution: planContributionTool,
    getHoldingPriceTrend,
  };
}

/**
 * Never part of an inputSchema: a prompt-injected message must not be able to
 * choose whose portfolio it reads.
 */
function requireUserId(context: ToolContext): string {
  const userId = context.requestContext?.get(USER_ID_CONTEXT_KEY);
  if (typeof userId !== "string" || !userId) {
    throw new Error("Advisor tool called without an authenticated user");
  }
  return userId;
}

async function loadPortfolio(
  context: ToolContext
): Promise<InvestablePortfolio> {
  const userId = requireUserId(context);
  const loader = context.requestContext?.get(PORTFOLIO_LOADER_CONTEXT_KEY);
  if (isPortfolioLoader(loader)) {
    return loader();
  }
  return loadInvestablePortfolio(userId);
}

function isPortfolioLoader(value: unknown): value is PortfolioLoader {
  return typeof value === "function";
}

function getPlanSink(context: ToolContext): PlanSink | undefined {
  const sink = context.requestContext?.get(PLAN_SINK_CONTEXT_KEY);
  return Array.isArray(sink) ? sink : undefined;
}

function nisFormatter(
  portfolio: InvestablePortfolio
): (valueInNis: number) => string {
  return (valueInNis) => formatMoney(valueInNis, "NIS", portfolio.usdToNisRate);
}

/**
 * Exact match first, substring only as a fallback, and a name that matches
 * nothing throws. Silently ignoring a miss is the dangerous case: the model
 * would report a plan as though the exclusion applied when it did not.
 */
function resolveExcludedHoldingIds(
  holdings: { holdingId: string; assetName: string }[],
  excludedAssetNames: string[]
): string[] {
  const excluded = new Set<string>();

  for (const rawName of excludedAssetNames) {
    const name = rawName.trim().toLowerCase();
    if (!name) {
      continue;
    }

    const exact = holdings.filter(
      (holding) => holding.assetName.toLowerCase() === name
    );
    const matches =
      exact.length > 0
        ? exact
        : holdings.filter((holding) =>
            holding.assetName.toLowerCase().includes(name)
          );

    if (matches.length === 0) {
      throw new Error(
        `No liquid holding matches that name, so it cannot be excluded (assetName: ${rawName}). Call getInvestablePortfolio for the exact names.`
      );
    }
    for (const holding of matches) {
      excluded.add(holding.holdingId);
    }
  }

  return [...excluded];
}

function describeRefusal(
  reason: ContributionRefusalReason,
  explanation: string,
  portfolio: InvestablePortfolio
): string {
  if (reason !== "PRICING_INCOMPLETE" || portfolio.failures.length === 0) {
    return explanation;
  }
  return `${explanation} Failing holdings: ${portfolio.failures
    .map((failure) => `${failure.assetName} (${failure.reason})`)
    .join("; ")}.`;
}

/**
 * Summarised here rather than handed over as a table: "is this up or down" is
 * arithmetic, and every figure the advisor states has to come from a tool. The
 * raw series is also long enough to crowd the context on its own.
 */
function summariseTrend(
  assetName: string,
  months: number,
  points: HoldingTrendPoint[]
) {
  const first = points.at(0);
  const last = points.at(-1);

  if (!first || !last) {
    return {
      assetName,
      months,
      hasHistory: false,
      note: "No snapshots cover that period yet.",
    };
  }

  const changeNis = last.valueNis - first.valueNis;
  const changePercent =
    first.valueNis > 0 ? (changeNis / first.valueNis) * PERCENT_SCALE : null;

  return {
    assetName,
    months,
    hasHistory: true,
    snapshotCount: points.length,
    startDate: first.date,
    endDate: last.date,
    startValueFormatted: nisMoney(first.valueNis),
    endValueFormatted: nisMoney(last.valueNis),
    changeFormatted: nisMoney(changeNis),
    changePercent,
    direction: describeDirection(changeNis),
  };
}

function describeDirection(changeNis: number): "up" | "down" | "flat" {
  if (changeNis > 0) {
    return "up";
  }
  return changeNis < 0 ? "down" : "flat";
}

function nisMoney(valueInNis: number): string {
  return formatMoney(valueInNis, "NIS", NIS_RATE_IS_UNUSED);
}
