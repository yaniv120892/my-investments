"use client";

import {
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { computeAllocation } from "@/lib/pricing/allocation";
import { formatMoney, type DisplayCurrency } from "@/utils/format";

interface AllocationBreakdownProps {
  title: string;
  totals: Record<string, number>;
  displayCurrency: DisplayCurrency;
  usdToNisRate: number;
  labelFor?: (key: string) => string;
  maxRows?: number;
}

export default function AllocationBreakdown({
  title,
  totals,
  displayCurrency,
  usdToNisRate,
  labelFor,
  maxRows,
}: AllocationBreakdownProps) {
  const theme = useTheme();
  const series = theme.palette.charts.series;

  const allSlices = computeAllocation(
    Object.entries(totals).map(([key, valueInNis]) => ({
      key,
      valueInNis,
      targetPercent: null,
    }))
  );

  if (allSlices.length === 0) {
    return null;
  }

  const slices = maxRows ? allSlices.slice(0, maxRows) : allSlices;
  const hiddenCount = allSlices.length - slices.length;

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography variant="h4" component="h2" sx={{ mb: 2 }}>
          {title}
        </Typography>
        <Stack spacing={1.5}>
          {slices.map((slice, index) => (
            <Stack key={slice.key} spacing={0.75}>
              <Stack
                direction="row"
                justifyContent="space-between"
                spacing={1}
                alignItems="baseline"
              >
                <Typography variant="body2" noWrap dir="auto">
                  {labelFor ? labelFor(slice.key) : slice.key}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ whiteSpace: "nowrap" }}
                >
                  {formatMoney(slice.valueInNis, displayCurrency, usdToNisRate)}{" "}
                  · {slice.actualPercent.toFixed(1)}%
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={Math.min(slice.actualPercent, 100)}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 4,
                    backgroundColor: series[index % series.length],
                  },
                }}
              />
            </Stack>
          ))}
          {hiddenCount > 0 && (
            <Typography variant="caption" color="text.secondary">
              + {hiddenCount} more
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
