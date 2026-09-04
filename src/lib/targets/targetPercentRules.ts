export const TOTAL_TARGET_PERCENT = 100;

/** Absorbs the rounding a percent split picks up in the form, not a real drift. */
export const TARGET_SUM_TOLERANCE = 0.01;

export function sumTargetPercent(targets: { targetPercent: number }[]): number {
  return targets.reduce((total, target) => total + target.targetPercent, 0);
}

export function isTargetSumBalanced(targetSum: number): boolean {
  return Math.abs(targetSum - TOTAL_TARGET_PERCENT) <= TARGET_SUM_TOLERANCE;
}
