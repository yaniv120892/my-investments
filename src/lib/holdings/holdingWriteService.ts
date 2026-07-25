import type { Holding } from "@prisma/client";
import {
  HoldingRepository,
  holdingRepository,
} from "@/lib/holdings/holdingRepository";
import {
  HoldingWriteValidator,
  holdingWriteValidator,
} from "@/lib/holdings/holdingWriteValidator";
import {
  mergeHoldingWriteState,
  toHoldingWriteState,
} from "@/lib/holdings/holdingWriteState";
import type {
  CreateHoldingInput,
  HoldingUpdateData,
  HoldingWithPlatform,
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

  public async deleteHolding(
    userId: string,
    holdingId: string
  ): Promise<void> {
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

  private resolveManualValueTimestamp(manualValueNis: number | null): Date | null {
    if (manualValueNis === null) {
      return null;
    }
    return new Date();
  }
}

export const holdingWriteService = new HoldingWriteService();
