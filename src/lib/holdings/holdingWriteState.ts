import type { Holding } from "@prisma/client";
import type {
  CreateHoldingInput,
  HoldingWriteState,
  UpdateHoldingInput,
} from "@/lib/holdings/holdingWrite.types";

export function toHoldingWriteState(
  input: CreateHoldingInput
): HoldingWriteState {
  return {
    platformId: input.platformId,
    assetName: input.assetName,
    assetClass: input.assetClass,
    liquidity: input.liquidity,
    quantity: input.quantity,
    priceSource: input.priceSource,
    sourceSymbol: input.sourceSymbol ?? null,
    currency: input.currency,
    targetPercent: input.targetPercent ?? null,
    manualValueNis: input.manualValueNis ?? null,
  };
}

export function mergeHoldingWriteState(
  existing: Holding,
  input: UpdateHoldingInput
): HoldingWriteState {
  const priceSource = input.priceSource ?? existing.priceSource;
  const priceSourceChanged = priceSource !== existing.priceSource;

  return {
    platformId: input.platformId ?? existing.platformId,
    assetName: input.assetName ?? existing.assetName,
    assetClass: input.assetClass ?? existing.assetClass,
    liquidity: input.liquidity ?? existing.liquidity,
    quantity: input.quantity ?? existing.quantity,
    priceSource,
    sourceSymbol: resolveSourceBoundField(
      input.sourceSymbol,
      existing.sourceSymbol,
      priceSourceChanged
    ),
    currency: input.currency ?? existing.currency,
    targetPercent:
      input.targetPercent === undefined
        ? existing.targetPercent
        : input.targetPercent,
    manualValueNis: resolveSourceBoundField(
      input.manualValueNis,
      existing.manualValueNis,
      priceSourceChanged
    ),
  };
}

function resolveSourceBoundField<T>(
  providedValue: T | null | undefined,
  existingValue: T | null,
  priceSourceChanged: boolean
): T | null {
  if (providedValue !== undefined) {
    return providedValue;
  }
  if (priceSourceChanged) {
    return null;
  }
  return existingValue;
}
