"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { DisplayCurrency } from "@/utils/format";

const STORAGE_KEY = "display-currency";

interface DisplayCurrencyContextValue {
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
}

const DisplayCurrencyContext = createContext<DisplayCurrencyContextValue>({
  displayCurrency: "NIS",
  setDisplayCurrency: () => {},
});

function readStoredCurrency(): DisplayCurrency | null {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "USD" || stored === "NIS" ? stored : null;
}

export default function DisplayCurrencyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [displayCurrency, setDisplayCurrencyState] =
    useState<DisplayCurrency>("NIS");

  // Read after mount rather than during initial state so the server and client
  // render the same markup.
  useEffect(() => {
    const stored = readStoredCurrency();
    if (stored) {
      setDisplayCurrencyState(stored);
    }
  }, []);

  const setDisplayCurrency = useCallback((currency: DisplayCurrency) => {
    setDisplayCurrencyState(currency);
    window.localStorage.setItem(STORAGE_KEY, currency);
  }, []);

  const value = useMemo(
    () => ({ displayCurrency, setDisplayCurrency }),
    [displayCurrency, setDisplayCurrency]
  );

  return (
    <DisplayCurrencyContext.Provider value={value}>
      {children}
    </DisplayCurrencyContext.Provider>
  );
}

export function useDisplayCurrency(): DisplayCurrencyContextValue {
  return useContext(DisplayCurrencyContext);
}
