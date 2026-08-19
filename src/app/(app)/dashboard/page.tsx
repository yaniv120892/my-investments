"use client";

import { useState } from "react";
import Link from "next/link";
import { Box, Button, Stack } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AllocationBreakdown from "@/components/AllocationBreakdown";
import HoldingFormModal from "@/components/HoldingFormModal";
import PortfolioChart from "@/components/PortfolioChart";
import PricingFailuresAlert from "@/components/PricingFailuresAlert";
import SummaryCards from "@/components/SummaryCards";
import RebalancingSummaryCard from "@/components/dashboard/RebalancingSummaryCard";
import TopHoldingsCard from "@/components/dashboard/TopHoldingsCard";
import PageHeader from "@/components/shell/PageHeader";
import {
  PortfolioError,
  PortfolioSkeleton,
} from "@/components/PortfolioLoadState";
import { usePlatforms } from "@/lib/hooks";
import { usePortfolioView } from "@/lib/usePortfolioView";
import { getAssetClassLabel } from "@/utils/format";

export default function DashboardPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { data, isLoading, error, displayCurrency, usdToNisRate, money } =
    usePortfolioView();
  const { data: platformsData } = usePlatforms();

  const header = (
    <PageHeader
      title="Dashboard"
      subtitle="A summary of your portfolio — open a tab for the deeper dive."
      action={
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => setIsFormOpen(true)}
        >
          Add holding
        </Button>
      }
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

  const { summary, allocation, drift, failures, holdings } = data;

  return (
    <>
      {header}

      <Stack spacing={{ xs: 2, md: 3 }}>
        <SummaryCards
          summary={summary}
          displayCurrency={displayCurrency}
          money={money}
        />

        <PricingFailuresAlert failures={failures} maxRows={3} />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: { xs: 2, md: 3 },
          }}
        >
          <TopHoldingsCard holdings={holdings} money={money} />
          <Stack spacing={{ xs: 2, md: 3 }}>
            <AllocationBreakdown
              title="By asset class"
              totals={allocation.byAssetClass}
              displayCurrency={displayCurrency}
              usdToNisRate={usdToNisRate}
              labelFor={getAssetClassLabel}
            />
            <AllocationBreakdown
              title="By platform"
              totals={allocation.byPlatform}
              displayCurrency={displayCurrency}
              usdToNisRate={usdToNisRate}
              maxRows={4}
            />
          </Stack>
        </Box>

        <PortfolioChart
          displayCurrency={displayCurrency}
          usdToNisRate={usdToNisRate}
          height={240}
        />

        <RebalancingSummaryCard
          drift={drift}
          displayCurrency={displayCurrency}
          usdToNisRate={usdToNisRate}
        />

        <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
          <Button component={Link} href="/allocation" size="small">
            See the full allocation breakdown
          </Button>
        </Box>
      </Stack>

      {isFormOpen && (
        <HoldingFormModal
          holding={null}
          platforms={platformsData?.platforms ?? []}
          onClose={() => setIsFormOpen(false)}
        />
      )}
    </>
  );
}
