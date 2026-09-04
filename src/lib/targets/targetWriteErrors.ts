import type { FieldErrorMap } from "@/lib/validation/zodFieldErrors.types";

export class TargetValidationError extends Error {
  public readonly fieldErrors: FieldErrorMap;

  public constructor(fieldErrors: FieldErrorMap) {
    super(`Targets are invalid (${describeFieldErrors(fieldErrors)})`);
    this.name = "TargetValidationError";
    this.fieldErrors = fieldErrors;
  }
}

function describeFieldErrors(fieldErrors: FieldErrorMap): string {
  return Object.entries(fieldErrors)
    .map(([field, message]) => `${field}: ${message}`)
    .join("; ");
}
