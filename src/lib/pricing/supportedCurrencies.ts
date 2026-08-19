export const SUPPORTED_CURRENCIES = ["NIS", "USD", "EUR"] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(
  currency: string
): currency is SupportedCurrency {
  return SUPPORTED_CURRENCIES.some((supported) => supported === currency);
}
