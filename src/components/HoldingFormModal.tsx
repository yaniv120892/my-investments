"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { AssetClass, Liquidity, Platform, PriceSource } from "@prisma/client";
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
  "MAYA_ETF",
  "MAYA_FUND",
  "MANUAL",
];

const FIELD_CLASS_NAME =
  "block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500";
const LABEL_CLASS_NAME =
  "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

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

  const fieldError = (field: string): ReactNode => {
    if (!fieldErrors[field]) {
      return null;
    }
    return (
      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
        {fieldErrors[field]}
      </p>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl my-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg"
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            {holding ? "Edit holding" : "Add holding"}
          </h2>
        </div>

        <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="platformId" className={LABEL_CLASS_NAME}>
              Platform
            </label>
            <select
              id="platformId"
              value={values.platformId}
              onChange={(event) =>
                updateValue("platformId", event.target.value)
              }
              className={FIELD_CLASS_NAME}
            >
              <option value="">Select a platform</option>
              {platforms.map((platform) => (
                <option key={platform.id} value={platform.id}>
                  {platform.name}
                </option>
              ))}
              <option value={NEW_PLATFORM_VALUE}>+ New platform</option>
            </select>
            {fieldError("platformId")}
          </div>

          {isCreatingPlatform && (
            <>
              <div>
                <label htmlFor="newPlatformName" className={LABEL_CLASS_NAME}>
                  New platform name
                </label>
                <input
                  id="newPlatformName"
                  dir="auto"
                  value={values.newPlatformName}
                  onChange={(event) =>
                    updateValue("newPlatformName", event.target.value)
                  }
                  className={FIELD_CLASS_NAME}
                />
                {fieldError("name")}
              </div>
              <div>
                <label
                  htmlFor="newPlatformBaseCurrency"
                  className={LABEL_CLASS_NAME}
                >
                  New platform base currency
                </label>
                <select
                  id="newPlatformBaseCurrency"
                  value={values.newPlatformBaseCurrency}
                  onChange={(event) =>
                    updateValue("newPlatformBaseCurrency", event.target.value)
                  }
                  className={FIELD_CLASS_NAME}
                >
                  {SUPPORTED_CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
                {fieldError("baseCurrency")}
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <label htmlFor="assetName" className={LABEL_CLASS_NAME}>
              Asset name
            </label>
            <input
              id="assetName"
              dir="auto"
              value={values.assetName}
              onChange={(event) => updateValue("assetName", event.target.value)}
              className={FIELD_CLASS_NAME}
            />
            {fieldError("assetName")}
          </div>

          <div>
            <label htmlFor="assetClass" className={LABEL_CLASS_NAME}>
              Asset class
            </label>
            <select
              id="assetClass"
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
              className={FIELD_CLASS_NAME}
            >
              {ASSET_CLASS_OPTIONS.map((assetClass) => (
                <option key={assetClass} value={assetClass}>
                  {getAssetClassLabel(assetClass)}
                </option>
              ))}
            </select>
            {fieldError("assetClass")}
          </div>

          <div>
            <label htmlFor="liquidity" className={LABEL_CLASS_NAME}>
              Liquidity
            </label>
            <select
              id="liquidity"
              value={values.liquidity}
              onChange={(event) => {
                const selected = findOption(
                  LIQUIDITY_OPTIONS,
                  event.target.value
                );
                if (selected) {
                  updateValue("liquidity", selected);
                }
              }}
              className={FIELD_CLASS_NAME}
            >
              {LIQUIDITY_OPTIONS.map((liquidity) => (
                <option key={liquidity} value={liquidity}>
                  {getLiquidityLabel(liquidity)}
                </option>
              ))}
            </select>
            {fieldError("liquidity")}
          </div>

          <div>
            <label htmlFor="priceSource" className={LABEL_CLASS_NAME}>
              Price source
            </label>
            <select
              id="priceSource"
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
              className={FIELD_CLASS_NAME}
            >
              {PRICE_SOURCE_OPTIONS.map((priceSource) => (
                <option key={priceSource} value={priceSource}>
                  {priceSource}
                </option>
              ))}
            </select>
            {fieldError("priceSource")}
          </div>

          {isManuallyPriced ? (
            <div>
              <label htmlFor="manualValueNis" className={LABEL_CLASS_NAME}>
                Current value (NIS)
              </label>
              <input
                id="manualValueNis"
                type="number"
                step="any"
                value={values.manualValueNis}
                onChange={(event) =>
                  updateValue("manualValueNis", event.target.value)
                }
                className={FIELD_CLASS_NAME}
              />
              {fieldError("manualValueNis")}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Stored as a fixed amount until you update it again.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="sourceSymbol" className={LABEL_CLASS_NAME}>
                  Symbol
                </label>
                <input
                  id="sourceSymbol"
                  value={values.sourceSymbol}
                  onChange={(event) =>
                    updateValue("sourceSymbol", event.target.value)
                  }
                  className={FIELD_CLASS_NAME}
                />
                {fieldError("sourceSymbol")}
              </div>
              <div>
                <label htmlFor="currency" className={LABEL_CLASS_NAME}>
                  Currency
                </label>
                <select
                  id="currency"
                  value={values.currency}
                  onChange={(event) =>
                    updateValue("currency", event.target.value)
                  }
                  className={FIELD_CLASS_NAME}
                >
                  {SUPPORTED_CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
                {fieldError("currency")}
              </div>
            </>
          )}

          <div>
            <label htmlFor="quantity" className={LABEL_CLASS_NAME}>
              Quantity
            </label>
            <input
              id="quantity"
              type="number"
              step="any"
              value={values.quantity}
              onChange={(event) => updateValue("quantity", event.target.value)}
              className={FIELD_CLASS_NAME}
            />
            {fieldError("quantity")}
          </div>

          <div>
            <label htmlFor="targetPercent" className={LABEL_CLASS_NAME}>
              Target percent (optional)
            </label>
            <input
              id="targetPercent"
              type="number"
              step="any"
              value={values.targetPercent}
              onChange={(event) =>
                updateValue("targetPercent", event.target.value)
              }
              className={FIELD_CLASS_NAME}
            />
            {fieldError("targetPercent")}
          </div>
        </div>

        {formError && (
          <div className="mx-6 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md text-sm">
            {formError}
          </div>
        )}

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save holding"}
          </button>
        </div>
      </form>
    </div>
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
