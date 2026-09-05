import type { AssetClass } from "@prisma/client";
import type { PricingFailure } from "@/lib/pricing/portfolioPricingService.types";
import type { InvestableHolding } from "@/lib/pricing/contributionPlanner.types";

export interface ClassPosition {
  assetClass: AssetClass;
  valueInNis: number;
  percentOfInvestable: number;
}

export interface IlliquidPosition {
  assetName: string;
  platformName: string;
  valueInNis: number;
}

export interface InvestablePortfolio {
  investableHoldings: InvestableHolding[];
  investableValueNis: number;
  illiquidValueNis: number;
  illiquidPositions: IlliquidPosition[];
  byAssetClass: ClassPosition[];
  totalValueNis: number | null;
  failures: PricingFailure[];
  usdToNisRate: number;
}
