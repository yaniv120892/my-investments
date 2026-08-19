"use client";

import { Box } from "@mui/material";
import AllocationBreakdown from "@/components/AllocationBreakdown";
import CurrencyExposure from "@/components/CurrencyExposure";
import PortfolioPage from "@/components/PortfolioPage";
import { getAssetClassLabel, getLiquidityLabel } from "@/utils/format";

export default function AllocationPage() {
  return (
    <PortfolioPage
      title="Allocation"
      subtitle="Where the money sits, sliced four ways."
    >
      {({ data, displayCurrency, usdToNisRate }) => (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: { xs: 2, md: 3 },
          }}
        >
          <AllocationBreakdown
            title="By platform"
            totals={data.allocation.byPlatform}
            displayCurrency={displayCurrency}
            usdToNisRate={usdToNisRate}
          />
          <AllocationBreakdown
            title="By asset class"
            totals={data.allocation.byAssetClass}
            displayCurrency={displayCurrency}
            usdToNisRate={usdToNisRate}
            labelFor={getAssetClassLabel}
          />
          <AllocationBreakdown
            title="Liquidity"
            totals={data.allocation.byLiquidity}
            displayCurrency={displayCurrency}
            usdToNisRate={usdToNisRate}
            labelFor={getLiquidityLabel}
          />
          <CurrencyExposure
            byCurrency={data.allocation.byCurrency}
            displayCurrency={displayCurrency}
            usdToNisRate={usdToNisRate}
          />
        </Box>
      )}
    </PortfolioPage>
  );
}
