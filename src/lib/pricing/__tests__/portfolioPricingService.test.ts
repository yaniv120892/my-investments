import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetClass, Liquidity, PriceSource } from "@prisma/client";
import type { Holding } from "@prisma/client";

const fetchQuote = vi.fn();
const getUsdToNisRate = vi.fn();

vi.mock("@/lib/providers/providerRegistry", () => ({
  getProvider: (source: PriceSource) => {
    if (source === PriceSource.MANUAL) {
      throw new Error("No remote price provider exists for source MANUAL");
    }
    return { source, fetchQuote };
  },
}));

vi.mock("@/lib/providers/FxRateProvider", () => ({
  fxRateProvider: { getUsdToNisRate: () => getUsdToNisRate() },
}));

const { priceHoldings, convertToNis } = await import(
  "@/lib/pricing/portfolioPricingService"
);
const { SUPPORTED_CURRENCIES } = await import(
  "@/lib/pricing/supportedCurrencies"
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
    getUsdToNisRate.mockReset();
    getUsdToNisRate.mockResolvedValue({ price: 3.0541 });
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
      148 * 742.36 * 3.0541,
      0
    );
    expect(result.totalValueNis).toBeCloseTo(148 * 742.36 * 3.0541, 0);
  });

  it("does not convert a holding already priced in NIS", async () => {
    fetchQuote.mockResolvedValue({
      price: 2442.9,
      currency: "NIS",
      fetchedAt: new Date(),
      source: "Bizportal",
    });
    const result = await priceHoldings([
      holding({
        quantity: 126,
        currency: "NIS",
        priceSource: PriceSource.BIZPORTAL,
        sourceSymbol: "1159250",
      }),
    ]);
    expect(result.valuations[0].valueInNis).toBeCloseTo(126 * 2442.9, 0);
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
    expect(result.pricedValueNis).toBeCloseTo(100 * 3.0541, 0);
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
      currency: "EUR",
      fetchedAt: new Date(),
      source: "Finnhub",
    });
    const result = await priceHoldings([holding()]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].reason).toMatch(/EUR/);
    expect(result.totalValueNis).toBeNull();
  });

  it("propagates an FX failure rather than returning a partial result", async () => {
    getUsdToNisRate.mockRejectedValue(new Error("fx down"));
    await expect(priceHoldings([holding()])).rejects.toThrow(/fx down/);
  });

  it("fetches the FX rate once regardless of holding count", async () => {
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
    expect(getUsdToNisRate).toHaveBeenCalledTimes(1);
  });

  it("returns a zero total and no failures for an empty portfolio", async () => {
    const result = await priceHoldings([]);
    expect(result.totalValueNis).toBe(0);
    expect(result.failures).toEqual([]);
  });
});

describe("SUPPORTED_CURRENCIES", () => {
  it("lists exactly the currencies convertToNis can convert", () => {
    for (const currency of SUPPORTED_CURRENCIES) {
      expect(() => convertToNis(1, currency, 3.0541)).not.toThrow();
    }
    expect(() => convertToNis(1, "EUR", 3.0541)).toThrow(/EUR/);
  });
});
