import type { AssetClass } from "@prisma/client";
import type { PricingFailure } from "@/lib/pricing/portfolioPricingService.types";
import type { InvestableHolding } from "@/lib/pricing/contributionPlanner.types";

export interface ClassPosition {
  assetClass: AssetClass;
  valueInNis: number;
  /** Null whenever pricing is incomplete, so no share is quoted off a partial base. */
  percentOfInvestable: number | null;
}

export interface IlliquidPosition {
  assetName: string;
  platformName: string;
  valueInNis: number;
}

export interface InvestablePortfolio {
  investableHoldings: InvestableHolding[];
  /** Null whenever `failures` is non-empty, mirroring `PricingResult`. */
  investableValueNis: number | null;
  pricedInvestableValueNis: number;
  illiquidValueNis: number;
  illiquidPositions: IlliquidPosition[];
  byAssetClass: ClassPosition[];
  totalValueNis: number | null;
  failures: PricingFailure[];
  usdToNisRate: number;
}
