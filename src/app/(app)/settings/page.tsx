"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Divider,
  MenuItem,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useColorScheme,
} from "@mui/material";
import PageHeader from "@/components/shell/PageHeader";
import { useDisplayCurrency } from "@/components/DisplayCurrencyProvider";
import { useUpdateSettings, useUserSettings } from "@/lib/hooks";
import { describeError } from "@/utils/describeError";
import { formatCurrency, type DisplayCurrency } from "@/utils/format";

const BASE_CURRENCY_OPTIONS = [
  { value: "NIS", label: "New Shekel (₪)" },
  { value: "USD", label: "US Dollar ($)" },
  { value: "EUR", label: "Euro (€)" },
];

type ColorMode = "system" | "light" | "dark";

export default function SettingsPage() {
  const { data: settingsData, isLoading } = useUserSettings();
  const updateSettings = useUpdateSettings();
  const { mode, setMode } = useColorScheme();
  const { displayCurrency, setDisplayCurrency } = useDisplayCurrency();

  const savedBaseCurrency = settingsData?.baseCurrency ?? "NIS";
  const [baseCurrencyDraft, setBaseCurrencyDraft] = useState<string | null>(
    null
  );
  const [notice, setNotice] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);

  const baseCurrency = baseCurrencyDraft ?? savedBaseCurrency;

  const handleModeChange = (nextMode: ColorMode): void => {
    setMode(nextMode);
    void updateSettings.mutateAsync({ darkMode: nextMode === "dark" });
  };

  const handleSave = async (): Promise<void> => {
    try {
      await updateSettings.mutateAsync({ baseCurrency });
      setBaseCurrencyDraft(null);
      setNotice({ message: "Settings saved", severity: "success" });
    } catch (saveFailure) {
      setNotice({ message: describeError(saveFailure), severity: "error" });
    }
  };

  const header = (
    <PageHeader
      title="Settings"
      subtitle="Appearance and currency preferences for this account."
    />
  );

  if (isLoading) {
    return (
      <>
        {header}
        <Card>
          <CardContent>
            <Skeleton variant="text" width="30%" height={28} />
            <Skeleton variant="rounded" height={220} sx={{ mt: 2 }} />
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      {header}

      <Stack spacing={{ xs: 2, md: 3 }} sx={{ maxWidth: 640 }}>
        <Card>
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Typography variant="h4" component="h2">
              Appearance
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Follow your device or pin a theme.
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={mode ?? "system"}
              onChange={(_, next: ColorMode | null) => {
                if (next) {
                  handleModeChange(next);
                }
              }}
              aria-label="Color mode"
            >
              <ToggleButton value="system">System</ToggleButton>
              <ToggleButton value="light">Light</ToggleButton>
              <ToggleButton value="dark">Dark</ToggleButton>
            </ToggleButtonGroup>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Typography variant="h4" component="h2">
              Currency
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              The base currency is stored on your account. The display toggle
              only changes what this browser shows.
            </Typography>

            <Stack spacing={2.5}>
              <TextField
                select
                label="Base currency"
                value={baseCurrency}
                onChange={(event) => setBaseCurrencyDraft(event.target.value)}
                fullWidth
              >
                {BASE_CURRENCY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>

              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  Display values in
                </Typography>
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
                >
                  <ToggleButton value="NIS">₪ NIS</ToggleButton>
                  <ToggleButton value="USD">$ USD</ToggleButton>
                </ToggleButtonGroup>
              </Stack>

              <Divider />

              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">
                  Preview
                </Typography>
                <Typography variant="h3" component="p">
                  {formatCurrency(1234567.89, baseCurrency)}
                </Typography>
              </Stack>

              <Button
                variant="contained"
                onClick={handleSave}
                disabled={
                  updateSettings.isPending || baseCurrencyDraft === null
                }
                sx={{ alignSelf: "flex-start" }}
              >
                {updateSettings.isPending ? "Saving…" : "Save settings"}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Typography variant="h4" component="h2">
              Account
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {settingsData?.email ?? "—"}
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      <Snackbar
        open={notice !== null}
        autoHideDuration={4000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={notice?.severity ?? "success"}
          onClose={() => setNotice(null)}
          variant="filled"
        >
          {notice?.message ?? ""}
        </Alert>
      </Snackbar>
    </>
  );
}
