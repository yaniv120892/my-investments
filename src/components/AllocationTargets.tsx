"use client";

import { useState, useEffect } from "react";
import { getInvestmentTypeLabel } from "@/utils/format";
import type { InvestmentType } from "@prisma/client";

interface AllocationTargetsProps {
  categoryTotals: Record<string, number>;
  totalValue: number | null;
}

interface TargetAllocation {
  type: string;
  targetPercentage: number;
  currentPercentage: number;
  difference: number;
}

const INVESTMENT_TYPES: InvestmentType[] = [
  "STOCK",
  "CRYPTO",
  "PENSION",
  "EDUCATION_FUND",
  "INVESTMENT_FUND",
  "MONEY_MARKET",
  "FOREIGN_CURRENCY",
];

export default function AllocationTargets({
  categoryTotals,
  totalValue,
}: AllocationTargetsProps) {
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [isEditing, setIsEditing] = useState(false);

  // Load saved targets from localStorage
  useEffect(() => {
    const savedTargets = localStorage.getItem("allocationTargets");
    if (savedTargets) {
      setTargets(JSON.parse(savedTargets));
    }
  }, []);

  // Save targets to localStorage
  const saveTargets = (newTargets: Record<string, number>) => {
    localStorage.setItem("allocationTargets", JSON.stringify(newTargets));
    setTargets(newTargets);
  };

  const handleTargetChange = (type: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    const newTargets = { ...targets, [type]: numValue };
    saveTargets(newTargets);
  };

  const resetTargets = () => {
    const defaultTargets: Record<string, number> = {
      STOCK: 40,
      CRYPTO: 10,
      PENSION: 20,
      EDUCATION_FUND: 10,
      INVESTMENT_FUND: 15,
      MONEY_MARKET: 3,
      FOREIGN_CURRENCY: 2,
    };
    saveTargets(defaultTargets);
  };

  const allocationData: TargetAllocation[] = INVESTMENT_TYPES.map((type) => {
    const currentValue = categoryTotals[type] || 0;
    const currentPercentage = totalValue
      ? (currentValue / totalValue) * 100
      : 0;
    const targetPercentage = targets[type] || 0;
    const difference = currentPercentage - targetPercentage;

    return {
      type,
      targetPercentage,
      currentPercentage,
      difference,
    };
  });

  const totalTarget = Object.values(targets).reduce(
    (sum, target) => sum + target,
    0
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Allocation Targets
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            {isEditing ? "Save" : "Edit Targets"}
          </button>
          <button
            onClick={resetTargets}
            className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-md"
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Set your target allocation percentages. Total should equal 100%.
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
            Current total: {totalTarget.toFixed(1)}%
          </p>
        </div>
      )}

      <div className="space-y-3">
        {allocationData.map((allocation) => (
          <div
            key={allocation.type}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
          >
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-white">
                {getInvestmentTypeLabel(allocation.type)}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Target Percentage */}
              <div className="text-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Target
                </div>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={allocation.targetPercentage}
                    onChange={(e) =>
                      handleTargetChange(allocation.type, e.target.value)
                    }
                    className="w-16 text-center text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                ) : (
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {allocation.targetPercentage.toFixed(1)}%
                  </div>
                )}
              </div>

              {/* Current Percentage */}
              <div className="text-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Current
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {allocation.currentPercentage.toFixed(1)}%
                </div>
              </div>

              {/* Difference */}
              <div className="text-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Diff
                </div>
                <div
                  className={`text-sm font-medium ${
                    allocation.difference > 0
                      ? "text-green-600 dark:text-green-400"
                      : allocation.difference < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {allocation.difference > 0 ? "+" : ""}
                  {allocation.difference.toFixed(1)}%
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-24 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${Math.min(allocation.currentPercentage, 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {!isEditing && totalTarget !== 100 && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Target allocation total is {totalTarget.toFixed(1)}%. Consider
            adjusting to 100%.
          </p>
        </div>
      )}
    </div>
  );
}
