import { PriceSource } from "@prisma/client";
import { formatDate } from "@/utils/format";

/**
 * A manual value is a reading, not a price: it is as true as the day it was
 * taken. Pension and study funds are the reason — no free provider serves a
 * member's balance, so the owner reads it off a statement roughly monthly.
 * The window allows a few days of slack around that cadence before the app
 * starts saying the figure is old.
 */
export const MANUAL_VALUE_MAX_AGE_DAYS = 35;

const NEVER_CONFIRMED = "never confirmed";
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

interface ManuallyPriceable {
  priceSource: PriceSource;
  manualValueUpdatedAt: Date | string | null;
}

export function daysSince(
  confirmedAt: Date | string,
  now: Date = new Date()
): number {
  const confirmed = new Date(confirmedAt).getTime();
  if (!Number.isFinite(confirmed)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.floor((now.getTime() - confirmed) / MILLISECONDS_PER_DAY);
}

/**
 * A value that was never confirmed counts as stale: it came from an import or
 * a first entry and nobody has looked at it since.
 */
export function isManualValueStale(
  manualValueUpdatedAt: Date | string | null,
  now: Date = new Date()
): boolean {
  if (manualValueUpdatedAt === null) {
    return true;
  }
  return daysSince(manualValueUpdatedAt, now) >= MANUAL_VALUE_MAX_AGE_DAYS;
}

export function isManualHolding(holding: ManuallyPriceable): boolean {
  return holding.priceSource === PriceSource.MANUAL;
}

export function findManualHoldings<THolding extends ManuallyPriceable>(
  holdings: THolding[]
): THolding[] {
  return holdings.filter(isManualHolding);
}

export function findStaleManualHoldings<THolding extends ManuallyPriceable>(
  holdings: THolding[],
  now: Date = new Date()
): THolding[] {
  return findManualHoldings(holdings).filter((holding) =>
    isManualValueStale(holding.manualValueUpdatedAt, now)
  );
}

export function describeManualValueAge(
  manualValueUpdatedAt: Date | string | null,
  now: Date = new Date()
): string {
  if (manualValueUpdatedAt === null) {
    return NEVER_CONFIRMED;
  }

  const days = daysSince(manualValueUpdatedAt, now);
  if (days <= 0) {
    return "confirmed today";
  }
  if (days === 1) {
    return "confirmed yesterday";
  }
  return `confirmed ${days} days ago`;
}

export function describeManualValueAsOf(
  manualValueUpdatedAt: Date | string | null
): string {
  if (manualValueUpdatedAt === null) {
    return NEVER_CONFIRMED;
  }
  return `as of ${formatDate(new Date(manualValueUpdatedAt))}`;
}
