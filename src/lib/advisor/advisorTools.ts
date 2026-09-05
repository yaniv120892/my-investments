import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { AssetClass } from "@prisma/client";
import { loadInvestablePortfolio } from "@/lib/pricing/investablePortfolio";
import { planContribution } from "@/lib/pricing/contributionPlanner";
import { targetRepository } from "@/lib/targets/targetRepository";
import { holdingTrendRepository } from "@/lib/holdings/holdingTrendRepository";
import {
  isTargetSumBalanced,
  sumTargetPercent,
} from "@/lib/targets/targetPercentRules";
import { formatMoney } from "@/utils/format";
import { isAdvisorTurnRecorder } from "@/lib/advisor/advisorTurnRecorder";
import type { AdvisorTurnRecorder } from "@/lib/advisor/advisorTurnRecorder";
import {
  PORTFOLIO_LOADER_CONTEXT_KEY,
  TURN_RECORDER_CONTEXT_KEY,
  USER_ID_CONTEXT_KEY,
  type PortfolioLoader,
} from "@/lib/advisor/advisorTools.types";
import type { InvestablePortfolio } from "@/lib/pricing/investablePortfolio.types";

export {
  PORTFOLIO_LOADER_CONTEXT_KEY,
  TURN_RECORDER_CONTEXT_KEY,
  USER_ID_CONTEXT_KEY,
} from "@/lib/advisor/advisorTools.types";
export type { PortfolioLoader } from "@/lib/advisor/advisorTools.types";

const DEFAULT_TREND_MONTHS = 6;
const MAX_TREND_MONTHS = 120;
const DAYS_PER_MONTH = 30;

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

      return record(context, "getInvestablePortfolio", {
        investableValueFormatted: money(portfolio.investableValueNis),
        illiquidValueFormatted: money(portfolio.illiquidValueNis),
        isPricingComplete: portfolio.totalValueNis !== null,
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
      });
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

      return record(context, "getTargets", {
        classTargets,
        hasTargets: classTargets.length > 0,
        sumsTo100: isTargetSumBalanced(sumTargetPercent(classTargets)),
      });
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
    execute: async (input, context: ToolContext) => {
      const targetSum = sumTargetPercent(input.classTargets);
      const provided = new Set(
        input.classTargets.map((target) => target.assetClass)
      );

      return record(context, "validateClassTargets", {
        targetSum,
        sumsTo100: isTargetSumBalanced(targetSum),
        missingAssetClasses: Object.values(AssetClass).filter(
          (assetClass) => !provided.has(assetClass)
        ),
      });
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
        getRecorder(context)?.recordRefusal(plan.reason);
        return record(context, "planContribution", {
          status: plan.status,
          reason: plan.reason,
          explanation: describeRefusal(
            plan.reason,
            plan.explanation,
            portfolio
          ),
        });
      }

      getRecorder(context)?.recordPlan(plan);
      const money = nisFormatter(portfolio);

      return record(context, "planContribution", {
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
      });
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

      return record(context, "getHoldingPriceTrend", {
        assetName: matches[0].assetName,
        months,
        points: await holdingTrendRepository.findHoldingTrend(
          userId,
          matches[0].id,
          since
        ),
      });
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

/**
 * Every result is recorded, because the grounding check can only tell a quoted
 * figure from an invented one if it has seen every figure a tool produced.
 */
function record<T>(context: ToolContext, toolId: string, result: T): T {
  getRecorder(context)?.recordToolCall(toolId, result);
  return result;
}

function getRecorder(context: ToolContext): AdvisorTurnRecorder | undefined {
  const recorder = context.requestContext?.get(TURN_RECORDER_CONTEXT_KEY);
  return isAdvisorTurnRecorder(recorder) ? recorder : undefined;
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

function nisFormatter(
  portfolio: InvestablePortfolio
): (valueInNis: number) => string {
  return (valueInNis) => formatMoney(valueInNis, "NIS", portfolio.usdToNisRate);
}

function resolveExcludedHoldingIds(
  holdings: { holdingId: string; assetName: string }[],
  excludedAssetNames: string[]
): string[] {
  // A blank name is a substring of every asset name, so leaving one in would
  // exclude the whole portfolio and refuse the turn for an unrelated reason.
  const wanted = excludedAssetNames
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0);

  return holdings
    .filter((holding) =>
      wanted.some((name) => holding.assetName.toLowerCase().includes(name))
    )
    .map((holding) => holding.holdingId);
}

function describeRefusal(
  reason: string,
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
