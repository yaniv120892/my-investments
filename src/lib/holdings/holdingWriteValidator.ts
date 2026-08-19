import { PriceSource } from "@prisma/client";
import type { Holding } from "@prisma/client";
import {
  HoldingRepository,
  holdingRepository,
} from "@/lib/holdings/holdingRepository";
import {
  HoldingNotFoundError,
  HoldingValidationError,
  PlatformNotFoundError,
} from "@/lib/holdings/holdingWriteErrors";
import {
  mergeHoldingWriteState,
  toHoldingWriteState,
} from "@/lib/holdings/holdingWriteState";
import type {
  CreateHoldingInput,
  FieldErrorMap,
  HoldingWriteState,
  UpdateHoldingInput,
} from "@/lib/holdings/holdingWrite.types";
import {
  SUPPORTED_CURRENCIES,
  isSupportedCurrency,
} from "@/lib/pricing/supportedCurrencies";

const REQUIRES_SOURCE_SYMBOL = {
  [PriceSource.FINNHUB]: true,
  [PriceSource.BINANCE]: true,
  [PriceSource.YAHOO]: true,
  [PriceSource.MAYA]: true,
  [PriceSource.MANUAL]: false,
} satisfies Record<PriceSource, boolean>;

export class HoldingWriteValidator {
  public constructor(
    private readonly repository: HoldingRepository = holdingRepository
  ) {}

  public async assertCanCreateHolding(
    userId: string,
    input: CreateHoldingInput
  ): Promise<void> {
    await this.assertStateIsValid(userId, toHoldingWriteState(input));
  }

  public async assertCanUpdateHolding(
    userId: string,
    holdingId: string,
    input: UpdateHoldingInput
  ): Promise<Holding> {
    const existingHolding = await this.loadOwnedHolding(userId, holdingId);
    await this.assertStateIsValid(
      userId,
      mergeHoldingWriteState(existingHolding, input)
    );
    return existingHolding;
  }

  public async assertCanDeleteHolding(
    userId: string,
    holdingId: string
  ): Promise<Holding> {
    return this.loadOwnedHolding(userId, holdingId);
  }

  private async assertStateIsValid(
    userId: string,
    state: HoldingWriteState
  ): Promise<void> {
    const fieldErrors = this.collectFieldErrors(state);
    if (Object.keys(fieldErrors).length > 0) {
      throw new HoldingValidationError(fieldErrors);
    }
    await this.assertPlatformIsOwned(userId, state.platformId);
  }

  private collectFieldErrors(state: HoldingWriteState): FieldErrorMap {
    const fieldErrors: FieldErrorMap = {};

    if (state.assetName.trim().length === 0) {
      fieldErrors.assetName = "Asset name cannot be empty";
    }

    if (!Number.isFinite(state.quantity)) {
      fieldErrors.quantity = `Quantity must be a finite number (received: ${state.quantity})`;
    } else if (state.quantity < 0) {
      fieldErrors.quantity = `Quantity cannot be negative (received: ${state.quantity})`;
    }

    if (!isSupportedCurrency(state.currency)) {
      fieldErrors.currency = `Currency must be one of ${SUPPORTED_CURRENCIES.join(
        ", "
      )} (received: ${state.currency})`;
    }

    this.collectTargetPercentError(state, fieldErrors);
    this.collectPriceSourceErrors(state, fieldErrors);

    return fieldErrors;
  }

  private collectTargetPercentError(
    state: HoldingWriteState,
    fieldErrors: FieldErrorMap
  ): void {
    if (state.targetPercent === null) {
      return;
    }
    const isWithinBounds =
      Number.isFinite(state.targetPercent) &&
      state.targetPercent >= 0 &&
      state.targetPercent <= 100;
    if (!isWithinBounds) {
      fieldErrors.targetPercent = `Target percent must be between 0 and 100 (received: ${state.targetPercent})`;
    }
  }

  private collectPriceSourceErrors(
    state: HoldingWriteState,
    fieldErrors: FieldErrorMap
  ): void {
    if (REQUIRES_SOURCE_SYMBOL[state.priceSource]) {
      this.collectMarketPricedErrors(state, fieldErrors);
      return;
    }
    this.collectManuallyPricedErrors(state, fieldErrors);
  }

  private collectMarketPricedErrors(
    state: HoldingWriteState,
    fieldErrors: FieldErrorMap
  ): void {
    if (
      state.sourceSymbol === null ||
      state.sourceSymbol.trim().length === 0
    ) {
      fieldErrors.sourceSymbol = `A source symbol is required for price source ${state.priceSource}`;
    }
    if (state.manualValueNis !== null) {
      fieldErrors.manualValueNis = `A manual value cannot be stored for price source ${state.priceSource} (received: ${state.manualValueNis})`;
    }
  }

  private collectManuallyPricedErrors(
    state: HoldingWriteState,
    fieldErrors: FieldErrorMap
  ): void {
    if (state.manualValueNis === null) {
      fieldErrors.manualValueNis = `A manual value in NIS is required for price source ${PriceSource.MANUAL}`;
    } else if (!Number.isFinite(state.manualValueNis)) {
      fieldErrors.manualValueNis = `Manual value must be a finite number (received: ${state.manualValueNis})`;
    } else if (state.manualValueNis < 0) {
      fieldErrors.manualValueNis = `Manual value cannot be negative (received: ${state.manualValueNis})`;
    }
    if (state.sourceSymbol !== null) {
      fieldErrors.sourceSymbol = `A source symbol cannot be stored for price source ${PriceSource.MANUAL} (received: ${state.sourceSymbol})`;
    }
  }

  private async assertPlatformIsOwned(
    userId: string,
    platformId: string
  ): Promise<void> {
    const platform = await this.repository.findPlatformOwnedBy(
      userId,
      platformId
    );
    if (!platform) {
      throw new PlatformNotFoundError(platformId);
    }
  }

  private async loadOwnedHolding(
    userId: string,
    holdingId: string
  ): Promise<Holding> {
    const holding = await this.repository.findHoldingOwnedBy(
      userId,
      holdingId
    );
    if (!holding) {
      throw new HoldingNotFoundError(holdingId);
    }
    return holding;
  }
}

export const holdingWriteValidator = new HoldingWriteValidator();
