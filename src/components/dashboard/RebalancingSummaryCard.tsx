"use client";

import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import SummaryRow from "@/components/dashboard/SummaryRow";
import type { AllocationSlice, PlatformDrift } from "@/lib/api";
import { formatMoney, type DisplayCurrency } from "@/utils/format";

interface RebalancingSummaryCardProps {
  drift: PlatformDrift[];
  displayCurrency: DisplayCurrency;
  usdToNisRate: number;
  actionThresholdPercent?: number;
  maxRows?: number;
}

interface DriftHighlight {
  platformName: string;
  slice: AllocationSlice;
  absoluteDrift: number;
}

export default function RebalancingSummaryCard({
  drift,
  displayCurrency,
  usdToNisRate,
  actionThresholdPercent = 1,
  maxRows = 4,
}: RebalancingSummaryCardProps) {
  if (drift.length === 0) {
    return null;
  }

  const highlights = toDriftHighlights(drift, actionThresholdPercent);
  const shown = highlights.slice(0, maxRows);

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
          sx={{ mb: 2 }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h4" component="h2">
              Rebalancing
            </Typography>
            <Chip
              size="small"
              color={highlights.length > 0 ? "warning" : "success"}
              variant="outlined"
              label={
                highlights.length > 0
                  ? `${highlights.length} off target`
                  : "On target"
              }
            />
          </Stack>
          <Button
            component={Link}
            href="/rebalancing"
            size="small"
            endIcon={<ChevronRightRoundedIcon />}
          >
            View all
          </Button>
        </Stack>

        {shown.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Every slice is within {actionThresholdPercent}% of its target.
          </Typography>
        ) : (
          <Stack spacing={1.25}>
            {shown.map(({ platformName, slice }) => (
              <SummaryRow
                key={`${platformName}:${slice.key}`}
                label={slice.key}
                caption={platformName}
                value={describeAction(slice, displayCurrency, usdToNisRate)}
                valueColor={getActionColor(slice.rebalanceAmountNis)}
              />
            ))}
            {highlights.length > shown.length && (
              <Typography variant="caption" color="text.secondary">
                + {highlights.length - shown.length} more
              </Typography>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function toDriftHighlights(
  drift: PlatformDrift[],
  actionThresholdPercent: number
): DriftHighlight[] {
  return drift
    .flatMap((platform) =>
      platform.slices
        .filter((slice) => slice.driftPercent !== null)
        .map((slice) => ({
          platformName: platform.platformName,
          slice,
          absoluteDrift: Math.abs(slice.driftPercent ?? 0),
        }))
    )
    .filter((highlight) => highlight.absoluteDrift >= actionThresholdPercent)
    .sort((first, second) => second.absoluteDrift - first.absoluteDrift);
}

function describeAction(
  slice: AllocationSlice,
  displayCurrency: DisplayCurrency,
  usdToNisRate: number
): string {
  const driftLabel = `${(slice.driftPercent ?? 0) >= 0 ? "+" : ""}${(
    slice.driftPercent ?? 0
  ).toFixed(1)}%`;

  if (slice.rebalanceAmountNis === null) {
    return driftLabel;
  }

  const verb = slice.rebalanceAmountNis >= 0 ? "Buy" : "Sell";
  const amount = formatMoney(
    Math.abs(slice.rebalanceAmountNis),
    displayCurrency,
    usdToNisRate
  );
  return `${verb} ${amount} · ${driftLabel}`;
}

function getActionColor(rebalanceAmountNis: number | null): string {
  const isBuy = rebalanceAmountNis !== null && rebalanceAmountNis >= 0;
  return isBuy ? "info.main" : "warning.main";
}
