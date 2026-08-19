"use client";

import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
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
  height?: number;
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
  height = 280,
}: PortfolioChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("6m");
  const { data, isLoading, error } = useHoldingHistory(selectedPeriod);
  const theme = useTheme();

  const points = data?.data ?? [];
  const textColor = theme.palette.text.secondary;
  const gridColor = theme.palette.divider;
  const lineColor = theme.palette.primary.main;

  const header = (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={2}
      sx={{ mb: 2 }}
    >
      <Typography variant="h4" component="h2">
        Portfolio Value Over Time
      </Typography>
      <TextField
        select
        size="small"
        value={selectedPeriod}
        onChange={(event) => setSelectedPeriod(event.target.value)}
        aria-label="History period"
        sx={{ minWidth: 130 }}
      >
        {PERIOD_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );

  const toDisplay = (valueInNis: number): number =>
    displayCurrency === "USD" ? valueInNis / usdToNisRate : valueInNis;

  const formatAxisValue = (rawValue: number): string => {
    const valueInNis =
      displayCurrency === "USD" ? rawValue * usdToNisRate : rawValue;
    return formatMoney(valueInNis, displayCurrency, usdToNisRate);
  };

  const body = (): React.ReactNode => {
    if (isLoading) {
      return (
        <Box
          sx={{
            height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress size={28} />
        </Box>
      );
    }

    if (error) {
      return (
        <Typography color="error" variant="body2">
          Could not load history: {(error as Error).message}
        </Typography>
      );
    }

    if (points.length === 0) {
      return (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: "center", py: 6 }}
        >
          No history yet. Snapshots build this chart over time — trigger one to
          record today&apos;s value.
        </Typography>
      );
    }

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

    return (
      <Box sx={{ height }}>
        <Line data={chartData} options={options} />
      </Box>
    );
  };

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        {header}
        {body()}
      </CardContent>
    </Card>
  );
}
