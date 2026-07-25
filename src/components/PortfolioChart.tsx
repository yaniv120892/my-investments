"use client";

import { useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type TooltipItem,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useHoldingHistory } from "@/lib/hooks";
import { formatMoney, type DisplayCurrency } from "@/utils/format";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PortfolioChartProps {
  displayCurrency: DisplayCurrency;
  usdToNisRate: number;
  className?: string;
}

const PERIOD_OPTIONS = [
  { value: "1m", label: "1 Month" },
  { value: "3m", label: "3 Months" },
  { value: "6m", label: "6 Months" },
  { value: "1y", label: "1 Year" },
  { value: "all", label: "All Time" },
];

export default function PortfolioChart({
  displayCurrency,
  usdToNisRate,
  className = "",
}: PortfolioChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("6m");
  const { data, isLoading, error } = useHoldingHistory(selectedPeriod);

  const points = data?.data ?? [];

  const header = (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
        Portfolio Value Over Time
      </h3>
      <select
        value={selectedPeriod}
        onChange={(event) => setSelectedPeriod(event.target.value)}
        className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
      >
        {PERIOD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  if (isLoading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}
      >
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}
      >
        {header}
        <div className="text-red-600 dark:text-red-400">
          Could not load history: {(error as Error).message}
        </div>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}
      >
        {header}
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          No history yet. Snapshots build this chart over time — trigger one to
          record today&apos;s value.
        </div>
      </div>
    );
  }

  const toDisplay = (valueInNis: number): number =>
    displayCurrency === "USD" ? valueInNis / usdToNisRate : valueInNis;

  const chartData = {
    labels: points.map((point) =>
      new Date(point.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    ),
    datasets: [
      {
        label: "Portfolio Value",
        data: points.map((point) => toDisplay(point.totalValue)),
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");
  const textColor = isDark ? "#f3f4f6" : "#374151";
  const gridColor = isDark ? "#374151" : "#e5e7eb";

  const formatAxisValue = (rawValue: number): string => {
    const valueInNis =
      displayCurrency === "USD" ? rawValue * usdToNisRate : rawValue;
    return formatMoney(valueInNis, displayCurrency, usdToNisRate);
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { position: "top" as const, labels: { color: textColor } },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<"line">) =>
            `Portfolio Value: ${formatAxisValue(context.parsed.y)}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: textColor },
        grid: { color: gridColor },
      },
      y: {
        ticks: {
          color: textColor,
          callback: (tickValue: string | number) =>
            formatAxisValue(Number(tickValue)),
        },
        grid: { color: gridColor },
      },
    },
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}
    >
      {header}
      <div className="h-64">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
