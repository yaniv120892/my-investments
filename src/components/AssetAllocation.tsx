"use client";

import { useMemo } from "react";
import { formatCurrency, getInvestmentTypeLabel } from "@/utils/format";

interface AssetAllocationProps {
  categoryTotals: Record<string, number>;
  totalValue: number | null;
}

const COLORS = [
  "#3B82F6", // blue-500
  "#10B981", // emerald-500
  "#F59E0B", // amber-500
  "#EF4444", // red-500
  "#8B5CF6", // violet-500
  "#06B6D4", // cyan-500
  "#84CC16", // lime-500
];

export default function AssetAllocation({
  categoryTotals,
  totalValue,
}: AssetAllocationProps) {
  const allocationData = useMemo(() => {
    if (!totalValue || totalValue <= 0) return [];

    return Object.entries(categoryTotals)
      .map(([type, value], index) => ({
        type,
        label: getInvestmentTypeLabel(type),
        value,
        percentage: (value / totalValue) * 100,
        color: COLORS[index % COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [categoryTotals, totalValue]);

  if (!totalValue || totalValue <= 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Asset Allocation
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          No investment data available to calculate allocation.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Asset Allocation
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="flex justify-center">
          <div className="relative w-48 h-48">
            <svg
              className="w-48 h-48 transform -rotate-90"
              viewBox="0 0 100 100"
            >
              {allocationData.map((item, index) => {
                const previousItems = allocationData.slice(0, index);
                const previousTotal = previousItems.reduce(
                  (sum, item) => sum + item.percentage,
                  0
                );
                const startAngle = (previousTotal / 100) * 360;
                const endAngle =
                  ((previousTotal + item.percentage) / 100) * 360;

                const startRadians = (startAngle * Math.PI) / 180;
                const endRadians = (endAngle * Math.PI) / 180;

                const x1 = 50 + 40 * Math.cos(startRadians);
                const y1 = 50 + 40 * Math.sin(startRadians);
                const x2 = 50 + 40 * Math.cos(endRadians);
                const y2 = 50 + 40 * Math.sin(endRadians);

                const largeArcFlag = item.percentage > 50 ? 1 : 0;

                const pathData = [
                  `M 50 50`,
                  `L ${x1} ${y1}`,
                  `A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                  `Z`,
                ].join(" ");

                return (
                  <path
                    key={item.type}
                    d={pathData}
                    fill={item.color}
                    stroke="white"
                    strokeWidth="0.5"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(totalValue)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Total Value
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Allocation Table */}
        <div>
          <div className="space-y-3">
            {allocationData.map((item) => (
              <div
                key={item.type}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {item.label}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(item.value)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {item.percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
