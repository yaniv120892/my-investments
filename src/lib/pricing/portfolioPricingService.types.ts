export interface HoldingValuation {
  holdingId: string;
  assetName: string;
  valueInNis: number;
  unitPrice: number | null;
  currency: string;
  fetchedAt: Date;
}

export interface PricingFailure {
  holdingId: string;
  assetName: string;
  sourceSymbol: string | null;
  reason: string;
}

export interface PricingResult {
  valuations: HoldingValuation[];
  failures: PricingFailure[];
  usdToNisRate: number;
  totalValueNis: number | null;
  pricedValueNis: number;
}
