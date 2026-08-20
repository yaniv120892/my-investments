import { PriceSource } from "@prisma/client";
import {
  MAYA_CURRENCY,
  MAYA_SOURCE_LABEL,
  agorotToNis,
  fetchMayaJson,
} from "@/lib/providers/mayaApi";
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
      { fundId: sourceSymbol },
      target
    );

    return {
      price: agorotToNis(data?.UnitValuePrice, target, Object.keys(data ?? {})),
      currency: MAYA_CURRENCY,
      fetchedAt: new Date(),
      source: MAYA_SOURCE_LABEL,
    };
  }
}

export const mayaFundProvider = new MayaFundProvider();
