import type { AssetClass, Holding, Liquidity, Platform } from "@prisma/client";
import type { AllocationSlice } from "@/lib/pricing/allocation.types";
import type { PricingFailure } from "@/lib/pricing/portfolioPricingService.types";

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
}

export interface VerificationRequest {
  email: string;
  code: string;
}

export interface UserSettings {
  email: string;
  darkMode: boolean;
  baseCurrency: string;
}

/** The PATCH route echoes the settings row back, which carries no email. */
export interface StoredUserSettings {
  darkMode: boolean;
  baseCurrency: string;
}

export interface PlatformDrift {
  platformName: string;
  targetTotalPercent: number;
  slices: AllocationSlice[];
}

export type PricedHolding = Holding & {
  platform: Platform;
  valueInNis: number | null;
  unitPrice: number | null;
};

export interface HoldingsResponse {
  holdings: PricedHolding[];
  summary: {
    totalValueNis: number | null;
    pricedValueNis: number;
    isComplete: boolean;
    holdingCount: number;
    pricedCount: number;
    usdToNisRate: number;
    lastUpdated: string;
  };
  allocation: {
    byAssetClass: Record<AssetClass, number>;
    byLiquidity: Record<Liquidity, number>;
    byPlatform: Record<string, number>;
    byCurrency: Record<string, number>;
  };
  drift: PlatformDrift[];
  failures: PricingFailure[];
}

export interface HoldingMutationResponse {
  holding: Holding & { platform: Platform };
}

export interface ManualValuesResponse {
  confirmedAt: string;
  confirmedCount: number;
}

export interface PlatformsResponse {
  platforms: Platform[];
}

export interface PlatformMutationResponse {
  platform: Platform;
}

export interface HistoryPoint {
  date: string;
  totalValue: number;
  changeAmount: number;
  changePercent: number;
}

export interface HistoryResponse {
  data: HistoryPoint[];
  period: string;
}

export interface ClassTarget {
  assetClass: AssetClass;
  targetPercent: number;
}

export interface WithinClassWeight {
  holdingId: string;
  withinClassWeight: number | null;
}

export interface TargetsResponse {
  classTargets: ClassTarget[];
  withinClassWeights: WithinClassWeight[];
}

export interface ReplaceTargetsRequest {
  classTargets: Partial<Record<AssetClass, number>>;
  withinClassWeights: Record<string, number | null>;
}
