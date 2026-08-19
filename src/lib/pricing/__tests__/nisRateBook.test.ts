import { beforeEach, describe, expect, it, vi } from "vitest";
import { NisRateBook } from "@/lib/pricing/nisRateBook";
import type { RateToNisSource } from "@/lib/pricing/nisRateBook";
import { SUPPORTED_CURRENCIES } from "@/lib/pricing/supportedCurrencies";

const USD_TO_NIS_RATE = 3.0541;
const EUR_TO_NIS_RATE = 3.4666;

const getRateToNis = vi.fn();

const rateSource: RateToNisSource = { getRateToNis };

describe("NisRateBook", () => {
  beforeEach(() => {
    getRateToNis.mockReset();
    getRateToNis.mockImplementation(async (currency: string) => ({
      price: currency === "EUR" ? EUR_TO_NIS_RATE : USD_TO_NIS_RATE,
    }));
  });

  it("converts every currency the app claims to support", async () => {
    const book = new NisRateBook(rateSource);
    for (const currency of SUPPORTED_CURRENCIES) {
      await expect(book.convertToNis(1, currency)).resolves.toBeGreaterThan(0);
    }
  });

  it("rejects a currency outside that list, naming it and the supported set", async () => {
    await expect(
      new NisRateBook(rateSource).convertToNis(1, "GBP")
    ).rejects.toThrow(/GBP[\s\S]*NIS, USD, EUR/);
  });

  it("treats NIS as one to one without asking the FX provider", async () => {
    expect(await new NisRateBook(rateSource).getRateToNis("NIS")).toBe(1);
    expect(getRateToNis).not.toHaveBeenCalled();
  });

  it("asks the FX provider once per currency, however many times it is used", async () => {
    const book = new NisRateBook(rateSource);
    await book.getRateToNis("USD");
    await book.getRateToNis("USD");
    await book.getRateToNis("EUR");
    expect(getRateToNis).toHaveBeenCalledTimes(2);
    expect(getRateToNis).toHaveBeenCalledWith("USD");
    expect(getRateToNis).toHaveBeenCalledWith("EUR");
  });

  it("shares one lookup between callers that ask before it resolves", async () => {
    const book = new NisRateBook(rateSource);
    await Promise.all([
      book.getRateToNis("USD"),
      book.getRateToNis("USD"),
      book.getRateToNis("USD"),
    ]);
    expect(getRateToNis).toHaveBeenCalledTimes(1);
  });

  it("does not memoise a failed lookup, so one blip cannot poison the run", async () => {
    getRateToNis.mockRejectedValueOnce(new Error("fx down"));
    const book = new NisRateBook(rateSource);

    await expect(book.getRateToNis("USD")).rejects.toThrow(/fx down/);
    expect(await book.getRateToNis("USD")).toBe(USD_TO_NIS_RATE);
  });

  it("multiplies by the rate the provider returned", async () => {
    expect(
      await new NisRateBook(rateSource).convertToNis(100, "EUR")
    ).toBeCloseTo(100 * EUR_TO_NIS_RATE, 6);
  });
});
