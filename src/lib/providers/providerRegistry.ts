import { PriceSource } from "@prisma/client";
import type { PriceProvider } from "@/lib/providers/types";
import { finnhubProvider } from "@/lib/providers/FinnhubProvider";
import { binanceProvider } from "@/lib/providers/BinanceProvider";
import { bizportalProvider } from "@/lib/providers/BizportalProvider";

const PROVIDERS = {
  [PriceSource.FINNHUB]: finnhubProvider,
  [PriceSource.BINANCE]: binanceProvider,
  [PriceSource.BIZPORTAL]: bizportalProvider,
  [PriceSource.MANUAL]: null,
} satisfies Record<PriceSource, PriceProvider | null>;

export function getProvider(source: PriceSource): PriceProvider {
  const provider = PROVIDERS[source];

  if (!provider) {
    throw new Error(
      `No remote price provider exists for source ${source}; manual holdings must be valued from their stored value`
    );
  }

  return provider;
}
