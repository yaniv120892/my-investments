import { z } from "zod";
import { AssetClass } from "@prisma/client";
import { TargetValidationError } from "@/lib/targets/targetWriteErrors";
import { toFieldErrors } from "@/lib/validation/zodFieldErrors";
import type { ReplaceTargetsInput } from "@/lib/targets/target.types";

/**
 * Weights are keyed by holding for the same reason manual values are: the key
 * is the only stable name a field error can carry back to the row that raised it.
 */
const replaceTargetsSchema = z.strictObject({
  classTargets: z.record(
    z.enum(AssetClass),
    z.number({ error: "A target must be a number of percent" })
  ),
  withinClassWeights: z.record(
    z.string().min(1, "A holding must be identified"),
    z.number({ error: "A weight must be a number" }).nullable()
  ),
});

export function parseReplaceTargetsBody(body: unknown): ReplaceTargetsInput {
  const result = replaceTargetsSchema.safeParse(body);
  if (!result.success) {
    throw new TargetValidationError(toFieldErrors(result.error, body));
  }

  return {
    classTargets: Object.entries(result.data.classTargets).map(
      ([assetClass, targetPercent]) => ({
        assetClass: toAssetClass(assetClass),
        targetPercent,
      })
    ),
    withinClassWeights: Object.entries(result.data.withinClassWeights).map(
      ([holdingId, withinClassWeight]) => ({ holdingId, withinClassWeight })
    ),
  };
}

function toAssetClass(value: string): AssetClass {
  const assetClass = Object.values(AssetClass).find(
    (member) => member === value
  );
  if (!assetClass) {
    throw new TargetValidationError({
      [value]: `Not a known asset class (assetClass: ${value})`,
    });
  }
  return assetClass;
}
