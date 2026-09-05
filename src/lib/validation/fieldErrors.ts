import type { FieldErrorMap } from "@/lib/validation/fieldErrors.types";

export type { FieldErrorMap } from "@/lib/validation/fieldErrors.types";

/**
 * Every rejected write answers 400 with a map keyed by the input that raised
 * it, so a form can put the message back on the field. Sharing the base is what
 * lets one `instanceof` cover every module that throws one.
 */
export abstract class FieldValidationError extends Error {
  public readonly fieldErrors: FieldErrorMap;

  protected constructor(summary: string, fieldErrors: FieldErrorMap) {
    super(`${summary} (${describeFieldErrors(fieldErrors)})`);
    this.fieldErrors = fieldErrors;
  }
}

export function describeFieldErrors(fieldErrors: FieldErrorMap): string {
  return Object.entries(fieldErrors)
    .map(([field, message]) => `${field}: ${message}`)
    .join("; ");
}
