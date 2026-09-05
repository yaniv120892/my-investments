import { AssetClass } from "@prisma/client";
import { TargetValidationError } from "@/lib/targets/targetWriteErrors";
import {
  TOTAL_TARGET_PERCENT,
  isTargetSumBalanced,
  sumTargetPercent,
} from "@/lib/targets/targetPercentRules";
import type {
  ClassTargetInput,
  WithinClassWeightEntry,
} from "@/lib/targets/target.types";
import type { FieldErrorMap } from "@/lib/validation/fieldErrors.types";

export class TargetWriteValidator {
  public assertClassTargetsAreComplete(classTargets: ClassTargetInput[]): void {
    const fieldErrors = this.collectClassTargetErrors(classTargets);
    if (Object.keys(fieldErrors).length > 0) {
      throw new TargetValidationError(fieldErrors);
    }
  }

  public assertHoldingsAreLiquidAndOwned(
    entries: WithinClassWeightEntry[],
    liquidHoldingIds: Set<string>
  ): void {
    const fieldErrors: FieldErrorMap = {};

    // Ownership is reported ahead of shape: a weight on someone else's holding
    // is the more serious of the two, and both share one field key.
    for (const entry of entries) {
      if (!liquidHoldingIds.has(entry.holdingId)) {
        fieldErrors[entry.holdingId] =
          `No liquid holding of yours exists with that id, so it cannot carry a weight (holdingId: ${entry.holdingId})`;
        continue;
      }
      const isNegative =
        entry.withinClassWeight !== null && entry.withinClassWeight < 0;
      if (isNegative) {
        fieldErrors[entry.holdingId] =
          `A weight cannot be negative (weight: ${entry.withinClassWeight})`;
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new TargetValidationError(fieldErrors);
    }
  }

  private collectClassTargetErrors(
    classTargets: ClassTargetInput[]
  ): FieldErrorMap {
    const fieldErrors: FieldErrorMap = {};
    const provided = new Set<AssetClass>();

    for (const target of classTargets) {
      if (target.targetPercent < 0) {
        fieldErrors[target.assetClass] =
          `A target cannot be negative (target: ${target.targetPercent})`;
      }
      provided.add(target.assetClass);
    }

    for (const assetClass of Object.values(AssetClass)) {
      if (!provided.has(assetClass)) {
        fieldErrors[assetClass] =
          `Every asset class needs a target, even a zero one (assetClass: ${assetClass})`;
      }
    }

    const targetSum = sumTargetPercent(classTargets);
    if (!isTargetSumBalanced(targetSum)) {
      fieldErrors.classTargets = `Targets must sum to ${TOTAL_TARGET_PERCENT}, not ${targetSum}`;
    }

    return fieldErrors;
  }
}

export const targetWriteValidator = new TargetWriteValidator();
