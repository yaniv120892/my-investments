import type { Holding } from "@prisma/client";
import type { HoldingRepository } from "@/lib/holdings/holdingRepository";
import { holdingRepository } from "@/lib/holdings/holdingRepository";
import type { HoldingWriteValidator } from "@/lib/holdings/holdingWriteValidator";
import { holdingWriteValidator } from "@/lib/holdings/holdingWriteValidator";
import {
  mergeHoldingWriteState,
  toHoldingWriteState,
} from "@/lib/holdings/holdingWriteState";
import type {
  CreateHoldingInput,
  HoldingUpdateData,
  HoldingWithPlatform,
  ManualValueEntry,
  UpdateHoldingInput,
} from "@/lib/holdings/holdingWrite.types";

export class HoldingWriteService {
  public constructor(
    private readonly repository: HoldingRepository = holdingRepository,
    private readonly validator: HoldingWriteValidator = holdingWriteValidator
  ) {}

  public async createHolding(
    userId: string,
    input: CreateHoldingInput
  ): Promise<HoldingWithPlatform> {
    await this.validator.assertCanCreateHolding(userId, input);

    const state = toHoldingWriteState(input);
    return this.repository.createHolding(userId, {
      ...state,
      manualValueUpdatedAt: this.resolveManualValueTimestamp(
        state.manualValueNis
      ),
    });
  }

  public async updateHolding(
    userId: string,
    holdingId: string,
    input: UpdateHoldingInput
  ): Promise<HoldingWithPlatform> {
    const existingHolding = await this.validator.assertCanUpdateHolding(
      userId,
      holdingId,
      input
    );

    return this.repository.updateHolding(
      userId,
      holdingId,
      this.buildUpdateData(existingHolding, input)
    );
  }

  /**
   * Confirming a balance always re-stamps manualValueUpdatedAt, even when the
   * number has not moved — the owner is asserting what the statement says
   * today, and a fund that happens to sit at the same shekel is still fresh.
   * The general edit path deliberately does the opposite: renaming an asset
   * must not pass a stale value off as a fresh reading.
   *
   * One timestamp covers the whole review, so a month's confirmations share a
   * date rather than fanning out over however long the form was open.
   */
  public async recordManualValues(
    userId: string,
    entries: ManualValueEntry[]
  ): Promise<Date> {
    await this.validator.assertCanRecordManualValues(userId, entries);

    const confirmedAt = new Date();
    await this.repository.recordManualValues(userId, entries, confirmedAt);
    return confirmedAt;
  }

  public async deleteHolding(userId: string, holdingId: string): Promise<void> {
    await this.validator.assertCanDeleteHolding(userId, holdingId);
    await this.repository.deleteHoldingWithSnapshots(userId, holdingId);
  }

  private buildUpdateData(
    existingHolding: Holding,
    input: UpdateHoldingInput
  ): HoldingUpdateData {
    const nextState = mergeHoldingWriteState(existingHolding, input);
    const isManualValueUnchanged =
      nextState.manualValueNis === existingHolding.manualValueNis;
    if (isManualValueUnchanged) {
      return nextState;
    }

    return {
      ...nextState,
      manualValueUpdatedAt: this.resolveManualValueTimestamp(
        nextState.manualValueNis
      ),
    };
  }

  private resolveManualValueTimestamp(
    manualValueNis: number | null
  ): Date | null {
    if (manualValueNis === null) {
      return null;
    }
    return new Date();
  }
}

export const holdingWriteService = new HoldingWriteService();
