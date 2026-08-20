"use client";

import { Box, Card, CardContent, Typography } from "@mui/material";
import type { HoldingsResponse } from "@/lib/api";
import { formatNumber, type DisplayCurrency } from "@/utils/format";

interface SummaryCardsProps {
  summary: HoldingsResponse["summary"];
  displayCurrency: DisplayCurrency;
  money: (valueInNis: number) => string;
}

function StatCard({
  title,
  value,
  caption,
  captionColor = "text.secondary",
  valueColor,
}: {
  title: string;
  value: string;
  caption?: string;
  captionColor?: string;
  valueColor?: string;
}) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h3" component="p" sx={{ color: valueColor }}>
          {value}
        </Typography>
        {caption && (
          <Typography variant="body2" sx={{ mt: 1, color: captionColor }}>
            {caption}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function SummaryCards({
  summary,
  displayCurrency,
  money,
}: SummaryCardsProps) {
  const totalValueNis = summary.totalValueNis;
  const isPriceable = totalValueNis !== null;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
        gap: 2,
      }}
    >
      <StatCard
        title={`Total value (${displayCurrency})`}
        value={totalValueNis === null ? "—" : money(totalValueNis)}
        valueColor={isPriceable ? "primary.main" : "text.disabled"}
        caption={
          isPriceable
            ? `${formatNumber(summary.pricedCount)} of ${formatNumber(
                summary.holdingCount
              )} assets priced`
            : `Unavailable: only ${summary.pricedCount} of ${summary.holdingCount} assets could be priced`
        }
        captionColor={isPriceable ? "text.secondary" : "warning.main"}
      />
      <StatCard
        title="Holdings"
        value={formatNumber(summary.holdingCount)}
        caption="Across all platforms"
      />
      <StatCard
        title="USD / NIS"
        value={summary.usdToNisRate.toFixed(4)}
        caption={`Updated ${new Date(summary.lastUpdated).toLocaleString(
          "en-US"
        )}`}
      />
    </Box>
  );
}
