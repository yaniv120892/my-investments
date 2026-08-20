"use client";

import { useTheme } from "@mui/material";
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
import type { HistoryPoint } from "@/lib/api";
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

interface PortfolioChartCanvasProps {
  points: HistoryPoint[];
  displayCurrency: DisplayCurrency;
  usdToNisRate: number;
}

export default function PortfolioChartCanvas({
  points,
  displayCurrency,
  usdToNisRate,
}: PortfolioChartCanvasProps) {
  const theme = useTheme();
  const textColor = theme.palette.text.secondary;
  const gridColor = theme.palette.divider;
  const lineColor = theme.palette.primary.main;

  const toDisplay = (valueInNis: number): number =>
    displayCurrency === "USD" ? valueInNis / usdToNisRate : valueInNis;

  const formatAxisValue = (rawValue: number): string => {
    const valueInNis =
      displayCurrency === "USD" ? rawValue * usdToNisRate : rawValue;
    return formatMoney(valueInNis, displayCurrency, usdToNisRate);
  };

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
        borderColor: lineColor,
        backgroundColor: `${lineColor}22`,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { display: false },
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
        grid: { display: false },
      },
      y: {
        ticks: {
          color: textColor,
          callback: (tickValue: string | number) =>
            formatAxisValue(Number(tickValue)),
        },
        grid: { color: gridColor },
        border: { display: false },
      },
    },
  };

  return <Line data={chartData} options={options} />;
}
