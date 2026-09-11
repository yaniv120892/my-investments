import { describe, expect, it } from "vitest";
import { AssetClass } from "@prisma/client";
import { parseReplaceTargetsBody } from "@/lib/targets/targetRequestSchemas";
import { TargetValidationError } from "@/lib/targets/targetWriteErrors";

function fieldErrorsOf(body: unknown): Record<string, string> {
  try {
    parseReplaceTargetsBody(body);
  } catch (error) {
    if (error instanceof TargetValidationError) {
      return error.fieldErrors;
    }
    throw error;
  }
  throw new Error("Expected a TargetValidationError");
}

describe("parseReplaceTargetsBody", () => {
  it("turns the wire records into the arrays the service writes", () => {
    const input = parseReplaceTargetsBody({
      classTargets: { EQUITY: 70, CRYPTO: 10, NON_EQUITY: 20 },
      withinClassWeights: { "holding-1": 2, "holding-2": null },
    });

    expect(input.classTargets).toEqual([
      { assetClass: AssetClass.EQUITY, targetPercent: 70 },
      { assetClass: AssetClass.CRYPTO, targetPercent: 10 },
      { assetClass: AssetClass.NON_EQUITY, targetPercent: 20 },
    ]);
    expect(input.withinClassWeights).toEqual([
      { holdingId: "holding-1", withinClassWeight: 2 },
      { holdingId: "holding-2", withinClassWeight: null },
    ]);
  });

  it("keys a malformed target by the class alone, the way the form names it", () => {
    const fieldErrors = fieldErrorsOf({
      classTargets: { EQUITY: "seventy" },
      withinClassWeights: {},
    });

    expect(fieldErrors[AssetClass.EQUITY]).toBeDefined();
    expect(fieldErrors["classTargets.EQUITY"]).toBeUndefined();
  });

  it("keys a malformed weight by the holding id alone", () => {
    const fieldErrors = fieldErrorsOf({
      classTargets: {},
      withinClassWeights: { "holding-1": "heavy" },
    });

    expect(fieldErrors["holding-1"]).toBeDefined();
    expect(fieldErrors["withinClassWeights.holding-1"]).toBeUndefined();
  });

  it("lets a missing class through, so the validator names it rather than zod", () => {
    const input = parseReplaceTargetsBody({
      classTargets: { EQUITY: 100 },
      withinClassWeights: {},
    });

    expect(input.classTargets).toHaveLength(1);
  });

  it("rejects a field that cannot be set", () => {
    expect(
      fieldErrorsOf({
        classTargets: {},
        withinClassWeights: {},
        userId: "someone-else",
      }).userId
    ).toBeDefined();
  });

  it("rejects a body that is not an object", () => {
    expect(fieldErrorsOf("nope")).toBeTruthy();
  });
});
