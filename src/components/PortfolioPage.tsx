"use client";

import type { ReactNode } from "react";
import { Alert, Box, Card, CardContent, Skeleton, Stack } from "@mui/material";
import PageHeader from "@/components/shell/PageHeader";
import {
  usePortfolioView,
  type LoadedPortfolioView,
} from "@/lib/usePortfolioView";

interface PortfolioPageProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  skeletonRows?: number;
  children: (view: LoadedPortfolioView) => ReactNode;
}

export default function PortfolioPage({
  title,
  subtitle,
  action,
  skeletonRows = 2,
  children,
}: PortfolioPageProps) {
  const { data, isLoading, error, displayCurrency, usdToNisRate, money } =
    usePortfolioView();

  const header = (
    <PageHeader title={title} subtitle={subtitle} action={action} />
  );

  if (isLoading) {
    return (
      <>
        {header}
        <PortfolioSkeleton rows={skeletonRows} />
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        {header}
        <Alert severity="error">
          {(error as Error)?.message ?? "Could not load your portfolio."}
        </Alert>
      </>
    );
  }

  return (
    <>
      {header}
      {children({ data, displayCurrency, usdToNisRate, money })}
    </>
  );
}

function PortfolioSkeleton({ rows }: { rows: number }) {
  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
          gap: 2,
        }}
      >
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent>
              <Skeleton variant="text" width="45%" />
              <Skeleton variant="text" width="70%" height={44} />
              <Skeleton variant="text" width="35%" />
            </CardContent>
          </Card>
        ))}
      </Box>
      {Array.from({ length: rows }).map((_, index) => (
        <Card key={index}>
          <CardContent>
            <Skeleton variant="text" width="30%" height={28} />
            <Skeleton variant="rounded" height={180} sx={{ mt: 2 }} />
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
