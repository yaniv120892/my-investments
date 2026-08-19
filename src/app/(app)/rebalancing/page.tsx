"use client";

import { Card, CardContent, Typography } from "@mui/material";
import PortfolioPage from "@/components/PortfolioPage";
import TargetDrift from "@/components/TargetDrift";

export default function RebalancingPage() {
  return (
    <PortfolioPage
      title="Rebalancing"
      subtitle="Actual versus target weight per platform, and the trade that closes the gap."
    >
      {({ data, displayCurrency, usdToNisRate }) =>
        data.drift.length === 0 ? (
          <Card>
            <CardContent sx={{ py: 6, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                No targets set yet. Give a holding a target percent and its
                platform shows up here.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <TargetDrift
            drift={data.drift}
            displayCurrency={displayCurrency}
            usdToNisRate={usdToNisRate}
          />
        )
      }
    </PortfolioPage>
  );
}
