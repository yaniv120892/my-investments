// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ContributionPlanTable from "@/components/advisor/ContributionPlanTable";
import type { ContributionPlanAccepted } from "@/lib/pricing/contributionPlanner.types";

function acceptedPlan(
  dropped: ContributionPlanAccepted["dropped"]
): ContributionPlanAccepted {
  return {
    status: "planned",
    contributionNis: 1000,
    investableValueNis: 10000,
    byAssetClass: [],
    byHolding: [],
    dropped,
  };
}

describe("ContributionPlanTable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders every dropped entry even when two share the same label", () => {
    // Two holdings on different platforms can carry the same assetName, so
    // the dedupe key must not be the label alone.
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(
      <ContributionPlanTable
        plan={acceptedPlan([
          {
            scope: "holding",
            label: "Emergency Fund",
            amountNis: 40,
            reason: "BELOW_MINIMUM_TICKET",
          },
          {
            scope: "holding",
            label: "Emergency Fund",
            amountNis: 25,
            reason: "BELOW_MINIMUM_TICKET",
          },
        ])}
        displayCurrency="NIS"
        usdToNisRate={1}
      />
    );

    expect(
      screen.getAllByText("Emergency Fund", { exact: false })
    ).toHaveLength(2);

    const duplicateKeyWarning = consoleError.mock.calls.some((call) =>
      call.some(
        (argument) =>
          typeof argument === "string" && argument.includes("same key")
      )
    );
    expect(duplicateKeyWarning).toBe(false);
  });
});
