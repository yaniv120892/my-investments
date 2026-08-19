import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetClass, Liquidity, PriceSource } from "@prisma/client";
import type { Holding } from "@prisma/client";

const USD_TO_NIS_RATE = 3.0541;
const EUR_TO_NIS_RATE = 3.4666;

const fetchQuote = vi.fn();
const getRateToNis = vi.fn();

vi.mock("@/lib/providers/providerRegistry", () => ({
  getProvider: (source: PriceSource) => {
    if (source === PriceSource.MANUAL) {
      throw new Error("No remote price provider exists for source MANUAL");
    }
    return { source, fetchQuote };
  },
}));

vi.mock("@/lib/providers/FxRateProvider", () => ({
  fxRateProvider: {
    getRateToNis: (currency: string) => getRateToNis(currency),
  },
}));

const { priceHoldings } = await import(
  "@/lib/pricing/portfolioPricingService"
);

function holding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: "h1",
    userId: "u1",
    platformId: "p1",
    assetName: "S&P",
    assetClass: AssetClass.EQUITY,
    liquidity: Liquidity.LIQUID,
    quantity: 148,
    priceSource: PriceSource.FINNHUB,
    sourceSymbol: "IVV",
    currency: "USD",
    targetPercent: null,
    manualValueNis: null,
    manualValueUpdatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("priceHoldings", () => {
  beforeEach(() => {
    fetchQuote.mockReset();
    getRateToNis.mockReset();
    getRateToNis.mockImplementation(async (currency: string) => ({
      price: currency === "EUR" ? EUR_TO_NIS_RATE : USD_TO_NIS_RATE,
    }));
  });

  it("converts a USD holding into NIS", async () => {
    fetchQuote.mockResolvedValue({
      price: 742.36,
      currency: "USD",
      fetchedAt: new Date(),
      source: "Finnhub",
    });
    const result = await priceHoldings([holding()]);
    expect(result.failures).toHaveLength(0);
    expect(result.valuations[0].valueInNis).toBeCloseTo(
      148 * 742.36 * USD_TO_NIS_RATE,
      0
    );
    expect(result.totalValueNis).toBeCloseTo(
      148 * 742.36 * USD_TO_NIS_RATE,
      0
    );
  });

  it("converts a EUR holding at the EUR rate, not the USD one", async () => {
    fetchQuote.mockResolvedValue({
      price: 105.8,
      currency: "EUR",
      fetchedAt: new Date(),
      source: "Yahoo Finance",
    });
    const result = await priceHoldings([
      holding({ quantity: 342, priceSource: PriceSource.YAHOO, sourceSymbol: "IMAE.AS" }),
    ]);
    expect(result.failures).toHaveLength(0);
    expect(result.valuations[0].valueInNis).toBeCloseTo(
      342 * 105.8 * EUR_TO_NIS_RATE,
      0
    );
    expect(result.valuations[0].fxRateUsed).toBe(EUR_TO_NIS_RATE);
  });

  it("does not convert a holding already priced in NIS", async () => {
    fetchQuote.mockResolvedValue({
      price: 4.4625,
      currency: "NIS",
      fetchedAt: new Date(),
      source: "Maya (TASE)",
    });
    const result = await priceHoldings([
      holding({
        quantity: 13240,
        currency: "NIS",
        priceSource: PriceSource.MAYA,
        sourceSymbol: "5109889",
      }),
    ]);
    expect(result.valuations[0].valueInNis).toBeCloseTo(13240 * 4.4625, 0);
    expect(result.valuations[0].fxRateUsed).toBe(1);
  });

  it("records the rate each holding was converted at, not one rate for the run", async () => {
    fetchQuote
      .mockResolvedValueOnce({
        price: 100,
        currency: "USD",
        fetchedAt: new Date(),
        source: "Finnhub",
      })
      .mockResolvedValueOnce({
        price: 100,
        currency: "EUR",
        fetchedAt: new Date(),
        source: "Yahoo Finance",
      });

    const result = await priceHoldings([
      holding({ id: "usd" }),
      holding({ id: "eur" }),
    ]);

    expect(result.valuations.map((valuation) => valuation.fxRateUsed)).toEqual([
      USD_TO_NIS_RATE,
      EUR_TO_NIS_RATE,
    ]);
  });

  it("suppresses the total when any holding fails, and never sums unconverted values", async () => {
    fetchQuote
      .mockResolvedValueOnce({
        price: 100,
        currency: "USD",
        fetchedAt: new Date(),
        source: "Finnhub",
      })
      .mockRejectedValueOnce(new Error("provider exploded"));

    const result = await priceHoldings([
      holding({ id: "ok", quantity: 1 }),
      holding({ id: "bad", assetName: "Broken", sourceSymbol: "ZZZ" }),
    ]);

    expect(result.totalValueNis).toBeNull();
    expect(result.pricedValueNis).toBeCloseTo(100 * USD_TO_NIS_RATE, 0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].holdingId).toBe("bad");
    expect(result.failures[0].reason).toContain("provider exploded");
  });

  it("values a manual holding from its stored NIS amount without calling a provider", async () => {
    const result = await priceHoldings([
      holding({
        id: "sara",
        assetName: "שרה",
        priceSource: PriceSource.MANUAL,
        sourceSymbol: null,
        currency: "NIS",
        quantity: 1,
        manualValueNis: 84919,
        liquidity: Liquidity.ILLIQUID,
      }),
    ]);
    expect(fetchQuote).not.toHaveBeenCalled();
    expect(result.valuations[0].valueInNis).toBe(84919);
    expect(result.valuations[0].unitPrice).toBeNull();
    expect(result.valuations[0].fxRateUsed).toBe(1);
    expect(result.totalValueNis).toBe(84919);
  });

  it("accepts a manual holding worth exactly zero", async () => {
    const result = await priceHoldings([
      holding({
        assetName: "BTB",
        priceSource: PriceSource.MANUAL,
        sourceSymbol: null,
        currency: "NIS",
        quantity: 1,
        manualValueNis: 0,
      }),
    ]);
    expect(result.failures).toHaveLength(0);
    expect(result.valuations[0].valueInNis).toBe(0);
  });

  it("fails a manual holding that has no stored value", async () => {
    const result = await priceHoldings([
      holding({
        priceSource: PriceSource.MANUAL,
        sourceSymbol: null,
        manualValueNis: null,
      }),
    ]);
    expect(result.failures).toHaveLength(1);
    expect(result.totalValueNis).toBeNull();
  });

  it("fails a market holding with no source symbol", async () => {
    const result = await priceHoldings([holding({ sourceSymbol: null })]);
    expect(result.failures[0].reason).toMatch(/source symbol/i);
    expect(fetchQuote).not.toHaveBeenCalled();
  });

  it("fails a holding quoted in a currency it cannot convert", async () => {
    fetchQuote.mockResolvedValue({
      price: 10,
      currency: "GBP",
      fetchedAt: new Date(),
      source: "Yahoo Finance",
    });
    const result = await priceHoldings([holding()]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].reason).toMatch(/GBP/);
    expect(result.totalValueNis).toBeNull();
  });

  it("propagates an FX failure rather than returning a partial result", async () => {
    getRateToNis.mockRejectedValue(new Error("fx down"));
    await expect(priceHoldings([holding()])).rejects.toThrow(/fx down/);
  });

  it("fetches each currency's rate once regardless of holding count", async () => {
    fetchQuote.mockResolvedValue({
      price: 1,
      currency: "USD",
      fetchedAt: new Date(),
      source: "Finnhub",
    });
    await priceHoldings([
      holding({ id: "a" }),
      holding({ id: "b" }),
      holding({ id: "c" }),
    ]);
    expect(getRateToNis).toHaveBeenCalledTimes(1);
  });

  it("returns a zero total and no failures for an empty portfolio", async () => {
    const result = await priceHoldings([]);
    expect(result.totalValueNis).toBe(0);
    expect(result.failures).toEqual([]);
  });
});
