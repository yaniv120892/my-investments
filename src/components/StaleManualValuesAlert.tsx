"use client";

import { Alert, AlertTitle, Box, Button, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { PricedHolding } from "@/lib/api";
import {
  MANUAL_VALUE_MAX_AGE_DAYS,
  describeManualValueAge,
  isManualValueStale,
} from "@/utils/manualValueFreshness";

interface StaleManualValuesAlertProps {
  holdings: PricedHolding[];
  action?: ReactNode;
  onReview?: () => void;
}

/**
 * A manual value never fails to price, so nothing else in the app notices that
 * it has gone old — it just keeps reporting last month's balance as today's.
 * This is the only thing that says so.
 */
export default function StaleManualValuesAlert({
  holdings,
  action,
  onReview,
}: StaleManualValuesAlertProps) {
  const stale = findStaleManualHoldings(holdings);
  if (stale.length === 0) {
    return null;
  }

  return (
    <Alert
      severity="info"
      action={
        action ??
        (onReview ? (
          <Button color="inherit" size="small" onClick={onReview}>
            Review
          </Button>
        ) : undefined)
      }
    >
      <AlertTitle>
        {stale.length} manual value{stale.length === 1 ? " is" : "s are"} older
        than {MANUAL_VALUE_MAX_AGE_DAYS} days
      </AlertTitle>
      <Typography variant="body2" sx={{ mb: 1 }}>
        These are counted in the total at the balance you last entered.
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {stale.map((holding) => (
          <Typography
            key={holding.id}
            component="li"
            variant="body2"
            dir="auto"
          >
            <strong>{holding.assetName}</strong> —{" "}
            {describeManualValueAge(holding.manualValueUpdatedAt)}
          </Typography>
        ))}
      </Box>
    </Alert>
  );
}

export function findStaleManualHoldings(
  holdings: PricedHolding[]
): PricedHolding[] {
  return holdings.filter(
    (holding) =>
      holding.priceSource === "MANUAL" &&
      isManualValueStale(holding.manualValueUpdatedAt)
  );
}
