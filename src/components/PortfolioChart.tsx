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
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useInvestmentHistory } from "@/lib/hooks";
import { formatCurrency } from "@/utils/format";
import type { InvestmentHistoryData } from "@/lib/api";

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
  className?: string;
}

import type { TooltipItem } from "chart.js";

const PERIOD_OPTIONS = [
  { value: "1m", label: "1 Month" },
  { value: "3m", label: "3 Months" },
  { value: "6m", label: "6 Months" },
  { value: "1y", label: "1 Year" },
  { value: "all", label: "All Time" },
];

export default function PortfolioChart({
  className = "",
}: PortfolioChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("6m");

  const {
    data: historyData,
    isLoading,
    error,
  } = useInvestmentHistory(selectedPeriod, "day");

  if (isLoading) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}
      >
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}
      >
        <div className="text-center text-red-600 dark:text-red-400">
          Error loading chart data. Please try again.
        </div>
      </div>
    );
  }

  const chartData: InvestmentHistoryData[] = historyData?.data?.data || [];

  if (!chartData || chartData.length === 0) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Portfolio Performance
          </h3>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          No historical data available. Add investments and wait for snapshots
          to see performance data.
        </div>
      </div>
    );
  }

  const formatDateForDisplay = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const labels = chartData.map((item) => formatDateForDisplay(item.date));
  const totalValueData = chartData.map((item) => item.totalValue);
  const gainLossData = chartData.map((item) => item.gainLoss);

  const data = {
    labels,
    datasets: [
      {
        label: "Portfolio Value",
        data: totalValueData,
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.4,
        yAxisID: "y",
      },
      {
        label: "Gain/Loss",
        data: gainLossData,
        borderColor: "rgb(34, 197, 94)",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        fill: false,
        tension: 0.4,
        yAxisID: "y1",
      },
    ],
  };

  const getDarkModeTextColor = (): string => {
    return document.documentElement.classList.contains("dark")
      ? "#f3f4f6"
      : "#374151";
  };

  const getDarkModeGridColor = (): string => {
    return document.documentElement.classList.contains("dark")
      ? "#374151"
      : "#e5e7eb";
  };

  const formatTooltipLabel = (context: TooltipItem<"line">): string => {
    const label = context.dataset.label || "";
    const value = context.parsed.y;

    if (label === "Portfolio Value") {
      return `Portfolio Value: ${formatCurrency(value)}`;
    } else if (label === "Gain/Loss") {
      return `Gain/Loss: ${formatCurrency(value)}`;
    }
    return `${label}: ${formatCurrency(value)}`;
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: getDarkModeTextColor(),
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: formatTooltipLabel,
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: "Date",
          color: getDarkModeTextColor(),
        },
        ticks: {
          color: getDarkModeTextColor(),
        },
        grid: {
          color: getDarkModeGridColor(),
        },
      },
      y: {
        type: "linear" as const,
        display: true,
        position: "left" as const,
        title: {
          display: true,
          text: "Portfolio Value (NIS)",
          color: getDarkModeTextColor(),
        },
        ticks: {
          color: getDarkModeTextColor(),
          callback: function (tickValue: string | number) {
            return formatCurrency(Number(tickValue));
          },
        },
        grid: {
          color: getDarkModeGridColor(),
        },
      },
      y1: {
        type: "linear" as const,
        display: true,
        position: "right" as const,
        title: {
          display: true,
          text: "Gain/Loss (NIS)",
          color: getDarkModeTextColor(),
        },
        ticks: {
          color: getDarkModeTextColor(),
          callback: function (tickValue: string | number) {
            return formatCurrency(Number(tickValue));
          },
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  const calculatePerformanceMetrics = () => {
    const latestData = chartData[chartData.length - 1];
    const previousData = chartData[chartData.length - 2];
    const totalGainLoss = previousData
      ? latestData.totalValue - previousData.totalValue
      : 0;
    const totalGainLossPercent =
      previousData && previousData.totalValue > 0
        ? ((latestData.totalValue - previousData.totalValue) /
            previousData.totalValue) *
          100
        : 0;

    return { totalGainLoss, totalGainLossPercent };
  };

  const { totalGainLoss, totalGainLossPercent } = calculatePerformanceMetrics();

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Portfolio Performance
        </h3>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {chartData && chartData.length > 1 && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Total Gain/Loss
            </p>
            <p
              className={`text-lg font-semibold ${
                totalGainLoss >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(totalGainLoss)}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">Change %</p>
            <p
              className={`text-lg font-semibold ${
                totalGainLossPercent >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {totalGainLossPercent >= 0 ? "+" : ""}
              {totalGainLossPercent.toFixed(2)}%
            </p>
          </div>
        </div>
      )}

      <div className="h-64">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
