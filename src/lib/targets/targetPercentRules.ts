export const TOTAL_TARGET_PERCENT = 100;

/** Absorbs the rounding a percent split picks up in the form, not a real drift. */
export const TARGET_SUM_TOLERANCE = 0.01;

export function isTargetSumBalanced(targetSum: number): boolean {
  return Math.abs(targetSum - TOTAL_TARGET_PERCENT) <= TARGET_SUM_TOLERANCE;
}
