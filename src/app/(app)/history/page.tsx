"use client";

import { Stack } from "@mui/material";
import PortfolioChart from "@/components/PortfolioChart";
import SummaryCards from "@/components/SummaryCards";
import PageHeader from "@/components/shell/PageHeader";
import {
  PortfolioError,
  PortfolioSkeleton,
} from "@/components/PortfolioLoadState";
import { usePortfolioView } from "@/lib/usePortfolioView";

export default function HistoryPage() {
  const { data, isLoading, error, displayCurrency, usdToNisRate, money } =
    usePortfolioView();

  const header = (
    <PageHeader
      title="History"
      subtitle="Portfolio value over time, built from daily snapshots."
    />
  );

  if (isLoading) {
    return (
      <>
        {header}
        <PortfolioSkeleton rows={1} />
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

  return (
    <>
      {header}
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
    </>
  );
}
