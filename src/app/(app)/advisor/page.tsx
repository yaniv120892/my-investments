"use client";

import { Stack } from "@mui/material";
import PortfolioPage from "@/components/PortfolioPage";
import TargetsCard from "@/components/advisor/TargetsCard";
import AdvisorChat from "@/components/advisor/AdvisorChat";
import ContributionPlanTable from "@/components/advisor/ContributionPlanTable";
import { useAdvisorChat } from "@/lib/useAdvisorChat";

export default function AdvisorPage() {
  const chat = useAdvisorChat();

  return (
    <PortfolioPage
      title="Advisor"
      subtitle="Where new money should go to move your liquid holdings toward target."
    >
      {({ data, displayCurrency, usdToNisRate }) => (
        <Stack spacing={{ xs: 2, md: 3 }}>
          <TargetsCard holdings={data.holdings} />
          <AdvisorChat chat={chat} />
          {chat.plan && (
            <ContributionPlanTable
              plan={chat.plan}
              displayCurrency={displayCurrency}
              usdToNisRate={usdToNisRate}
            />
          )}
        </Stack>
      )}
    </PortfolioPage>
  );
}
