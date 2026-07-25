"use client";

import type { PlatformDrift } from "@/lib/api";
import { formatMoney, type DisplayCurrency } from "@/utils/format";

interface TargetDriftProps {
  drift: PlatformDrift[];
  displayCurrency: DisplayCurrency;
  usdToNisRate: number;
}

export default function TargetDrift({
  drift,
  displayCurrency,
  usdToNisRate,
}: TargetDriftProps) {
  if (drift.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {drift.map((platform) => (
        <div
          key={platform.platformName}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
        >
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Rebalancing — {platform.platformName}
            </h3>
            {Math.abs(platform.targetTotalPercent - 100) > 0.01 && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                targets sum to {platform.targetTotalPercent.toFixed(0)}%, not
                100%
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-4">Asset</th>
                  <th className="py-2 pr-4 text-right">Actual</th>
                  <th className="py-2 pr-4 text-right">Target</th>
                  <th className="py-2 pr-4 text-right">Drift</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {platform.slices.map((slice) => (
                  <tr
                    key={slice.key}
                    className="border-t border-gray-100 dark:border-gray-700"
                  >
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">
                      {slice.key}
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-700 dark:text-gray-300">
                      {slice.actualPercent.toFixed(1)}%
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-700 dark:text-gray-300">
                      {slice.targetPercent === null
                        ? "—"
                        : `${slice.targetPercent.toFixed(1)}%`}
                    </td>
                    <td
                      className={`py-2 pr-4 text-right ${
                        slice.driftPercent === null
                          ? "text-gray-400"
                          : slice.driftPercent >= 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {slice.driftPercent === null
                        ? "—"
                        : `${
                            slice.driftPercent >= 0 ? "+" : ""
                          }${slice.driftPercent.toFixed(1)}%`}
                    </td>
                    <td className="py-2 text-right text-gray-900 dark:text-white">
                      {slice.rebalanceAmountNis === null
                        ? "—"
                        : `${
                            slice.rebalanceAmountNis >= 0 ? "Buy " : "Sell "
                          }${formatMoney(
                            Math.abs(slice.rebalanceAmountNis),
                            displayCurrency,
                            usdToNisRate
                          )}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
