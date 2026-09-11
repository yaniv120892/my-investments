import type { AssetClass } from "@prisma/client";

export interface ClassTargetInput {
  assetClass: AssetClass;
  targetPercent: number;
}

export interface WithinClassWeightEntry {
  holdingId: string;
  withinClassWeight: number | null;
}

export interface ReplaceTargetsInput {
  classTargets: ClassTargetInput[];
  withinClassWeights: WithinClassWeightEntry[];
}

export interface StoredTargets {
  classTargets: ClassTargetInput[];
  withinClassWeights: WithinClassWeightEntry[];
}
