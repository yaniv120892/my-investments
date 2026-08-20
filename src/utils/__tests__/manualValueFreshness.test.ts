import { describe, expect, it } from "vitest";
import {
  MANUAL_VALUE_MAX_AGE_DAYS,
  daysSince,
  describeManualValueAge,
  isManualValueStale,
} from "@/utils/manualValueFreshness";

const NOW = new Date("2026-08-20T09:00:00.000Z");

function daysBefore(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

describe("isManualValueStale", () => {
  it("treats a value confirmed this month as fresh", () => {
    expect(isManualValueStale(daysBefore(20), NOW)).toBe(false);
  });

  it("treats a value confirmed beyond the review window as stale", () => {
    expect(
      isManualValueStale(daysBefore(MANUAL_VALUE_MAX_AGE_DAYS), NOW)
    ).toBe(true);
  });

  it("treats a value that was never confirmed as stale", () => {
    expect(isManualValueStale(null, NOW)).toBe(true);
  });

  it("reads an ISO string as the API serialises it", () => {
    expect(isManualValueStale(daysBefore(200).toISOString(), NOW)).toBe(true);
  });
});

describe("daysSince", () => {
  it("counts whole days", () => {
    expect(daysSince(daysBefore(35), NOW)).toBe(35);
  });

  it("reports an unparseable date as infinitely old rather than as today", () => {
    expect(daysSince("not a date", NOW)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("describeManualValueAge", () => {
  it("names the day the reading was taken", () => {
    expect(describeManualValueAge(daysBefore(0), NOW)).toBe("confirmed today");
    expect(describeManualValueAge(daysBefore(1), NOW)).toBe(
      "confirmed yesterday"
    );
    expect(describeManualValueAge(daysBefore(62), NOW)).toBe(
      "confirmed 62 days ago"
    );
  });

  it("says so when no reading was ever taken", () => {
    expect(describeManualValueAge(null, NOW)).toBe("never confirmed");
  });
});
