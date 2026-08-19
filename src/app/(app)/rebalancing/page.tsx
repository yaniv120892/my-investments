"use client";

import { Card, CardContent, Typography } from "@mui/material";
import TargetDrift from "@/components/TargetDrift";
import PageHeader from "@/components/shell/PageHeader";
import {
  PortfolioError,
  PortfolioSkeleton,
} from "@/components/PortfolioLoadState";
import { usePortfolioView } from "@/lib/usePortfolioView";

export default function RebalancingPage() {
  const { data, isLoading, error, displayCurrency, usdToNisRate } =
    usePortfolioView();

  const header = (
    <PageHeader
      title="Rebalancing"
      subtitle="Actual versus target weight per platform, and the trade that closes the gap."
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

  if (data.drift.length === 0) {
    return (
      <>
        {header}
        <Card>
          <CardContent sx={{ py: 6, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              No targets set yet. Give a holding a target percent and its
              platform shows up here.
            </Typography>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      {header}
      <TargetDrift
        drift={data.drift}
        displayCurrency={displayCurrency}
        usdToNisRate={usdToNisRate}
      />
    </>
  );
}
