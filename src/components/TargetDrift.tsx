"use client";

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
import type { PlatformDrift } from "@/lib/api";
import { formatMoney, type DisplayCurrency } from "@/utils/format";

interface TargetDriftProps {
  drift: PlatformDrift[];
  displayCurrency: DisplayCurrency;
  usdToNisRate: number;
}

export default function TargetDrift({
  drift,
  displayCurrency,
  usdToNisRate,
}: TargetDriftProps) {
  if (drift.length === 0) {
    return null;
  }

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      {drift.map((platform) => (
        <Card key={platform.platformName}>
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={1}
              sx={{ mb: 2 }}
            >
              <Typography variant="h4" component="h2">
                {platform.platformName}
              </Typography>
              {Math.abs(platform.targetTotalPercent - 100) > 0.01 && (
                <Chip
                  size="small"
                  color="warning"
                  variant="outlined"
                  label={`Targets sum to ${platform.targetTotalPercent.toFixed(
                    0
                  )}%, not 100%`}
                />
              )}
            </Stack>

            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Asset</TableCell>
                    <TableCell align="right">Actual</TableCell>
                    <TableCell align="right">Target</TableCell>
                    <TableCell align="right">Drift</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {platform.slices.map((slice) => (
                    <TableRow key={slice.key} hover>
                      <TableCell dir="auto">{slice.key}</TableCell>
                      <TableCell align="right">
                        {slice.actualPercent.toFixed(1)}%
                      </TableCell>
                      <TableCell align="right">
                        {slice.targetPercent === null
                          ? "—"
                          : `${slice.targetPercent.toFixed(1)}%`}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 600,
                          color:
                            slice.driftPercent === null
                              ? "text.disabled"
                              : slice.driftPercent >= 0
                                ? "warning.main"
                                : "info.main",
                        }}
                      >
                        {slice.driftPercent === null
                          ? "—"
                          : `${
                              slice.driftPercent >= 0 ? "+" : ""
                            }${slice.driftPercent.toFixed(1)}%`}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        {slice.rebalanceAmountNis === null
                          ? "—"
                          : `${
                              slice.rebalanceAmountNis >= 0 ? "Buy " : "Sell "
                            }${formatMoney(
                              Math.abs(slice.rebalanceAmountNis),
                              displayCurrency,
                              usdToNisRate
                            )}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
