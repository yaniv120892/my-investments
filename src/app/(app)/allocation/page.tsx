"use client";

import { Box } from "@mui/material";
import AllocationBreakdown from "@/components/AllocationBreakdown";
import CurrencyExposure from "@/components/CurrencyExposure";
import PageHeader from "@/components/shell/PageHeader";
import {
  PortfolioError,
  PortfolioSkeleton,
} from "@/components/PortfolioLoadState";
import { usePortfolioView } from "@/lib/usePortfolioView";
import { getAssetClassLabel, getLiquidityLabel } from "@/utils/format";

export default function AllocationPage() {
  const { data, isLoading, error, displayCurrency, usdToNisRate } =
    usePortfolioView();

  const header = (
    <PageHeader
      title="Allocation"
      subtitle="Where the money sits, sliced four ways."
    />
  );

  if (isLoading) {
    return (
      <>
        {header}
        <PortfolioSkeleton rows={2} />
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        {header}
        <PortfolioError error={error} />
      </>
    );
  }

  const { allocation } = data;

  return (
    <>
      {header}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: { xs: 2, md: 3 },
        }}
      >
        <AllocationBreakdown
          title="By platform"
          totals={allocation.byPlatform}
          displayCurrency={displayCurrency}
          usdToNisRate={usdToNisRate}
        />
        <AllocationBreakdown
          title="By asset class"
          totals={allocation.byAssetClass}
          displayCurrency={displayCurrency}
          usdToNisRate={usdToNisRate}
          labelFor={getAssetClassLabel}
        />
        <AllocationBreakdown
          title="Liquidity"
          totals={allocation.byLiquidity}
          displayCurrency={displayCurrency}
          usdToNisRate={usdToNisRate}
          labelFor={getLiquidityLabel}
        />
        <CurrencyExposure
          byCurrency={allocation.byCurrency}
          displayCurrency={displayCurrency}
          usdToNisRate={usdToNisRate}
        />
      </Box>
    </>
  );
}
