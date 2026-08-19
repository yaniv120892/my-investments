"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { queryClient } from "@/lib/queryClient";
import DisplayCurrencyProvider from "@/components/DisplayCurrencyProvider";
import theme from "@/theme";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme} defaultMode="system">
        <CssBaseline />
        <DisplayCurrencyProvider>{children}</DisplayCurrencyProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
