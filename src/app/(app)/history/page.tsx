"use client";

import { Stack } from "@mui/material";
import PortfolioChart from "@/components/PortfolioChart";
import PortfolioPage from "@/components/PortfolioPage";
import SummaryCards from "@/components/SummaryCards";

export default function HistoryPage() {
  return (
    <PortfolioPage
      title="History"
      subtitle="Portfolio value over time, built from daily snapshots."
      skeletonRows={1}
    >
      {({ data, displayCurrency, usdToNisRate, money }) => (
        <Stack spacing={{ xs: 2, md: 3 }}>
          <SummaryCards
            summary={data.summary}
            displayCurrency={displayCurrency}
            money={money}
          />
          <PortfolioChart
            displayCurrency={displayCurrency}
            usdToNisRate={usdToNisRate}
            height={380}
          />
        </Stack>
      )}
    </PortfolioPage>
  );
}
