import { PriceSource } from "@prisma/client";
import {
  MAYA_CURRENCY,
  MAYA_SOURCE_LABEL,
  agorotToNis,
  fetchMayaJson,
} from "@/lib/providers/mayaApi";
import type { PriceProvider, Quote } from "@/lib/providers/types";

interface MayaEtfTradeData {
  LastRate?: number;
  BaseRate?: number;
}

/**
 * Traded funds (קרן סל), including the foreign ETFs cross-listed on TASE. TASE
 * quotes these in agorot even when the fund itself is denominated in dollars or
 * euros abroad, so a quote from here needs no FX conversion — and matches the
 * agorot series this portfolio recorded before it briefly moved to Yahoo.
 */
export class MayaEtfProvider implements PriceProvider {
  public readonly source = PriceSource.MAYA_ETF;

  public async fetchQuote(sourceSymbol: string): Promise<Quote> {
    const target = `security: ${sourceSymbol}`;
    const data = await fetchMayaJson<MayaEtfTradeData>(
      "etf/tradedata",
      { fundId: sourceSymbol },
      target
    );

    return {
      price: agorotToNis(
        this.pickRate(data),
        target,
        Object.keys(data ?? {})
      ),
      currency: MAYA_CURRENCY,
      fetchedAt: new Date(),
      source: MAYA_SOURCE_LABEL,
    };
  }

  /**
   * LastRate is the live rate, or the closing rate once the session ends. It is
   * absent in the gap between a trading day opening and the security's first
   * deal, where BaseRate — the previous close that PercentageChange is measured
   * against — is the right price rather than a guess. Pricing the whole
   * portfolio fails if any one holding throws, so an hour-long hole in a
   * quotable price is not worth hiding the total over.
   */
  private pickRate(data: MayaEtfTradeData): number | undefined {
    const lastRate = data?.LastRate;
    const isUsable =
      typeof lastRate === "number" && Number.isFinite(lastRate) && lastRate > 0;

    return isUsable ? lastRate : data?.BaseRate;
  }
}

export const mayaEtfProvider = new MayaEtfProvider();
