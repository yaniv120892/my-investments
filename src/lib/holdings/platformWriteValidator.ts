import type { HoldingRepository } from "@/lib/holdings/holdingRepository";
import { holdingRepository } from "@/lib/holdings/holdingRepository";
import {
  HoldingValidationError,
  PlatformNameConflictError,
} from "@/lib/holdings/holdingWriteErrors";
import type {
  CreatePlatformInput,
  FieldErrorMap,
} from "@/lib/holdings/holdingWrite.types";
import {
  SUPPORTED_CURRENCIES,
  isSupportedCurrency,
} from "@/lib/pricing/supportedCurrencies";

export class PlatformWriteValidator {
  public constructor(
    private readonly repository: HoldingRepository = holdingRepository
  ) {}

  public async assertCanCreatePlatform(
    userId: string,
    input: CreatePlatformInput
  ): Promise<void> {
    const fieldErrors = this.collectFieldErrors(input);
    if (Object.keys(fieldErrors).length > 0) {
      throw new HoldingValidationError(fieldErrors);
    }

    const existingPlatform = await this.repository.findPlatformByName(
      userId,
      input.name
    );
    if (existingPlatform) {
      throw new PlatformNameConflictError(input.name);
    }
  }

  private collectFieldErrors(input: CreatePlatformInput): FieldErrorMap {
    const fieldErrors: FieldErrorMap = {};

    if (input.name.trim().length === 0) {
      fieldErrors.name = "Platform name cannot be empty";
    }

    if (!isSupportedCurrency(input.baseCurrency)) {
      fieldErrors.baseCurrency = `Base currency must be one of ${SUPPORTED_CURRENCIES.join(
        ", "
      )} (received: ${input.baseCurrency})`;
    }

    return fieldErrors;
  }
}

export const platformWriteValidator = new PlatformWriteValidator();
