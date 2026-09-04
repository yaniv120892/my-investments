import { Liquidity } from "@prisma/client";
import type { AssetClass, Holding, Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { priceHoldings } from "@/lib/pricing/portfolioPricingService";
import { TOTAL_TARGET_PERCENT } from "@/lib/targets/targetPercentRules";
import type { PricingResult } from "@/lib/pricing/portfolioPricingService.types";
import type { InvestableHolding } from "@/lib/pricing/contributionPlanner.types";
import type {
  ClassPosition,
  IlliquidPosition,
  InvestablePortfolio,
} from "@/lib/pricing/investablePortfolio.types";

export type {
  ClassPosition,
  IlliquidPosition,
  InvestablePortfolio,
} from "@/lib/pricing/investablePortfolio.types";

type HoldingWithPlatform = Holding & { platform: Platform };

export async function loadInvestablePortfolio(
  userId: string
): Promise<InvestablePortfolio> {
  const holdings = await prisma.holding.findMany({
    where: { userId },
    include: { platform: true },
    orderBy: { assetName: "asc" },
  });

  return buildInvestablePortfolio(holdings, await priceHoldings(holdings));
}

/**
 * One load per request, shared by every caller. Pricing is ~20 serial cache
 * round trips and a single advisor turn reads the portfolio two or three times.
 */
export function createInvestablePortfolioLoader(
  userId: string
): () => Promise<InvestablePortfolio> {
  let portfolio: Promise<InvestablePortfolio> | undefined;
  return () => (portfolio ??= loadInvestablePortfolio(userId));
}

/**
 * Liquidity is consulted here and nowhere else: the planner has no liquidity
 * concept, because money can only ever go to the liquid side.
 */
export function buildInvestablePortfolio(
  holdings: HoldingWithPlatform[],
  pricing: PricingResult
): InvestablePortfolio {
  const valueByHoldingId = new Map(
    pricing.valuations.map((valuation) => [
      valuation.holdingId,
      valuation.valueInNis,
    ])
  );

  const investableHoldings: InvestableHolding[] = [];
  const illiquidPositions: IlliquidPosition[] = [];

  for (const holding of holdings) {
    const valueInNis = valueByHoldingId.get(holding.id);
    if (valueInNis === undefined) {
      continue;
    }

    if (holding.liquidity === Liquidity.ILLIQUID) {
      illiquidPositions.push({
        assetName: holding.assetName,
        platformName: holding.platform.name,
        valueInNis,
      });
      continue;
    }

    investableHoldings.push({
      holdingId: holding.id,
      assetName: holding.assetName,
      assetClass: holding.assetClass,
      platformName: holding.platform.name,
      valueInNis,
      withinClassWeight: holding.withinClassWeight,
    });
  }

  const investableValueNis = sumValues(investableHoldings);

  return {
    investableHoldings,
    investableValueNis,
    illiquidValueNis: sumValues(illiquidPositions),
    illiquidPositions,
    byAssetClass: buildClassPositions(investableHoldings, investableValueNis),
    totalValueNis: pricing.totalValueNis,
    failures: pricing.failures,
    usdToNisRate: pricing.usdToNisRate,
  };
}

function buildClassPositions(
  investableHoldings: InvestableHolding[],
  investableValueNis: number
): ClassPosition[] {
  const valueByClass = new Map<AssetClass, number>();
  for (const holding of investableHoldings) {
    valueByClass.set(
      holding.assetClass,
      (valueByClass.get(holding.assetClass) ?? 0) + holding.valueInNis
    );
  }

  return [...valueByClass.entries()].map(([assetClass, valueInNis]) => ({
    assetClass,
    valueInNis,
    percentOfInvestable:
      investableValueNis > 0
        ? (valueInNis / investableValueNis) * TOTAL_TARGET_PERCENT
        : 0,
  }));
}

function sumValues(positions: { valueInNis: number }[]): number {
  return positions.reduce((total, position) => total + position.valueInNis, 0);
}
