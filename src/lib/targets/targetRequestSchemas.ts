import { z } from "zod";
import { AssetClass } from "@prisma/client";
import { TargetValidationError } from "@/lib/targets/targetWriteErrors";
import { toFieldErrors } from "@/lib/validation/zodFieldErrors";
import type { ReplaceTargetsInput } from "@/lib/targets/target.types";
import type { FieldErrorMap } from "@/lib/validation/fieldErrors.types";

/**
 * Weights are keyed by holding for the same reason manual values are: the key
 * is the only stable name a field error can carry back to the row that raised it.
 */
const replaceTargetsSchema = z.strictObject({
  // partialRecord, not record: a plain record over an enum is exhaustive, so a
  // missing class would fail here keyed `classTargets.NON_EQUITY` — a key no
  // form field carries. The validator reports it keyed by the class itself.
  classTargets: z.partialRecord(
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
    // zod keys a nested issue `classTargets.EQUITY`, but the form's inputs are
    // named for the class and the holding alone, so the prefix is dropped —
    // otherwise a malformed value reports under a key no field carries.
    throw new TargetValidationError(
      stripSectionPrefix(toFieldErrors(result.error, body))
    );
  }

  // Driven off the enum rather than the body's keys, so `assetClass` is typed
  // without widening back from `string`.
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

function stripSectionPrefix(fieldErrors: FieldErrorMap): FieldErrorMap {
  const stripped: FieldErrorMap = {};

  for (const [field, message] of Object.entries(fieldErrors)) {
    const [section, ...rest] = field.split(".");
    const isSectioned =
      rest.length > 0 &&
      (section === "classTargets" || section === "withinClassWeights");
    stripped[isSectioned ? rest.join(".") : field] = message;
  }
  return stripped;
}
