"use client";

import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/material";

export default function NotFound() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        bgcolor: "background.default",
      }}
    >
      <Stack spacing={2} alignItems="center" textAlign="center">
        <Typography variant="h1" component="h1">
          404
        </Typography>
        <Typography variant="body1" color="text.secondary">
          The page you are looking for does not exist.
        </Typography>
        <Button component={Link} href="/dashboard" variant="contained">
          Back to dashboard
        </Button>
      </Stack>
    </Box>
  );
}
