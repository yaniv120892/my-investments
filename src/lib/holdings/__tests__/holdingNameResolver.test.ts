import { describe, expect, it } from "vitest";
import { resolveHoldingsByName } from "@/lib/holdings/holdingNameResolver";

interface Named {
  assetName: string;
}

function holding(assetName: string): Named {
  return { assetName };
}

describe("resolveHoldingsByName", () => {
  it("prefers an exact match over a holding for which the name is only a substring", () => {
    const holdings = [holding("VOO"), holding("VOOG")];

    expect(resolveHoldingsByName(holdings, "VOO")).toEqual([holding("VOO")]);
  });

  it("is case-insensitive for the exact match", () => {
    const holdings = [holding("VOO"), holding("VOOG")];

    expect(resolveHoldingsByName(holdings, "voo")).toEqual([holding("VOO")]);
  });

  it("falls back to substring when nothing matches exactly", () => {
    const holdings = [holding("Apple Inc")];

    expect(resolveHoldingsByName(holdings, "apple")).toEqual([
      holding("Apple Inc"),
    ]);
  });

  it("refuses a substring match against more than one distinct holding", () => {
    const holdings = [holding("Apple Inc"), holding("Apple Hospitality REIT")];

    expect(() => resolveHoldingsByName(holdings, "Apple")).toThrow(
      /matches more than one holding/
    );
  });

  it("returns nothing for a name matching neither exactly nor as a substring", () => {
    const holdings = [holding("VOO")];

    expect(resolveHoldingsByName(holdings, "TLV125")).toEqual([]);
  });

  it("returns nothing for a blank name without matching every holding", () => {
    const holdings = [holding("VOO"), holding("VOOG")];

    expect(resolveHoldingsByName(holdings, "   ")).toEqual([]);
  });

  it("returns every exact match when the same name is held on more than one platform", () => {
    const holdings = [holding("VOO"), holding("VOO")];

    expect(resolveHoldingsByName(holdings, "VOO")).toHaveLength(2);
  });
});
