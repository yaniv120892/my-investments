import { describe, expect, it } from "vitest";
import { checkNumericGrounding } from "@/lib/advisor/eval/numericGrounding";

const PLAN_TOOL_RESULT = {
  status: "planned",
  contributionFormatted: "₪50,000",
  byAssetClass: [
    {
      assetClass: "NON_EQUITY",
      currentPercent: 6.35,
      targetPercent: 20,
      addFormatted: "₪50,000",
      percentAfter: 9.23,
    },
    {
      assetClass: "CRYPTO",
      currentPercent: 6.99,
      targetPercent: 10,
      addFormatted: "₪0",
      percentAfter: 6.77,
    },
  ],
};

describe("checkNumericGrounding", () => {
  it("passes a reply whose figures all come from a tool result", () => {
    const report = checkNumericGrounding(
      "Put the whole ₪50,000 into non-equity: it sits at 6.35% against a 20% target.",
      [PLAN_TOOL_RESULT]
    );

    expect(report.isGrounded).toBe(true);
    expect(report.ungrounded).toEqual([]);
  });

  it("catches a figure no tool produced", () => {
    const report = checkNumericGrounding(
      "Put ₪37,500 into non-equity and ₪12,500 into crypto.",
      [PLAN_TOOL_RESULT]
    );

    expect(report.isGrounded).toBe(false);
    expect(report.ungrounded.map((entry) => entry.value)).toEqual([
      37_500, 12_500,
    ]);
  });

  it("catches a total the model computed for itself", () => {
    const report = checkNumericGrounding(
      "That leaves your portfolio at ₪1,624,185 once the money lands.",
      [PLAN_TOOL_RESULT]
    );

    expect(report.isGrounded).toBe(false);
  });

  it("tolerates the rounding the model does when writing an amount out", () => {
    const report = checkNumericGrounding("Add ₪173,311 to non-equity.", [
      { addNis: 173_310.6667 },
    ]);

    expect(report.isGrounded).toBe(true);
  });

  it("reads a figure out of a pre-formatted string, not just a raw number", () => {
    const report = checkNumericGrounding(
      "Your investable base is ₪1,574,185.",
      [{ investableValueFormatted: "₪1,574,185" }]
    );

    expect(report.isGrounded).toBe(true);
  });

  it("leaves dates, counts and small ordinals alone", () => {
    const report = checkNumericGrounding(
      "Over the 6 months to 2026, the first 3 of your 12 holdings drifted.",
      [PLAN_TOOL_RESULT]
    );

    expect(report.isGrounded).toBe(true);
  });

  it("still flags a fabricated figure inside an otherwise grounded reply", () => {
    const report = checkNumericGrounding(
      "Crypto sits at 6.99% of the investable base, worth about ₪880,000.",
      [PLAN_TOOL_RESULT]
    );

    expect(report.ungrounded.map((entry) => entry.value)).toEqual([880_000]);
  });

  it("does not read an ISO date as two negative figures", () => {
    const report = checkNumericGrounding(
      "As of 2026-09-05 the split is unchanged.",
      [PLAN_TOOL_RESULT]
    );

    expect(report.isGrounded).toBe(true);
  });

  it("does not read a range or a model name as a negative figure", () => {
    const report = checkNumericGrounding(
      "Over the next 2-3 months, running on gpt-4o.",
      [PLAN_TOOL_RESULT]
    );

    expect(report.isGrounded).toBe(true);
  });

  it("checks a small integer when it is a percentage", () => {
    const report = checkNumericGrounding("Crypto is 12% of the base.", [
      PLAN_TOOL_RESULT,
    ]);

    expect(report.isGrounded).toBe(false);
    expect(report.ungrounded.map((entry) => entry.value)).toEqual([12]);
  });

  it("accepts a percentage a tool actually returned", () => {
    const report = checkNumericGrounding("Non-equity sits at 20%.", [
      PLAN_TOOL_RESULT,
    ]);

    expect(report.isGrounded).toBe(true);
  });

  it("does not capture the separator after a figure", () => {
    const report = checkNumericGrounding("Add ₪50,000, then review.", [
      PLAN_TOOL_RESULT,
    ]);

    expect(report.isGrounded).toBe(true);
  });

  it("treats a reply with no figures as grounded", () => {
    const report = checkNumericGrounding(
      "I cannot plan that until every holding prices.",
      [PLAN_TOOL_RESULT]
    );

    expect(report.isGrounded).toBe(true);
  });

  it("flags every figure when no tool ran at all", () => {
    const report = checkNumericGrounding("Put ₪50,000 into equity.", []);

    expect(report.isGrounded).toBe(false);
    expect(report.toolNumberCount).toBe(0);
  });
});
