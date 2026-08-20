"use client";

import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ApiError } from "@/lib/apiError";
import type { ManualValueEntry, PricedHolding } from "@/lib/api";
import { useRecordManualValues } from "@/lib/hooks";
import { describeError } from "@/utils/describeError";
import {
  describeManualValueAge,
  isManualValueStale,
} from "@/utils/manualValueFreshness";

interface ManualValuesModalProps {
  holdings: PricedHolding[];
  onClose: () => void;
}

/**
 * The monthly pass over everything no provider can price — the pension and
 * study funds above all. They are read off a statement, so they are reviewed
 * together rather than opened one edit form at a time, and submitting re-dates
 * every line whether or not its number moved.
 */
export default function ManualValuesModal({
  holdings,
  onClose,
}: ManualValuesModalProps) {
  const manualHoldings = holdings.filter(
    (holding) => holding.priceSource === "MANUAL"
  );
  const [valueByHoldingId, setValueByHoldingId] = useState<
    Record<string, string>
  >(() => toInitialValues(manualHoldings));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const recordManualValues = useRecordManualValues();

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const entries = toEntries(manualHoldings, valueByHoldingId);
    const emptyHolding = manualHoldings.find(
      (holding) => (valueByHoldingId[holding.id] ?? "").trim().length === 0
    );
    if (emptyHolding) {
      setFormError(
        `Every value has to be confirmed before the review is saved (${emptyHolding.assetName} is empty)`
      );
      return;
    }

    try {
      await recordManualValues.mutateAsync(entries);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(toHoldingErrors(error.fieldErrors, manualHoldings));
        setFormError(error.message);
        return;
      }
      setFormError(describeError(error));
    }
  };

  return (
    <Dialog
      open
      onClose={recordManualValues.isPending ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { component: "form", onSubmit: handleSubmit } }}
    >
      <DialogTitle sx={{ typography: "h4" }}>Confirm manual values</DialogTitle>

      <DialogContent dividers>
        <DialogContentText variant="body2" sx={{ mb: 2 }}>
          Read each balance off its statement and save. Every line is re-dated,
          even one whose number has not moved.
        </DialogContentText>

        {manualHoldings.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nothing here is priced by hand yet.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {manualHoldings.map((holding) => (
              <Box key={holding.id}>
                <TextField
                  id={`manual-value-${holding.id}`}
                  label={holding.assetName}
                  type="number"
                  value={valueByHoldingId[holding.id] ?? ""}
                  onChange={(event) =>
                    setValueByHoldingId((current) => ({
                      ...current,
                      [holding.id]: event.target.value,
                    }))
                  }
                  slotProps={{
                    htmlInput: { step: "any", dir: "auto" },
                    inputLabel: { dir: "auto" },
                  }}
                  fullWidth
                  error={Boolean(fieldErrors[holding.id])}
                  helperText={
                    fieldErrors[holding.id] ?? (
                      <Box
                        component="span"
                        sx={{
                          color: isManualValueStale(
                            holding.manualValueUpdatedAt
                          )
                            ? "warning.main"
                            : undefined,
                        }}
                      >
                        {holding.platform.name} —{" "}
                        {describeManualValueAge(holding.manualValueUpdatedAt)}
                      </Box>
                    )
                  }
                />
              </Box>
            ))}
          </Stack>
        )}

        {formError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {formError}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={onClose}
          disabled={recordManualValues.isPending}
          color="inherit"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={recordManualValues.isPending || manualHoldings.length === 0}
        >
          {recordManualValues.isPending ? "Saving…" : "Save values"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function toInitialValues(
  manualHoldings: PricedHolding[]
): Record<string, string> {
  return Object.fromEntries(
    manualHoldings.map((holding) => [
      holding.id,
      holding.manualValueNis === null ? "" : String(holding.manualValueNis),
    ])
  );
}

function toEntries(
  manualHoldings: PricedHolding[],
  valueByHoldingId: Record<string, string>
): ManualValueEntry[] {
  return manualHoldings.map((holding) => ({
    holdingId: holding.id,
    manualValueNis: Number(valueByHoldingId[holding.id]),
  }));
}

/**
 * The route keys its errors by position in the submitted array, which is the
 * only thing it can name; the form needs them back on the holding they came
 * from.
 */
function toHoldingErrors(
  fieldErrors: Record<string, string>,
  manualHoldings: PricedHolding[]
): Record<string, string> {
  const errorsByHoldingId: Record<string, string> = {};

  for (const [field, message] of Object.entries(fieldErrors)) {
    const index = Number(field.split(".")[1]);
    const holding = manualHoldings[index];
    if (holding) {
      errorsByHoldingId[holding.id] = message;
    }
  }

  return errorsByHoldingId;
}
