import type { AssetClass } from "@prisma/client";

export interface ClassTarget {
  assetClass: AssetClass;
  targetPercent: number;
}

export interface InvestableHolding {
  holdingId: string;
  assetName: string;
  assetClass: AssetClass;
  platformName: string;
  valueInNis: number;
  withinClassWeight: number | null;
}

export interface ContributionPlanRequest {
  contributionNis: number;
  investableHoldings: InvestableHolding[];
  classTargets: ClassTarget[];
  minimumTicketNis: number;
  excludedAssetClasses: AssetClass[];
  excludedHoldingIds: string[];
  totalValueNis: number | null;
}

export interface ClassAllocation {
  assetClass: AssetClass;
  currentValueNis: number;
  currentPercent: number;
  targetPercent: number;
  contributionNis: number;
  percentAfter: number;
}

export interface HoldingAllocation {
  holdingId: string;
  assetName: string;
  assetClass: AssetClass;
  platformName: string;
  contributionNis: number;
}

export interface DroppedAllocation {
  label: string;
  amountNis: number;
  reason: "BELOW_MINIMUM_TICKET";
}

export type ContributionRefusalReason =
  | "PRICING_INCOMPLETE"
  | "TARGETS_DO_NOT_SUM_TO_100"
  | "NO_INVESTABLE_CLASS"
  | "CLASS_HAS_NO_WEIGHTED_HOLDING"
  | "CONTRIBUTION_BELOW_MINIMUM_TICKET";

export interface ContributionPlanRefusal {
  status: "refused";
  reason: ContributionRefusalReason;
  explanation: string;
}

export interface ContributionPlanAccepted {
  status: "planned";
  contributionNis: number;
  investableValueNis: number;
  byAssetClass: ClassAllocation[];
  byHolding: HoldingAllocation[];
  dropped: DroppedAllocation[];
}

export type ContributionPlan =
  ContributionPlanAccepted | ContributionPlanRefusal;
