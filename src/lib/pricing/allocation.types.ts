export interface WeightedItem {
  key: string;
  valueInNis: number;
  targetPercent: number | null;
}

export interface AllocationSlice {
  key: string;
  valueInNis: number;
  actualPercent: number;
  targetPercent: number | null;
  driftPercent: number | null;
  rebalanceAmountNis: number | null;
}
