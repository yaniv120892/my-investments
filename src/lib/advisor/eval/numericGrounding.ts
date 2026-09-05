import type {
  GroundingReport,
  UngroundedNumber,
} from "@/lib/advisor/eval/numericGrounding.types";

export type {
  GroundingReport,
  UngroundedNumber,
} from "@/lib/advisor/eval/numericGrounding.types";

const NUMERAL_PATTERN = /-?\d[\d,]*(?:\.\d+)?/g;

/**
 * A reply figure counts as grounded if some tool figure is within this much of
 * it, which absorbs the rounding the model does when it writes an amount out.
 */
const RELATIVE_TOLERANCE = 0.005;
const ABSOLUTE_TOLERANCE = 1;

/**
 * Numbers small enough to be prose rather than portfolio figures — a count of
 * holdings, "the first two", "over 3 months" — and four-digit years. Left alone
 * so ordinary sentences do not read as fabrication.
 */
const PROSE_INTEGER_CEILING = 31;
const EARLIEST_YEAR = 1900;
const LATEST_YEAR = 2100;

/**
 * The advisor's core invariant is that every figure it states came from a tool
 * result. That is mechanically checkable, so it is checked rather than trusted.
 *
 * Deliberately lenient: it catches a fabricated figure, not a slightly stale
 * one. A false alarm on a real answer is worse than missing a rounding drift.
 */
export function checkNumericGrounding(
  replyText: string,
  toolResults: unknown[]
): GroundingReport {
  const toolNumbers = collectNumbers(toolResults);
  const ungrounded: UngroundedNumber[] = [];

  for (const match of replyText.matchAll(NUMERAL_PATTERN)) {
    const text = match[0];
    const value = toNumber(text);
    if (value === null || isProseNumber(value)) {
      continue;
    }
    if (!toolNumbers.some((toolNumber) => isNear(value, toolNumber))) {
      ungrounded.push({ text, value });
    }
  }

  return {
    isGrounded: ungrounded.length === 0,
    ungrounded,
    toolNumberCount: toolNumbers.length,
  };
}

export function collectNumbers(value: unknown): number[] {
  const numbers: number[] = [];
  gatherNumbers(value, numbers);
  return numbers;
}

function gatherNumbers(value: unknown, into: number[]): void {
  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      into.push(value);
    }
    return;
  }

  if (typeof value === "string") {
    // Tool results carry pre-formatted money ("₪78,200") beside raw numbers,
    // and the model quotes the formatted form.
    for (const match of value.matchAll(NUMERAL_PATTERN)) {
      const parsed = toNumber(match[0]);
      if (parsed !== null) {
        into.push(parsed);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      gatherNumbers(item, into);
    }
    return;
  }

  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) {
      gatherNumbers(item, into);
    }
  }
}

function isNear(replyNumber: number, toolNumber: number): boolean {
  const tolerance = Math.max(
    ABSOLUTE_TOLERANCE,
    Math.abs(toolNumber) * RELATIVE_TOLERANCE
  );
  return Math.abs(replyNumber - toolNumber) <= tolerance;
}

function isProseNumber(value: number): boolean {
  const isSmallCount =
    Number.isInteger(value) && value >= 0 && value <= PROSE_INTEGER_CEILING;
  const isYear =
    Number.isInteger(value) && value >= EARLIEST_YEAR && value <= LATEST_YEAR;
  return isSmallCount || isYear;
}

function toNumber(text: string): number | null {
  const parsed = Number(text.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
