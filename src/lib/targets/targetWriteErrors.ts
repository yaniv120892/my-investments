import { FieldValidationError } from "@/lib/validation/fieldErrors";
import type { FieldErrorMap } from "@/lib/validation/fieldErrors.types";

export class TargetValidationError extends FieldValidationError {
  public constructor(fieldErrors: FieldErrorMap) {
    super("Targets are invalid", fieldErrors);
    this.name = "TargetValidationError";
  }
}
