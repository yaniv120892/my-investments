"use client";

import { Alert, Box, Card, CardContent, Skeleton, Stack } from "@mui/material";

export function PortfolioSkeleton({ rows = 3 }: { rows?: number }) {
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

export function PortfolioError({ error }: { error: unknown }) {
  return (
    <Alert severity="error">
      {(error as Error)?.message ?? "Could not load your portfolio."}
    </Alert>
  );
}
