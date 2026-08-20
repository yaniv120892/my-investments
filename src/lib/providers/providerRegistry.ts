import { PriceSource } from "@prisma/client";
import type { PriceProvider } from "@/lib/providers/types";
import { finnhubProvider } from "@/lib/providers/FinnhubProvider";
import { binanceProvider } from "@/lib/providers/BinanceProvider";
import { mayaEtfProvider } from "@/lib/providers/MayaEtfProvider";
import { mayaFundProvider } from "@/lib/providers/MayaFundProvider";
import { CachedPriceProvider } from "@/lib/providers/CachedPriceProvider";

const PROVIDERS = {
  [PriceSource.FINNHUB]: new CachedPriceProvider(finnhubProvider),
  [PriceSource.BINANCE]: new CachedPriceProvider(binanceProvider),
  [PriceSource.MAYA_ETF]: new CachedPriceProvider(mayaEtfProvider),
  [PriceSource.MAYA_FUND]: new CachedPriceProvider(mayaFundProvider),
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
