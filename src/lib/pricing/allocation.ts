import type {
  AllocationSlice,
  WeightedItem,
} from "@/lib/pricing/allocation.types";

export type {
  AllocationSlice,
  WeightedItem,
} from "@/lib/pricing/allocation.types";

export function computeAllocation(items: WeightedItem[]): AllocationSlice[] {
  const total = items.reduce((sum, item) => sum + item.valueInNis, 0);

  return items
    .map((item) => {
      const actualPercent = total > 0 ? (item.valueInNis / total) * 100 : 0;
      const targetPercent = item.targetPercent;

      if (targetPercent === null) {
        return {
          key: item.key,
          valueInNis: item.valueInNis,
          actualPercent,
          targetPercent: null,
          driftPercent: null,
          rebalanceAmountNis: null,
        };
      }

      return {
        key: item.key,
        valueInNis: item.valueInNis,
        actualPercent,
        targetPercent,
        driftPercent: actualPercent - targetPercent,
        rebalanceAmountNis: (targetPercent / 100) * total - item.valueInNis,
      };
    })
    .sort((a, b) => b.valueInNis - a.valueInNis);
}

export function groupBy<T>(
  items: T[],
  toKey: (item: T) => string,
  toValue: (item: T) => number
): Record<string, number> {
  return items.reduce((totals: Record<string, number>, item) => {
    const key = toKey(item);
    totals[key] = (totals[key] || 0) + toValue(item);
    return totals;
  }, {});
}
