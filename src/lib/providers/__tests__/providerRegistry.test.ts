import { describe, expect, it } from "vitest";
import { PriceSource } from "@prisma/client";
import { getProvider } from "@/lib/providers/providerRegistry";

describe("getProvider", () => {
  it.each([
    [PriceSource.FINNHUB],
    [PriceSource.BINANCE],
    [PriceSource.YAHOO],
    [PriceSource.MAYA],
  ])("returns a provider whose source matches %s", (source) => {
    expect(getProvider(source).source).toBe(source);
  });

  it("throws for MANUAL, which has no remote provider", () => {
    expect(() => getProvider(PriceSource.MANUAL)).toThrow(/MANUAL/);
  });
});
