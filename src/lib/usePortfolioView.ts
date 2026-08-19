"use client";

import { useCallback } from "react";
import { useDisplayCurrency } from "@/components/DisplayCurrencyProvider";
import { useHoldings } from "@/lib/hooks";
import { formatMoney, type DisplayCurrency } from "@/utils/format";

interface PortfolioView {
  data: ReturnType<typeof useHoldings>["data"];
  isLoading: boolean;
  error: unknown;
  displayCurrency: DisplayCurrency;
  usdToNisRate: number;
  money: (valueInNis: number) => string;
}

/**
 * Every deep-dive page renders the same priced-portfolio payload in the
 * currency the shell is toggled to, so the query and the money formatter are
 * bound together here rather than repeated per page.
 */
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
