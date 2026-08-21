"use client";

import { Alert, AlertTitle, Box, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { PricedHolding } from "@/lib/api";
import {
  MANUAL_VALUE_MAX_AGE_DAYS,
  describeManualValueAge,
  findStaleManualHoldings,
} from "@/utils/manualValueFreshness";

interface StaleManualValuesAlertProps {
  holdings: PricedHolding[];
  action?: ReactNode;
}

/**
 * A manual value never fails to price, so nothing else in the app notices that
 * it has gone old — it just keeps reporting last month's balance as today's.
 * This is the only thing that says so.
 */
export default function StaleManualValuesAlert({
  holdings,
  action,
}: StaleManualValuesAlertProps) {
  const stale = findStaleManualHoldings(holdings);
  if (stale.length === 0) {
    return null;
  }

  return (
    <Alert severity="info" action={action}>
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
