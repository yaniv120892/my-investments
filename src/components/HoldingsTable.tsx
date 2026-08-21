"use client";

import {
  Button,
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { PricedHolding } from "@/lib/api";
import {
  describeManualValueAsOf,
  isManualValueStale,
} from "@/utils/manualValueFreshness";

interface HoldingsTableProps {
  holdings: PricedHolding[];
  money: (valueInNis: number) => string;
  onEdit: (holding: PricedHolding) => void;
  onDelete: (holding: PricedHolding) => void;
}

export default function HoldingsTable({
  holdings,
  money,
  onEdit,
  onDelete,
}: HoldingsTableProps) {
  if (holdings.length === 0) {
    return (
      <Card>
        <CardContent sx={{ py: 6, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            No holdings yet. Add your first one to start tracking the portfolio.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Asset</TableCell>
              <TableCell>Platform</TableCell>
              <TableCell>Source</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Unit price</TableCell>
              <TableCell align="right">Value</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {holdings.map((holding) => (
              <TableRow key={holding.id} hover>
                <TableCell dir="auto" sx={{ fontWeight: 500 }}>
                  {holding.assetName}
                </TableCell>
                <TableCell sx={{ color: "text.secondary" }}>
                  {holding.platform.name}
                </TableCell>
                <TableCell sx={{ color: "text.secondary" }}>
                  {holding.priceSource === "MANUAL" ? (
                    <Stack spacing={0}>
                      <span>Manual value</span>
                      <Typography
                        variant="caption"
                        color={
                          isManualValueStale(holding.manualValueUpdatedAt)
                            ? "warning.main"
                            : "text.disabled"
                        }
                      >
                        {describeManualValueAsOf(
                          holding.manualValueUpdatedAt
                        )}
                      </Typography>
                    </Stack>
                  ) : (
                    (holding.sourceSymbol ?? holding.priceSource)
                  )}
                </TableCell>
                <TableCell align="right" sx={{ color: "text.secondary" }}>
                  {holding.quantity.toLocaleString("en-US", {
                    maximumFractionDigits: 8,
                  })}
                </TableCell>
                <TableCell align="right" sx={{ color: "text.secondary" }}>
                  {holding.unitPrice === null
                    ? "—"
                    : holding.unitPrice.toLocaleString("en-US", {
                        maximumFractionDigits: 8,
                      })}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {holding.valueInNis === null
                    ? "—"
                    : money(holding.valueInNis)}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Button size="small" onClick={() => onEdit(holding)}>
                    Edit
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => onDelete(holding)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}
