"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useHoldingHistory } from "@/lib/hooks";
import type { DisplayCurrency } from "@/utils/format";

// chart.js is ~90kB of the dashboard's first load, so it streams in behind the
// card rather than blocking the page it sits on.
const PortfolioChartCanvas = dynamic(
  () => import("@/components/PortfolioChartCanvas"),
  {
    ssr: false,
    loading: () => <Skeleton variant="rounded" height="100%" />,
  }
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

  const points = data?.data ?? [];

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

    return (
      <Box sx={{ height }}>
        <PortfolioChartCanvas
          points={points}
          displayCurrency={displayCurrency}
          usdToNisRate={usdToNisRate}
        />
      </Box>
    );
  };

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
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
        {body()}
      </CardContent>
    </Card>
  );
}
