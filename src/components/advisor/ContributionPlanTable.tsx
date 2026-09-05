"use client";

import { memo } from "react";

import {
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import {
  formatMoney,
  getAssetClassLabel,
  type DisplayCurrency,
} from "@/utils/format";
import type { ContributionPlanAccepted } from "@/lib/pricing/contributionPlanner.types";

interface ContributionPlanTableProps {
  plan: ContributionPlanAccepted;
  displayCurrency: DisplayCurrency;
  usdToNisRate: number;
}

function ContributionPlanTable({
  plan,
  displayCurrency,
  usdToNisRate,
}: ContributionPlanTableProps) {
  const money = (valueInNis: number) =>
    formatMoney(valueInNis, displayCurrency, usdToNisRate);

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
          <Typography variant="h4" component="h2">
            Plan for {money(plan.contributionNis)}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            label={`Investable ${money(plan.investableValueNis)}`}
          />
        </Stack>

        <TableContainer sx={{ overflowX: "auto", mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Asset class</TableCell>
                <TableCell align="right">Now</TableCell>
                <TableCell align="right">Target</TableCell>
                <TableCell align="right">Add</TableCell>
                <TableCell align="right">After</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plan.byAssetClass.map((allocation) => (
                <TableRow key={allocation.assetClass} hover>
                  <TableCell>
                    {getAssetClassLabel(allocation.assetClass)}
                  </TableCell>
                  <TableCell align="right">
                    {allocation.currentPercent.toFixed(1)}%
                  </TableCell>
                  <TableCell align="right">
                    {allocation.targetPercent.toFixed(1)}%
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 600, whiteSpace: "nowrap" }}
                  >
                    {allocation.contributionNis > 0
                      ? money(allocation.contributionNis)
                      : "—"}
                  </TableCell>
                  <TableCell align="right">
                    {allocation.percentAfter.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Typography variant="h4" component="h3" sx={{ mb: 1.5 }}>
          Where it goes
        </Typography>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Holding</TableCell>
                <TableCell>Platform</TableCell>
                <TableCell align="right">Add</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plan.byHolding.map((allocation) => (
                <TableRow key={allocation.holdingId} hover>
                  <TableCell dir="auto">{allocation.assetName}</TableCell>
                  <TableCell dir="auto">{allocation.platformName}</TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 600, whiteSpace: "nowrap" }}
                  >
                    {money(allocation.contributionNis)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {plan.dropped.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Skipped as too small to be worth a ticket:{" "}
            {plan.dropped
              .map((entry) =>
                entry.scope === "assetClass"
                  ? getAssetClassLabel(entry.label)
                  : entry.label
              )
              .join(", ")}
            .
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

// Rendered beside a streaming chat, but the plan only arrives once it ends.
export default memo(ContributionPlanTable);
