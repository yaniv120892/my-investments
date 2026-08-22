import { PriceSource } from "@prisma/client";
import { z } from "zod";
import { buildMayaQuote, fetchMayaJson } from "@/lib/providers/mayaApi";
import type { PriceProvider, Quote } from "@/lib/providers/types";

const mayaEtfTradeDataSchema = z.looseObject({
  LastRate: z.number().optional(),
  BaseRate: z.number().optional(),
});

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
    const data = await fetchMayaJson(
      "etf/tradedata",
      sourceSymbol,
      target,
      mayaEtfTradeDataSchema
    );

    // LastRate is absent between a trading day opening and the security's first
    // deal, where BaseRate — the previous close — is the right price rather than
    // a guess. Pricing the whole portfolio fails if any one holding throws, so
    // an hour-long hole is not worth hiding the total over.
    return buildMayaQuote(data?.LastRate || data?.BaseRate, target, data);
  }
}

export const mayaEtfProvider = new MayaEtfProvider();
