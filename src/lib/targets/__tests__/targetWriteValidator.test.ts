import { describe, expect, it } from "vitest";
import { AssetClass } from "@prisma/client";
import { TargetWriteValidator } from "@/lib/targets/targetWriteValidator";
import { TargetValidationError } from "@/lib/targets/targetWriteErrors";
import type { ClassTargetInput } from "@/lib/targets/target.types";

const validator = new TargetWriteValidator();

function buildTargets(
  equity: number,
  crypto: number,
  nonEquity: number
): ClassTargetInput[] {
  return [
    { assetClass: AssetClass.EQUITY, targetPercent: equity },
    { assetClass: AssetClass.CRYPTO, targetPercent: crypto },
    { assetClass: AssetClass.NON_EQUITY, targetPercent: nonEquity },
  ];
}

function fieldErrorsOf(run: () => void): Record<string, string> {
  try {
    run();
  } catch (error) {
    if (error instanceof TargetValidationError) {
      return error.fieldErrors;
    }
    throw error;
  }
  throw new Error("Expected a TargetValidationError");
}

describe("TargetWriteValidator", () => {
  it("accepts targets that sum to exactly 100", () => {
    expect(() =>
      validator.assertClassTargetsAreComplete(buildTargets(70, 10, 20))
    ).not.toThrow();
  });

  it("accepts a sum inside the rounding tolerance on both sides", () => {
    expect(() =>
      validator.assertClassTargetsAreComplete(buildTargets(70.005, 10, 20))
    ).not.toThrow();
    expect(() =>
      validator.assertClassTargetsAreComplete(buildTargets(69.995, 10, 20))
    ).not.toThrow();
  });

  it("rejects a sum outside the tolerance", () => {
    const fieldErrors = fieldErrorsOf(() =>
      validator.assertClassTargetsAreComplete(buildTargets(70, 10, 19.5))
    );

    expect(fieldErrors.classTargets).toContain("100");
  });

  it("rejects a missing asset class by name", () => {
    const fieldErrors = fieldErrorsOf(() =>
      validator.assertClassTargetsAreComplete([
        { assetClass: AssetClass.EQUITY, targetPercent: 80 },
        { assetClass: AssetClass.CRYPTO, targetPercent: 20 },
      ])
    );

    expect(fieldErrors[AssetClass.NON_EQUITY]).toBeDefined();
  });

  it("rejects a negative target", () => {
    const fieldErrors = fieldErrorsOf(() =>
      validator.assertClassTargetsAreComplete(buildTargets(110, -10, 0))
    );

    expect(fieldErrors[AssetClass.CRYPTO]).toContain("negative");
  });

  it("rejects a duplicated asset class", () => {
    const fieldErrors = fieldErrorsOf(() =>
      validator.assertClassTargetsAreComplete([
        { assetClass: AssetClass.EQUITY, targetPercent: 50 },
        { assetClass: AssetClass.EQUITY, targetPercent: 30 },
        { assetClass: AssetClass.CRYPTO, targetPercent: 10 },
        { assetClass: AssetClass.NON_EQUITY, targetPercent: 10 },
      ])
    );

    expect(fieldErrors[AssetClass.EQUITY]).toContain("more than once");
  });

  it("rejects a weight on a holding that is not liquid or not yours, keyed by its id", () => {
    const fieldErrors = fieldErrorsOf(() =>
      validator.assertHoldingsAreLiquidAndOwned(
        [{ holdingId: "pension-1", withinClassWeight: 1 }],
        new Set(["liquid-1"])
      )
    );

    expect(fieldErrors["pension-1"]).toContain("pension-1");
  });

  it("accepts a null weight on a liquid holding", () => {
    expect(() =>
      validator.assertHoldingsAreLiquidAndOwned(
        [{ holdingId: "liquid-1", withinClassWeight: null }],
        new Set(["liquid-1"])
      )
    ).not.toThrow();
  });

  it("rejects a negative weight", () => {
    const fieldErrors = fieldErrorsOf(() =>
      validator.assertHoldingsAreLiquidAndOwned(
        [{ holdingId: "liquid-1", withinClassWeight: -1 }],
        new Set(["liquid-1"])
      )
    );

    expect(fieldErrors["liquid-1"]).toContain("negative");
  });
});
