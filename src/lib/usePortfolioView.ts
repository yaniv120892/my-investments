"use client";

import { useCallback } from "react";
import { useDisplayCurrency } from "@/components/DisplayCurrencyProvider";
import type { HoldingsResponse } from "@/lib/api";
import { useHoldings } from "@/lib/hooks";
import { formatMoney, type DisplayCurrency } from "@/utils/format";

/** The priced portfolio plus the currency the shell is toggled to. */
export interface LoadedPortfolioView {
  data: HoldingsResponse;
  displayCurrency: DisplayCurrency;
  usdToNisRate: number;
  money: (valueInNis: number) => string;
}

interface PortfolioView extends Omit<LoadedPortfolioView, "data"> {
  data: HoldingsResponse | undefined;
  isLoading: boolean;
  error: unknown;
}

export function usePortfolioView(): PortfolioView {
  const { data, isLoading, error } = useHoldings();
  const { displayCurrency } = useDisplayCurrency();
  const usdToNisRate = data?.summary.usdToNisRate ?? 1;

  const money = useCallback(
    (valueInNis: number) =>
      formatMoney(valueInNis, displayCurrency, usdToNisRate),
    [displayCurrency, usdToNisRate]
  );

  return { data, isLoading, error, displayCurrency, usdToNisRate, money };
}
