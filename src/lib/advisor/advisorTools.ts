import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { AssetClass } from "@prisma/client";
import { loadInvestablePortfolio } from "@/lib/pricing/investablePortfolio";
import { planContribution } from "@/lib/pricing/contributionPlanner";
import { targetRepository } from "@/lib/targets/targetRepository";
import { holdingTrendRepository } from "@/lib/holdings/holdingTrendRepository";
import { isTargetSumBalanced } from "@/lib/targets/targetPercentRules";
import { formatMoney } from "@/utils/format";
import {
  PLAN_SINK_CONTEXT_KEY,
  USER_ID_CONTEXT_KEY,
  type PlanSink,
} from "@/lib/advisor/advisorTools.types";
import type { ClassTarget } from "@/lib/pricing/contributionPlanner.types";

export {
  PLAN_SINK_CONTEXT_KEY,
  USER_ID_CONTEXT_KEY,
} from "@/lib/advisor/advisorTools.types";
export type { PlanSink } from "@/lib/advisor/advisorTools.types";

const DEFAULT_TREND_MONTHS = 6;
const DAYS_PER_MONTH = 30;

interface ToolContext {
  requestContext?: { get: (key: string) => unknown };
}

export function buildAdvisorTools() {
  const getInvestablePortfolio = createTool({
    id: "getInvestablePortfolio",
    description:
      "The money that can actually receive a contribution: every liquid holding, its value, its asset class, and its within-class weight. Illiquid holdings (pension, keren hishtalmut) are reported only as a fixed background total, because new money cannot be directed into them. Call this before discussing any figure about the portfolio.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      investableValueNis: z.number(),
      investableValueFormatted: z.string(),
      illiquidValueNis: z.number(),
      illiquidValueFormatted: z.string(),
      isPricingComplete: z.boolean(),
      pricingFailures: z.array(
        z.object({ assetName: z.string(), reason: z.string() })
      ),
      byAssetClass: z.array(
        z.object({
          assetClass: z.string(),
          valueNis: z.number(),
          valueFormatted: z.string(),
          percentOfInvestable: z.number(),
        })
      ),
      holdings: z.array(
        z.object({
          assetName: z.string(),
          assetClass: z.string(),
          platformName: z.string(),
          valueNis: z.number(),
          valueFormatted: z.string(),
          withinClassWeight: z.number().nullable(),
        })
      ),
    }),
    execute: async (_input, context: ToolContext) => {
      const portfolio = await loadInvestablePortfolio(requireUserId(context));
      const money = (value: number) =>
        formatMoney(value, "NIS", portfolio.usdToNisRate);

      return {
        investableValueNis: portfolio.investableValueNis,
        investableValueFormatted: money(portfolio.investableValueNis),
        illiquidValueNis: portfolio.illiquidValueNis,
        illiquidValueFormatted: money(portfolio.illiquidValueNis),
        isPricingComplete: portfolio.totalValueNis !== null,
        pricingFailures: portfolio.failures.map((failure) => ({
          assetName: failure.assetName,
          reason: failure.reason,
        })),
        byAssetClass: portfolio.byAssetClass.map((position) => ({
          assetClass: position.assetClass,
          valueNis: position.valueInNis,
          valueFormatted: money(position.valueInNis),
          percentOfInvestable: position.percentOfInvestable,
        })),
        holdings: portfolio.investableHoldings.map((holding) => ({
          assetName: holding.assetName,
          assetClass: holding.assetClass,
          platformName: holding.platformName,
          valueNis: holding.valueInNis,
          valueFormatted: money(holding.valueInNis),
          withinClassWeight: holding.withinClassWeight,
        })),
      };
    },
  });

  const getTargets = createTool({
    id: "getTargets",
    description:
      "The user's stored asset class targets and per-holding within-class weights. A class target of 0 means that class should receive nothing; a null within-class weight means that holding receives no new money.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      classTargets: z.array(
        z.object({ assetClass: z.string(), targetPercent: z.number() })
      ),
      sumsTo100: z.boolean(),
      hasTargets: z.boolean(),
    }),
    execute: async (_input, context: ToolContext) => {
      const stored = await targetRepository.findTargets(requireUserId(context));
      const targetSum = stored.classTargets.reduce(
        (total, target) => total + target.targetPercent,
        0
      );

      return {
        classTargets: stored.classTargets,
        sumsTo100: isTargetSumBalanced(targetSum),
        hasTargets: stored.classTargets.length > 0,
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
    outputSchema: z.object({
      sumsTo100: z.boolean(),
      targetSum: z.number(),
      missingAssetClasses: z.array(z.string()),
    }),
    execute: async (input) => {
      const targetSum = input.classTargets.reduce(
        (total, target) => total + target.targetPercent,
        0
      );
      const provided = new Set(
        input.classTargets.map((target) => target.assetClass)
      );

      return {
        sumsTo100: isTargetSumBalanced(targetSum),
        targetSum,
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
        .describe("The amount of new money to invest, in NIS"),
      minimumTicketNis: z
        .number()
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
      const [portfolio, storedTargets] = await Promise.all([
        loadInvestablePortfolio(userId),
        targetRepository.findTargets(userId),
      ]);

      if (storedTargets.classTargets.length === 0) {
        return {
          status: "refused",
          reason: "NO_TARGETS_SET",
          explanation:
            "No asset class targets are stored yet, so there is nothing to aim at. Set them on the Advisor page first.",
        };
      }

      const plan = planContribution({
        contributionNis: input.contributionNis,
        investableHoldings: portfolio.investableHoldings,
        classTargets: toClassTargets(storedTargets.classTargets),
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
          status: "refused",
          reason: plan.reason,
          explanation: describeRefusal(
            plan.reason,
            plan.explanation,
            portfolio.failures
          ),
        };
      }

      getPlanSink(context)?.push(plan);
      const money = (value: number) =>
        formatMoney(value, "NIS", portfolio.usdToNisRate);

      return {
        status: "planned",
        contributionFormatted: money(plan.contributionNis),
        byAssetClass: plan.byAssetClass.map((allocation) => ({
          assetClass: allocation.assetClass,
          currentPercent: allocation.currentPercent,
          targetPercent: allocation.targetPercent,
          addFormatted: money(allocation.contributionNis),
          addNis: allocation.contributionNis,
          percentAfter: allocation.percentAfter,
        })),
        byHolding: plan.byHolding.map((allocation) => ({
          assetName: allocation.assetName,
          platformName: allocation.platformName,
          addFormatted: money(allocation.contributionNis),
          addNis: allocation.contributionNis,
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
      assetName: z.string(),
      months: z.number().optional(),
    }),
    execute: async (input, context: ToolContext) => {
      const userId = requireUserId(context);
      const matches = await holdingTrendRepository.findLiquidHoldingsByName(
        userId,
        input.assetName
      );

      if (matches.length === 0) {
        throw new Error(
          `No holding matches that name (assetName: ${input.assetName}). Call getInvestablePortfolio to see the exact names.`
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

      const points = await holdingTrendRepository.findHoldingTrend(
        userId,
        matches[0].id,
        since
      );

      return { assetName: matches[0].assetName, months, points };
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

function getPlanSink(context: ToolContext): PlanSink | undefined {
  const sink = context.requestContext?.get(PLAN_SINK_CONTEXT_KEY);
  return Array.isArray(sink) ? sink : undefined;
}

function toClassTargets(
  stored: { assetClass: AssetClass; targetPercent: number }[]
): ClassTarget[] {
  return stored.map((target) => ({
    assetClass: target.assetClass,
    targetPercent: target.targetPercent,
  }));
}

function resolveExcludedHoldingIds(
  holdings: { holdingId: string; assetName: string }[],
  excludedAssetNames: string[]
): string[] {
  const wanted = excludedAssetNames.map((name) => name.toLowerCase());

  return holdings
    .filter((holding) =>
      wanted.some((name) => holding.assetName.toLowerCase().includes(name))
    )
    .map((holding) => holding.holdingId);
}

function describeRefusal(
  reason: string,
  explanation: string,
  failures: { assetName: string; reason: string }[]
): string {
  if (reason !== "PRICING_INCOMPLETE" || failures.length === 0) {
    return explanation;
  }
  return `${explanation} Failing holdings: ${failures
    .map((failure) => `${failure.assetName} (${failure.reason})`)
    .join("; ")}.`;
}
