"use client";

import Link from "next/link";
import { Button, Card, CardContent, Stack, Typography } from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import SummaryRow from "@/components/dashboard/SummaryRow";
import type { PricedHolding } from "@/lib/api";

interface TopHoldingsCardProps {
  holdings: PricedHolding[];
  money: (valueInNis: number) => string;
  maxRows?: number;
}

export default function TopHoldingsCard({
  holdings,
  money,
  maxRows = 6,
}: TopHoldingsCardProps) {
  const pricedTotal = holdings.reduce(
    (sum, holding) => sum + (holding.valueInNis ?? 0),
    0
  );
  const ranked = [...holdings]
    .sort((first, second) => (second.valueInNis ?? 0) - (first.valueInNis ?? 0))
    .slice(0, maxRows);

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
          sx={{ mb: 2 }}
        >
          <Typography variant="h4" component="h2">
            Largest holdings
          </Typography>
          <Button
            component={Link}
            href="/holdings"
            size="small"
            endIcon={<ChevronRightRoundedIcon />}
          >
            View all
          </Button>
        </Stack>

        {ranked.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No holdings yet.
          </Typography>
        ) : (
          <Stack spacing={1.25}>
            {ranked.map((holding) => (
              <SummaryRow
                key={holding.id}
                label={holding.assetName}
                caption={holding.platform.name}
                value={
                  holding.valueInNis === null
                    ? "—"
                    : `${money(holding.valueInNis)} · ${toSharePercent(
                        holding.valueInNis,
                        pricedTotal
                      )}`
                }
              />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function toSharePercent(valueInNis: number, pricedTotal: number): string {
  if (pricedTotal <= 0) {
    return "—";
  }
  return `${((valueInNis / pricedTotal) * 100).toFixed(1)}%`;
}
