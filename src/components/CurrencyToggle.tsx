"use client";

import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useDisplayCurrency } from "@/components/DisplayCurrencyProvider";
import type { DisplayCurrency } from "@/utils/format";

export default function CurrencyToggle({ dense = false }: { dense?: boolean }) {
  const { displayCurrency, setDisplayCurrency } = useDisplayCurrency();

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={displayCurrency}
      onChange={(_, next: DisplayCurrency | null) => {
        if (next) {
          setDisplayCurrency(next);
        }
      }}
      aria-label="Display currency"
      sx={dense ? { "& .MuiToggleButton-root": { px: 2, py: 0.4 } } : undefined}
    >
      <ToggleButton value="NIS">₪ NIS</ToggleButton>
      <ToggleButton value="USD">$ USD</ToggleButton>
    </ToggleButtonGroup>
  );
}
