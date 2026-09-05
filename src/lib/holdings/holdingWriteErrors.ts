import { describeFieldErrors } from "@/lib/validation/zodFieldErrors";
import type { FieldErrorMap } from "@/lib/holdings/holdingWrite.types";

export class HoldingValidationError extends Error {
  public readonly fieldErrors: FieldErrorMap;

  public constructor(fieldErrors: FieldErrorMap) {
    super(`Request is invalid (${describeFieldErrors(fieldErrors)})`);
    this.name = "HoldingValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export class HoldingNotFoundError extends Error {
  public constructor(holdingId: string) {
    super(`No holding of yours exists with that id (holdingId: ${holdingId})`);
    this.name = "HoldingNotFoundError";
  }
}

export class PlatformNotFoundError extends Error {
  public readonly fieldErrors: FieldErrorMap;

  public constructor(platformId: string) {
    super(
      `No platform of yours exists with that id (platformId: ${platformId})`
    );
    this.name = "PlatformNotFoundError";
    this.fieldErrors = {
      platformId: `No platform of yours exists with that id (platformId: ${platformId})`,
    };
  }
}

export class PlatformNameConflictError extends Error {
  public readonly fieldErrors: FieldErrorMap;

  public constructor(name: string) {
    super(`You already have a platform with that name (name: ${name})`);
    this.name = "PlatformNameConflictError";
    this.fieldErrors = {
      name: `You already have a platform with that name (name: ${name})`,
    };
  }
}
