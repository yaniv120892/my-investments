import { PriceSource } from "@prisma/client";
import { buildMayaQuote, fetchMayaJson } from "@/lib/providers/mayaApi";
import type { PriceProvider, Quote } from "@/lib/providers/types";

interface MayaFundDetails {
  UnitValuePrice?: number;
}

/** Mutual funds (קרן נאמנות), which are redeemed at a unit value rather than traded. */
export class MayaFundProvider implements PriceProvider {
  public readonly source = PriceSource.MAYA_FUND;

  public async fetchQuote(sourceSymbol: string): Promise<Quote> {
    const target = `fund: ${sourceSymbol}`;
    const data = await fetchMayaJson<MayaFundDetails>(
      "fund/details",
      sourceSymbol,
      target
    );

    return buildMayaQuote(data?.UnitValuePrice, target, data);
  }
}

export const mayaFundProvider = new MayaFundProvider();
