import type {
  AssetClass,
  Holding,
  Liquidity,
  Platform,
  PriceSource,
} from "@prisma/client";

export type { FieldErrorMap } from "@/lib/validation/zodFieldErrors.types";

export type HoldingWithPlatform = Holding & { platform: Platform };

export interface HoldingWriteState {
  platformId: string;
  assetName: string;
  assetClass: AssetClass;
  liquidity: Liquidity;
  quantity: number;
  priceSource: PriceSource;
  sourceSymbol: string | null;
  currency: string;
  targetPercent: number | null;
  manualValueNis: number | null;
}

export interface CreateHoldingInput {
  platformId: string;
  assetName: string;
  assetClass: AssetClass;
  liquidity: Liquidity;
  quantity: number;
  priceSource: PriceSource;
  sourceSymbol?: string | null;
  currency: string;
  targetPercent?: number | null;
  manualValueNis?: number | null;
}

export type UpdateHoldingInput = Partial<CreateHoldingInput>;

/**
 * One line of a manual-value review: the balance the owner has just read off a
 * statement. Carries no other field, because confirming a balance is not an
 * edit of the holding.
 */
export interface ManualValueEntry {
  holdingId: string;
  manualValueNis: number;
}

export interface CreatePlatformInput {
  name: string;
  baseCurrency: string;
}

export interface HoldingPersistenceData extends HoldingWriteState {
  manualValueUpdatedAt: Date | null;
}

export type HoldingUpdateData = HoldingWriteState & {
  manualValueUpdatedAt?: Date | null;
};
