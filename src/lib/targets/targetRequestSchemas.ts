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

  // Driven off the enum rather than the body's keys, so `assetClass` is typed
  // without widening back from `string`. A class the body omits is left out,
  // and the validator is what names it as missing.
  return {
    classTargets: Object.values(AssetClass).flatMap((assetClass) => {
      const targetPercent = result.data.classTargets[assetClass];
      return targetPercent === undefined ? [] : [{ assetClass, targetPercent }];
    }),
    withinClassWeights: Object.entries(result.data.withinClassWeights).map(
      ([holdingId, withinClassWeight]) => ({ holdingId, withinClassWeight })
    ),
  };
}
