"use client";

import { useState } from "react";
import Link from "next/link";
import { Box, Button, Stack } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AllocationBreakdown from "@/components/AllocationBreakdown";
import HoldingFormModal from "@/components/HoldingFormModal";
import PortfolioChart from "@/components/PortfolioChart";
import PortfolioPage from "@/components/PortfolioPage";
import PricingFailuresAlert from "@/components/PricingFailuresAlert";
import SummaryCards from "@/components/SummaryCards";
import RebalancingSummaryCard from "@/components/dashboard/RebalancingSummaryCard";
import TopHoldingsCard from "@/components/dashboard/TopHoldingsCard";
import { usePlatforms } from "@/lib/hooks";
import { getAssetClassLabel } from "@/utils/format";

export default function DashboardPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { data: platformsData } = usePlatforms();

  return (
    <PortfolioPage
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
    >
      {({ data, displayCurrency, usdToNisRate, money }) => (
        <>
          <Stack spacing={{ xs: 2, md: 3 }}>
            <SummaryCards
              summary={data.summary}
              displayCurrency={displayCurrency}
              money={money}
            />

            <PricingFailuresAlert failures={data.failures} maxRows={3} />

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: { xs: 2, md: 3 },
              }}
            >
              <TopHoldingsCard holdings={data.holdings} money={money} />
              <Stack spacing={{ xs: 2, md: 3 }}>
                <AllocationBreakdown
                  title="By asset class"
                  totals={data.allocation.byAssetClass}
                  displayCurrency={displayCurrency}
                  usdToNisRate={usdToNisRate}
                  labelFor={getAssetClassLabel}
                />
                <AllocationBreakdown
                  title="By platform"
                  totals={data.allocation.byPlatform}
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
              drift={data.drift}
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
      )}
    </PortfolioPage>
  );
}
