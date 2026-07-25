"use client";

import { useState } from "react";
import Navigation from "@/components/Navigation";
import AllocationBreakdown from "@/components/AllocationBreakdown";
import CurrencyExposure from "@/components/CurrencyExposure";
import PortfolioChart from "@/components/PortfolioChart";
import TargetDrift from "@/components/TargetDrift";
import { useHoldings } from "@/lib/hooks";
import {
  formatMoney,
  formatNumber,
  getAssetClassLabel,
  getLiquidityLabel,
  type DisplayCurrency,
} from "@/utils/format";

export default function DashboardPage() {
  const [displayCurrency, setDisplayCurrency] =
    useState<DisplayCurrency>("NIS");
  const { data, isLoading, error } = useHoldings();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md">
            {(error as Error)?.message ?? "Could not load your portfolio."}
          </div>
        </div>
      </div>
    );
  }

  const { summary, allocation, drift, failures, holdings } = data;
  const rate = summary.usdToNisRate;
  const money = (valueInNis: number): string =>
    formatMoney(valueInNis, displayCurrency, rate);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Investment Portfolio
          </h1>
          <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
            {(["NIS", "USD"] as DisplayCurrency[]).map((currency) => (
              <button
                key={currency}
                type="button"
                onClick={() => setDisplayCurrency(currency)}
                className={`px-4 py-1.5 text-sm ${
                  displayCurrency === currency
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                }`}
              >
                {currency}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Total Value
            </h3>
            {summary.totalValueNis === null ? (
              <>
                <p className="text-3xl font-bold text-gray-400 dark:text-gray-500">
                  —
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                  Unavailable: {summary.pricedCount} of {summary.holdingCount}{" "}
                  assets could be priced
                </p>
              </>
            ) : (
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {money(summary.totalValueNis)}
              </p>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Holdings
            </h3>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {formatNumber(summary.holdingCount)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              USD / NIS
            </h3>
            <p className="text-3xl font-bold text-gray-700 dark:text-gray-300">
              {rate.toFixed(4)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {new Date(summary.lastUpdated).toLocaleString("en-US")}
            </p>
          </div>
        </div>

        {failures.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-amber-800 dark:text-amber-300 mb-3">
              {failures.length} asset{failures.length === 1 ? "" : "s"} could
              not be priced
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
              The portfolio total is hidden rather than shown understated.
            </p>
            <ul className="space-y-1">
              {failures.map((failure) => (
                <li
                  key={failure.holdingId}
                  className="text-sm text-amber-800 dark:text-amber-300"
                >
                  <span className="font-medium">{failure.assetName}</span>
                  {failure.sourceSymbol ? ` (${failure.sourceSymbol})` : ""} —{" "}
                  {failure.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <TargetDrift
          drift={drift}
          displayCurrency={displayCurrency}
          usdToNisRate={rate}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AllocationBreakdown
            title="By Platform"
            totals={allocation.byPlatform}
            displayCurrency={displayCurrency}
            usdToNisRate={rate}
          />
          <AllocationBreakdown
            title="By Asset Class"
            totals={allocation.byAssetClass}
            displayCurrency={displayCurrency}
            usdToNisRate={rate}
            labelFor={getAssetClassLabel}
          />
          <AllocationBreakdown
            title="Liquidity"
            totals={allocation.byLiquidity}
            displayCurrency={displayCurrency}
            usdToNisRate={rate}
            labelFor={getLiquidityLabel}
          />
          <CurrencyExposure
            byCurrency={allocation.byCurrency}
            displayCurrency={displayCurrency}
            usdToNisRate={rate}
          />
        </div>

        <PortfolioChart displayCurrency={displayCurrency} usdToNisRate={rate} />

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white p-6 pb-3">
            All Holdings
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="py-2 px-6">Asset</th>
                  <th className="py-2 px-4">Platform</th>
                  <th className="py-2 px-4">Source</th>
                  <th className="py-2 px-4 text-right">Quantity</th>
                  <th className="py-2 px-4 text-right">Unit Price</th>
                  <th className="py-2 px-6 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => (
                  <tr
                    key={holding.id}
                    className="border-t border-gray-100 dark:border-gray-700"
                  >
                    <td className="py-2 px-6 text-gray-900 dark:text-white">
                      {holding.assetName}
                    </td>
                    <td className="py-2 px-4 text-gray-600 dark:text-gray-400">
                      {holding.platform.name}
                    </td>
                    <td className="py-2 px-4 text-gray-600 dark:text-gray-400">
                      {holding.sourceSymbol ?? holding.priceSource}
                    </td>
                    <td className="py-2 px-4 text-right text-gray-600 dark:text-gray-400">
                      {holding.quantity.toLocaleString("en-US", {
                        maximumFractionDigits: 8,
                      })}
                    </td>
                    <td className="py-2 px-4 text-right text-gray-600 dark:text-gray-400">
                      {holding.unitPrice === null
                        ? "—"
                        : holding.unitPrice.toLocaleString("en-US", {
                            maximumFractionDigits: 8,
                          })}
                    </td>
                    <td className="py-2 px-6 text-right text-gray-900 dark:text-white">
                      {holding.valueInNis === null
                        ? "—"
                        : money(holding.valueInNis)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
