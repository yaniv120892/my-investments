"use client";

import { Stack, Typography } from "@mui/material";

interface SummaryRowProps {
  label: string;
  caption: string;
  value: string;
  valueColor?: string;
}

export default function SummaryRow({
  label,
  caption,
  value,
  valueColor,
}: SummaryRowProps) {
  return (
    <Stack
      direction="row"
      alignItems="baseline"
      justifyContent="space-between"
      spacing={2}
    >
      <Typography variant="body2" noWrap dir="auto">
        {label}
        <Typography
          component="span"
          variant="caption"
          color="text.secondary"
          sx={{ ml: 1 }}
        >
          {caption}
        </Typography>
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontWeight: 600, whiteSpace: "nowrap" }}
        color={valueColor}
      >
        {value}
      </Typography>
    </Stack>
  );
}
