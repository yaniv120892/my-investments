"use client";

import { Alert, AlertTitle, Box, Typography } from "@mui/material";
import type { PricingFailure } from "@/lib/api";

interface PricingFailuresAlertProps {
  failures: PricingFailure[];
  /** The dashboard only teases the first few; the holdings page lists them all. */
  maxRows?: number;
}

export default function PricingFailuresAlert({
  failures,
  maxRows,
}: PricingFailuresAlertProps) {
  if (failures.length === 0) {
    return null;
  }

  const shown = maxRows ? failures.slice(0, maxRows) : failures;
  const hiddenCount = failures.length - shown.length;

  return (
    <Alert severity="warning">
      <AlertTitle>
        {failures.length} asset{failures.length === 1 ? "" : "s"} could not be
        priced
      </AlertTitle>
      <Typography variant="body2" sx={{ mb: 1 }}>
        The portfolio total is hidden rather than shown understated.
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {shown.map((failure) => (
          <Typography
            key={failure.holdingId}
            component="li"
            variant="body2"
            dir="auto"
          >
            <strong>{failure.assetName}</strong>
            {failure.sourceSymbol ? ` (${failure.sourceSymbol})` : ""} —{" "}
            {failure.reason}
          </Typography>
        ))}
        {hiddenCount > 0 && (
          <Typography component="li" variant="body2" color="text.secondary">
            + {hiddenCount} more
          </Typography>
        )}
      </Box>
    </Alert>
  );
}
