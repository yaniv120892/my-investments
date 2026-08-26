import type { PriceSource } from "@prisma/client";
import type { DisplayCurrency } from "@/utils/format.types";

export function formatCurrency(
  amount: number,
  currency: string = "USD"
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency === "NIS" ? "ILS" : currency,
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercentage(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "Just now";
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minutes ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hours ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} days ago`;
  }
}

export type { DisplayCurrency };

export function formatMoney(
  valueInNis: number,
  displayCurrency: DisplayCurrency,
  usdToNisRate: number
): string {
  const value =
    displayCurrency === "USD" ? valueInNis / usdToNisRate : valueInNis;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: displayCurrency === "USD" ? "USD" : "ILS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function getAssetClassLabel(assetClass: string): string {
  switch (assetClass) {
    case "EQUITY":
      return "Equity";
    case "CRYPTO":
      return "Crypto";
    case "NON_EQUITY":
      return "Non-Equity";
    default:
      return assetClass;
  }
}

/**
 * Maya needs a different endpoint for each of its two products and rejects the
 * wrong one with a 403, so the choice cannot be hidden from whoever adds a
 * holding — but it can at least be posed in TASE's own words rather than as an
 * enum member.
 */
export function getPriceSourceLabel(priceSource: PriceSource): string {
  switch (priceSource) {
    case "FINNHUB":
      return "Finnhub (US stocks)";
    case "BINANCE":
      return "Binance (crypto)";
    case "MAYA_ETF":
      return "Maya — traded fund (קרן סל)";
    case "MAYA_FUND":
      return "Maya — mutual fund (קרן נאמנות)";
    case "MANUAL":
      return "Manual";
    default: {
      // A sixth PriceSource fails to compile here until it has a label. The
      // return still matters: a tab loaded before a deploy can be handed a
      // member its bundle predates.
      const unlabelled: never = priceSource;
      return unlabelled;
    }
  }
}

export function getLiquidityLabel(liquidity: string): string {
  switch (liquidity) {
    case "LIQUID":
      return "Liquid";
    case "ILLIQUID":
      return "Illiquid";
    default:
      return liquidity;
  }
}
