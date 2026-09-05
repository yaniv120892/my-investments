"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AssetClass } from "@prisma/client";
import { useReplaceTargets } from "@/lib/hooks";
import { ApiError } from "@/lib/apiError";
import { getAssetClassLabel } from "@/utils/format";
import { isTargetSumBalanced } from "@/lib/targets/targetPercentRules";
import type { PricedHolding, TargetsResponse } from "@/lib/api";

interface TargetsModalProps {
  open: boolean;
  onClose: () => void;
  liquidHoldings: PricedHolding[];
  targets: TargetsResponse;
}

export default function TargetsModal({
  open,
  onClose,
  liquidHoldings,
  targets,
}: TargetsModalProps) {
  const replaceTargets = useReplaceTargets();
  const [classPercents, setClassPercents] = useState(() =>
    initialClassPercents(targets)
  );
  const [weights, setWeights] = useState(() =>
    initialWeights(liquidHoldings, targets)
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const targetSum = Object.values(classPercents).reduce(
    (total, value) => total + (Number(value) || 0),
    0
  );
  const isBalanced = isTargetSumBalanced(targetSum);

  const save = async () => {
    setFieldErrors({});
    setFormError(null);

    try {
      await replaceTargets.mutateAsync({
        classTargets: Object.fromEntries(
          Object.entries(classPercents).map(([assetClass, value]) => [
            assetClass,
            Number(value) || 0,
          ])
        ),
        withinClassWeights: Object.fromEntries(
          Object.entries(weights).map(([holdingId, value]) => [
            holdingId,
            value.trim() === "" ? null : Number(value),
          ])
        ),
      });
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors);
        setFormError(error.message);
        return;
      }
      setFormError("Could not save the targets");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Allocation targets</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {formError && <Alert severity="error">{formError}</Alert>}

          <Stack spacing={1.5}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="h4" component="h3">
                Asset class
              </Typography>
              <Chip
                size="small"
                color={isBalanced ? "success" : "warning"}
                variant="outlined"
                label={`${targetSum.toFixed(1)}% of 100%`}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              These decide how new money is split. They cover your liquid
              holdings only — pension and קרן השתלמות cannot receive a
              contribution.
            </Typography>

            {Object.values(AssetClass).map((assetClass) => (
              <TextField
                key={assetClass}
                size="small"
                type="number"
                label={`${getAssetClassLabel(assetClass)} %`}
                value={classPercents[assetClass]}
                error={Boolean(fieldErrors[assetClass])}
                helperText={fieldErrors[assetClass]}
                onChange={(event) =>
                  setClassPercents((current) => ({
                    ...current,
                    [assetClass]: event.target.value,
                  }))
                }
              />
            ))}
            {fieldErrors.classTargets && (
              <Alert severity="warning">{fieldErrors.classTargets}</Alert>
            )}
          </Stack>

          <Divider />

          <Stack spacing={1.5}>
            <Typography variant="h4" component="h3">
              Within each class
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Relative weights, not percentages — 2 and 1 means twice as much.
              Leave one blank to keep new money out of that holding.
            </Typography>

            {liquidHoldings.map((holding) => (
              <TextField
                key={holding.id}
                size="small"
                type="number"
                label={`${holding.assetName} · ${getAssetClassLabel(
                  holding.assetClass
                )}`}
                value={weights[holding.id] ?? ""}
                error={Boolean(fieldErrors[holding.id])}
                helperText={fieldErrors[holding.id]}
                onChange={(event) =>
                  setWeights((current) => ({
                    ...current,
                    [holding.id]: event.target.value,
                  }))
                }
              />
            ))}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!isBalanced || replaceTargets.isPending}
          onClick={() => void save()}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function initialClassPercents(
  targets: TargetsResponse
): Record<AssetClass, string> {
  const stored = new Map(
    targets.classTargets.map((target) => [
      target.assetClass,
      String(target.targetPercent),
    ])
  );

  return {
    [AssetClass.EQUITY]: stored.get(AssetClass.EQUITY) ?? "0",
    [AssetClass.CRYPTO]: stored.get(AssetClass.CRYPTO) ?? "0",
    [AssetClass.NON_EQUITY]: stored.get(AssetClass.NON_EQUITY) ?? "0",
  };
}

function initialWeights(
  liquidHoldings: PricedHolding[],
  targets: TargetsResponse
): Record<string, string> {
  const stored = new Map(
    targets.withinClassWeights.map((entry) => [
      entry.holdingId,
      entry.withinClassWeight,
    ])
  );

  return Object.fromEntries(
    liquidHoldings.map((holding) => {
      const weight = stored.get(holding.id);
      return [
        holding.id,
        weight === null || weight === undefined ? "" : String(weight),
      ];
    })
  );
}
