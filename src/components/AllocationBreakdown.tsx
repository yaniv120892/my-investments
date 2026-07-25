"use client";

import { computeAllocation } from "@/lib/pricing/allocation";
import { formatMoney, type DisplayCurrency } from "@/utils/format";

interface AllocationBreakdownProps {
  title: string;
  totals: Record<string, number>;
  displayCurrency: DisplayCurrency;
  usdToNisRate: number;
  labelFor?: (key: string) => string;
}

const COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#84CC16",
];

export default function AllocationBreakdown({
  title,
  totals,
  displayCurrency,
  usdToNisRate,
  labelFor,
}: AllocationBreakdownProps) {
  const slices = computeAllocation(
    Object.entries(totals).map(([key, valueInNis]) => ({
      key,
      valueInNis,
      targetPercent: null,
    }))
  );

  if (slices.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        {title}
      </h3>
      <div className="space-y-3">
        {slices.map((slice, index) => (
          <div key={slice.key}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700 dark:text-gray-300">
                {labelFor ? labelFor(slice.key) : slice.key}
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                {formatMoney(slice.valueInNis, displayCurrency, usdToNisRate)} ·{" "}
                {slice.actualPercent.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded">
              <div
                className="h-2 rounded"
                style={{
                  width: `${slice.actualPercent}%`,
                  backgroundColor: COLORS[index % COLORS.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
