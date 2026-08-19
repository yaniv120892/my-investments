"use client";

import { useState, type FormEvent } from "react";
import type {
  AssetClass,
  Liquidity,
  Platform,
  PriceSource,
} from "@prisma/client";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from "@mui/material";
import { ApiError } from "@/lib/apiError";
import type { CreateHoldingInput, PricedHolding } from "@/lib/api";
import {
  useCreateHolding,
  useCreatePlatform,
  useUpdateHolding,
} from "@/lib/hooks";
import { SUPPORTED_CURRENCIES } from "@/lib/pricing/supportedCurrencies";
import { getAssetClassLabel, getLiquidityLabel } from "@/utils/format";
import { describeError } from "@/utils/describeError";

interface HoldingFormModalProps {
  holding: PricedHolding | null;
  platforms: Platform[];
  onClose: () => void;
}

interface HoldingFormValues {
  platformId: string;
  newPlatformName: string;
  newPlatformBaseCurrency: string;
  assetName: string;
  assetClass: AssetClass;
  liquidity: Liquidity;
  quantity: string;
  priceSource: PriceSource;
  sourceSymbol: string;
  currency: string;
  targetPercent: string;
  manualValueNis: string;
}

const NEW_PLATFORM_VALUE = "__new__";

const ASSET_CLASS_OPTIONS: AssetClass[] = ["EQUITY", "CRYPTO", "NON_EQUITY"];
const LIQUIDITY_OPTIONS: Liquidity[] = ["LIQUID", "ILLIQUID"];
const PRICE_SOURCE_OPTIONS: PriceSource[] = [
  "FINNHUB",
  "BINANCE",
  "BIZPORTAL",
  "MANUAL",
];

export default function HoldingFormModal({
  holding,
  platforms,
  onClose,
}: HoldingFormModalProps) {
  const [values, setValues] = useState<HoldingFormValues>(() =>
    toInitialValues(holding, platforms)
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const createPlatform = useCreatePlatform();
  const createHolding = useCreateHolding();
  const updateHolding = useUpdateHolding();

  const isManuallyPriced = values.priceSource === "MANUAL";
  const isCreatingPlatform = values.platformId === NEW_PLATFORM_VALUE;
  const isSaving =
    createPlatform.isPending ||
    createHolding.isPending ||
    updateHolding.isPending;

  const updateValue = <TField extends keyof HoldingFormValues>(
    field: TField,
    value: HoldingFormValues[TField]
  ): void => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const resolvePlatformId = async (): Promise<string> => {
    if (!isCreatingPlatform) {
      return values.platformId;
    }
    const response = await createPlatform.mutateAsync({
      name: values.newPlatformName,
      baseCurrency: values.newPlatformBaseCurrency,
    });
    return response.platform.id;
  };

  const handleSubmitError = (error: unknown): void => {
    if (error instanceof ApiError) {
      setFieldErrors(error.fieldErrors);
      setFormError(error.message);
      return;
    }
    setFormError(describeError(error));
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    try {
      const platformId = await resolvePlatformId();
      const input = toHoldingInput(values, platformId);
      if (holding) {
        await updateHolding.mutateAsync({ holdingId: holding.id, data: input });
      } else {
        await createHolding.mutateAsync(input);
      }
      onClose();
    } catch (error) {
      handleSubmitError(error);
    }
  };

  const errorProps = (field: string, helperText?: string) => ({
    error: Boolean(fieldErrors[field]),
    helperText: fieldErrors[field] ?? helperText,
  });

  return (
    <Dialog
      open
      onClose={isSaving ? undefined : onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { component: "form", onSubmit: handleSubmit } }}
    >
      <DialogTitle sx={{ typography: "h4" }}>
        {holding ? "Edit holding" : "Add holding"}
      </DialogTitle>

      <DialogContent dividers>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
            pt: 1,
          }}
        >
          <TextField
            select
            id="platformId"
            label="Platform"
            value={values.platformId}
            onChange={(event) => updateValue("platformId", event.target.value)}
            fullWidth
            sx={{ gridColumn: { sm: "span 2" } }}
            {...errorProps("platformId")}
          >
            <MenuItem value="">Select a platform</MenuItem>
            {platforms.map((platform) => (
              <MenuItem key={platform.id} value={platform.id}>
                {platform.name}
              </MenuItem>
            ))}
            <MenuItem value={NEW_PLATFORM_VALUE}>+ New platform</MenuItem>
          </TextField>

          {isCreatingPlatform && (
            <>
              <TextField
                id="newPlatformName"
                label="New platform name"
                value={values.newPlatformName}
                onChange={(event) =>
                  updateValue("newPlatformName", event.target.value)
                }
                slotProps={{ htmlInput: { dir: "auto" } }}
                fullWidth
                {...errorProps("name")}
              />
              <TextField
                select
                id="newPlatformBaseCurrency"
                label="New platform base currency"
                value={values.newPlatformBaseCurrency}
                onChange={(event) =>
                  updateValue("newPlatformBaseCurrency", event.target.value)
                }
                fullWidth
                {...errorProps("baseCurrency")}
              >
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <MenuItem key={currency} value={currency}>
                    {currency}
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}

          <TextField
            id="assetName"
            label="Asset name"
            value={values.assetName}
            onChange={(event) => updateValue("assetName", event.target.value)}
            slotProps={{ htmlInput: { dir: "auto" } }}
            fullWidth
            sx={{ gridColumn: { sm: "span 2" } }}
            {...errorProps("assetName")}
          />

          <TextField
            select
            id="assetClass"
            label="Asset class"
            value={values.assetClass}
            onChange={(event) => {
              const selected = findOption(
                ASSET_CLASS_OPTIONS,
                event.target.value
              );
              if (selected) {
                updateValue("assetClass", selected);
              }
            }}
            fullWidth
            {...errorProps("assetClass")}
          >
            {ASSET_CLASS_OPTIONS.map((assetClass) => (
              <MenuItem key={assetClass} value={assetClass}>
                {getAssetClassLabel(assetClass)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            id="liquidity"
            label="Liquidity"
            value={values.liquidity}
            onChange={(event) => {
              const selected = findOption(LIQUIDITY_OPTIONS, event.target.value);
              if (selected) {
                updateValue("liquidity", selected);
              }
            }}
            fullWidth
            {...errorProps("liquidity")}
          >
            {LIQUIDITY_OPTIONS.map((liquidity) => (
              <MenuItem key={liquidity} value={liquidity}>
                {getLiquidityLabel(liquidity)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            id="priceSource"
            label="Price source"
            value={values.priceSource}
            onChange={(event) => {
              const selected = findOption(
                PRICE_SOURCE_OPTIONS,
                event.target.value
              );
              if (selected) {
                updateValue("priceSource", selected);
              }
            }}
            fullWidth
            {...errorProps("priceSource")}
          >
            {PRICE_SOURCE_OPTIONS.map((priceSource) => (
              <MenuItem key={priceSource} value={priceSource}>
                {priceSource}
              </MenuItem>
            ))}
          </TextField>

          {isManuallyPriced ? (
            <TextField
              id="manualValueNis"
              label="Current value (NIS)"
              type="number"
              value={values.manualValueNis}
              onChange={(event) =>
                updateValue("manualValueNis", event.target.value)
              }
              slotProps={{ htmlInput: { step: "any" } }}
              fullWidth
              {...errorProps(
                "manualValueNis",
                "Stored as a fixed amount until you update it again."
              )}
            />
          ) : (
            <>
              <TextField
                id="sourceSymbol"
                label="Symbol"
                value={values.sourceSymbol}
                onChange={(event) =>
                  updateValue("sourceSymbol", event.target.value)
                }
                fullWidth
                {...errorProps("sourceSymbol")}
              />
              <TextField
                select
                id="currency"
                label="Currency"
                value={values.currency}
                onChange={(event) => updateValue("currency", event.target.value)}
                fullWidth
                {...errorProps("currency")}
              >
                {SUPPORTED_CURRENCIES.map((currency) => (
                  <MenuItem key={currency} value={currency}>
                    {currency}
                  </MenuItem>
                ))}
              </TextField>
            </>
          )}

          <TextField
            id="quantity"
            label="Quantity"
            type="number"
            value={values.quantity}
            onChange={(event) => updateValue("quantity", event.target.value)}
            slotProps={{ htmlInput: { step: "any" } }}
            fullWidth
            {...errorProps("quantity")}
          />

          <TextField
            id="targetPercent"
            label="Target percent (optional)"
            type="number"
            value={values.targetPercent}
            onChange={(event) =>
              updateValue("targetPercent", event.target.value)
            }
            slotProps={{ htmlInput: { step: "any" } }}
            fullWidth
            {...errorProps("targetPercent")}
          />

          {formError && (
            <Alert severity="error" sx={{ gridColumn: { sm: "span 2" } }}>
              {formError}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isSaving} color="inherit">
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save holding"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function toInitialValues(
  holding: PricedHolding | null,
  platforms: Platform[]
): HoldingFormValues {
  if (!holding) {
    return {
      platformId: platforms[0]?.id ?? "",
      newPlatformName: "",
      newPlatformBaseCurrency: "NIS",
      assetName: "",
      assetClass: "EQUITY",
      liquidity: "LIQUID",
      quantity: "",
      priceSource: "FINNHUB",
      sourceSymbol: "",
      currency: "USD",
      targetPercent: "",
      manualValueNis: "",
    };
  }

  return {
    platformId: holding.platformId,
    newPlatformName: "",
    newPlatformBaseCurrency: "NIS",
    assetName: holding.assetName,
    assetClass: holding.assetClass,
    liquidity: holding.liquidity,
    quantity: String(holding.quantity),
    priceSource: holding.priceSource,
    sourceSymbol: holding.sourceSymbol ?? "",
    currency: holding.currency,
    targetPercent:
      holding.targetPercent === null ? "" : String(holding.targetPercent),
    manualValueNis:
      holding.manualValueNis === null ? "" : String(holding.manualValueNis),
  };
}

function toHoldingInput(
  values: HoldingFormValues,
  platformId: string
): CreateHoldingInput {
  const isManuallyPriced = values.priceSource === "MANUAL";

  return {
    platformId,
    assetName: values.assetName,
    assetClass: values.assetClass,
    liquidity: values.liquidity,
    quantity: toRequiredNumber(values.quantity),
    priceSource: values.priceSource,
    sourceSymbol: isManuallyPriced ? null : values.sourceSymbol,
    currency: isManuallyPriced ? "NIS" : values.currency,
    targetPercent: toOptionalNumber(values.targetPercent),
    manualValueNis: isManuallyPriced
      ? toOptionalNumber(values.manualValueNis)
      : null,
  };
}

function toRequiredNumber(text: string): number {
  if (text.trim().length === 0) {
    return Number.NaN;
  }
  return Number(text);
}

function toOptionalNumber(text: string): number | null {
  if (text.trim().length === 0) {
    return null;
  }
  return Number(text);
}

function findOption<TOption extends string>(
  options: TOption[],
  value: string
): TOption | null {
  return options.find((option) => option === value) ?? null;
}
