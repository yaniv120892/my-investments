import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AssetClass,
  Liquidity,
  PriceSource,
  type Holding,
  type Platform,
} from "@prisma/client";
const { priceHoldings, findMany } = vi.hoisted(() => ({
  priceHoldings: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/pricing/portfolioPricingService", () => ({ priceHoldings }));
vi.mock("@/lib/db", () => ({ prisma: { holding: { findMany } } }));

import {
  buildInvestablePortfolio,
  createInvestablePortfolioLoader,
} from "@/lib/pricing/investablePortfolio";
import type { PricingResult } from "@/lib/pricing/portfolioPricingService.types";

type HoldingWithPlatform = Holding & { platform: Platform };

function buildHolding(
  id: string,
  assetClass: AssetClass,
  liquidity: Liquidity,
  withinClassWeight: number | null = 1
): HoldingWithPlatform {
  const now = new Date("2026-09-04T00:00:00.000Z");

  return {
    id,
    userId: "user-1",
    platformId: "platform-1",
    assetName: `${id} asset`,
    assetClass,
    liquidity,
    quantity: 1,
    priceSource: PriceSource.MANUAL,
    sourceSymbol: null,
    currency: "NIS",
    targetPercent: null,
    withinClassWeight,
    manualValueNis: null,
    manualValueUpdatedAt: null,
    createdAt: now,
    updatedAt: now,
    platform: {
      id: "platform-1",
      userId: "user-1",
      name: "Long-term savings",
      baseCurrency: "NIS",
      createdAt: now,
      updatedAt: now,
    },
  };
}

function buildPricing(
  valuations: { holdingId: string; valueInNis: number }[],
  overrides: Partial<PricingResult> = {}
): PricingResult {
  const pricedValueNis = valuations.reduce(
    (total, valuation) => total + valuation.valueInNis,
    0
  );

  return {
    valuations: valuations.map((valuation) => ({
      holdingId: valuation.holdingId,
      assetName: `${valuation.holdingId} asset`,
      valueInNis: valuation.valueInNis,
      unitPrice: null,
      currency: "NIS",
      fxRateUsed: 1,
      fetchedAt: new Date("2026-09-04T00:00:00.000Z"),
    })),
    failures: [],
    usdToNisRate: 3.7,
    totalValueNis: pricedValueNis,
    pricedValueNis,
    ...overrides,
  };
}

describe("buildInvestablePortfolio", () => {
  it("keeps illiquid holdings out of the investable side but counts their value", () => {
    const portfolio = buildInvestablePortfolio(
      [
        buildHolding("liquidEquity", AssetClass.EQUITY, Liquidity.LIQUID),
        buildHolding("pension", AssetClass.NON_EQUITY, Liquidity.ILLIQUID),
      ],
      buildPricing([
        { holdingId: "liquidEquity", valueInNis: 1_364_219 },
        { holdingId: "pension", valueInNis: 909_592 },
      ])
    );

    expect(
      portfolio.investableHoldings.map((holding) => holding.holdingId)
    ).toEqual(["liquidEquity"]);
    expect(portfolio.investableValueNis).toBe(1_364_219);
    expect(portfolio.illiquidValueNis).toBe(909_592);
    expect(portfolio.illiquidPositions).toHaveLength(1);
  });

  it("passes a null total straight through so the planner can refuse", () => {
    const portfolio = buildInvestablePortfolio(
      [buildHolding("liquidEquity", AssetClass.EQUITY, Liquidity.LIQUID)],
      buildPricing([{ holdingId: "liquidEquity", valueInNis: 100 }], {
        totalValueNis: null,
        failures: [
          {
            holdingId: "unpriced",
            assetName: "unpriced asset",
            sourceSymbol: null,
            reason: "no manual value stored",
          },
        ],
      })
    );

    expect(portfolio.totalValueNis).toBeNull();
    expect(portfolio.failures).toHaveLength(1);
  });

  it("omits a holding that failed to price from every side", () => {
    const portfolio = buildInvestablePortfolio(
      [
        buildHolding("priced", AssetClass.EQUITY, Liquidity.LIQUID),
        buildHolding("unpriced", AssetClass.EQUITY, Liquidity.LIQUID),
      ],
      buildPricing([{ holdingId: "priced", valueInNis: 500 }], {
        totalValueNis: null,
      })
    );

    expect(portfolio.investableHoldings).toHaveLength(1);
    expect(portfolio.investableValueNis).toBe(500);
  });

  it("reports each class as a share of the investable base, not the whole portfolio", () => {
    const portfolio = buildInvestablePortfolio(
      [
        buildHolding("equity", AssetClass.EQUITY, Liquidity.LIQUID),
        buildHolding("crypto", AssetClass.CRYPTO, Liquidity.LIQUID),
        buildHolding("pension", AssetClass.NON_EQUITY, Liquidity.ILLIQUID),
      ],
      buildPricing([
        { holdingId: "equity", valueInNis: 750 },
        { holdingId: "crypto", valueInNis: 250 },
        { holdingId: "pension", valueInNis: 9_000 },
      ])
    );

    const equity = portfolio.byAssetClass.find(
      (position) => position.assetClass === AssetClass.EQUITY
    );
    expect(equity?.percentOfInvestable).toBeCloseTo(75, 6);
  });
});

describe("createInvestablePortfolioLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([]);
    priceHoldings.mockResolvedValue(buildPricing([]));
  });

  it("prices once and shares the promise with every later caller", async () => {
    const loader = createInvestablePortfolioLoader("user-1");

    const [first, second] = await Promise.all([loader(), loader()]);
    const third = await loader();

    expect(priceHoldings).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });
});
