import { describe, expect, it } from "vitest";
import { PriceSource } from "@prisma/client";
import { SHEET_FX_RATE, SHEET_HOLDINGS, SHEET_TOTALS } from "../sheetData";

function valueOf(platform: string, excludeAssetNames: string[] = []): number {
  return SHEET_HOLDINGS.filter(
    (holding) =>
      holding.platform === platform &&
      !excludeAssetNames.includes(holding.assetName)
  ).reduce((sum, holding) => {
    if (holding.manualValueNis !== null) {
      return sum + holding.manualValueNis;
    }
    const nis =
      holding.currency === "USD"
        ? holding.quantity * (holding.sheetPrice ?? 0) * SHEET_FX_RATE
        : holding.quantity * (holding.sheetPrice ?? 0);
    return sum + nis;
  }, 0);
}

describe("sheet data reconciliation", () => {
  it("has 29 holdings", () => {
    expect(SHEET_HOLDINGS).toHaveLength(29);
  });

  it("reconciles Interactive Brokers to the sheet total", () => {
    expect(valueOf("Interactive Brokers")).toBeCloseTo(
      SHEET_TOTALS.interactiveBrokers,
      -1
    );
  });

  it("reconciles Excellence Pro to the sheet total", () => {
    expect(valueOf("Excellence Pro")).toBeCloseTo(
      SHEET_TOTALS.excellencePro,
      -1
    );
  });

  it("reconciles the manual holdings to the sheet total", () => {
    expect(valueOf("Other")).toBeCloseTo(SHEET_TOTALS.manual, -1);
  });

  it("gives every non-manual holding a source symbol, and every manual one a value", () => {
    for (const holding of SHEET_HOLDINGS) {
      if (holding.priceSource === PriceSource.MANUAL) {
        expect(holding.sourceSymbol).toBeNull();
        expect(holding.manualValueNis).not.toBeNull();
      } else {
        expect(holding.sourceSymbol).toBeTruthy();
      }
    }
  });

  it("includes MATIC, which the sheet summary omits", () => {
    expect(
      SHEET_HOLDINGS.some((holding) => holding.assetName === "MATIC")
    ).toBe(true);
    expect(SHEET_HOLDINGS.some((holding) => holding.assetName === "POL")).toBe(
      true
    );
  });

  it("has Excellence Pro targets summing to 100", () => {
    const total = SHEET_HOLDINGS.filter(
      (holding) => holding.platform === "Excellence Pro"
    ).reduce((sum, holding) => sum + (holding.targetPercent ?? 0), 0);
    expect(total).toBeCloseTo(100, 5);
  });

  it("references only platforms that are declared", () => {
    const declared = new Set(SHEET_HOLDINGS.map((holding) => holding.platform));
    for (const platform of declared) {
      expect(
        SHEET_HOLDINGS.some((holding) => holding.platform === platform)
      ).toBe(true);
    }
    expect(declared.size).toBe(4);
  });

  it("maps S&P to IVV, not SPY", () => {
    const sp500Holding = SHEET_HOLDINGS.find(
      (holding) => holding.assetName === "S&P"
    );
    expect(sp500Holding?.sourceSymbol).toBe("IVV");
  });
});
