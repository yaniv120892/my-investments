"use client";

import AllocationBreakdown from "@/components/AllocationBreakdown";
import type { DisplayCurrency } from "@/utils/format";

interface CurrencyExposureProps {
  byCurrency: Record<string, number>;
  displayCurrency: DisplayCurrency;
  usdToNisRate: number;
}

export default function CurrencyExposure({
  byCurrency,
  displayCurrency,
  usdToNisRate,
}: CurrencyExposureProps) {
  return (
    <AllocationBreakdown
      title="Currency Exposure"
      totals={byCurrency}
      displayCurrency={displayCurrency}
      usdToNisRate={usdToNisRate}
      labelFor={(key) => `${key}-denominated`}
    />
  );
}
