import type {
  AssetClass,
  Holding,
  Liquidity,
  Platform,
  PriceSource,
} from "@prisma/client";

export type FieldErrorMap = Record<string, string>;

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
