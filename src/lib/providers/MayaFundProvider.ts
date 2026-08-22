import { PriceSource } from "@prisma/client";
import { z } from "zod";
import { buildMayaQuote, fetchMayaJson } from "@/lib/providers/mayaApi";
import type { PriceProvider, Quote } from "@/lib/providers/types";

const mayaFundDetailsSchema = z.looseObject({
  UnitValuePrice: z.number().optional(),
});

/** Mutual funds (קרן נאמנות), which are redeemed at a unit value rather than traded. */
export class MayaFundProvider implements PriceProvider {
  public readonly source = PriceSource.MAYA_FUND;

  public async fetchQuote(sourceSymbol: string): Promise<Quote> {
    const target = `fund: ${sourceSymbol}`;
    const data = await fetchMayaJson(
      "fund/details",
      sourceSymbol,
      target,
      mayaFundDetailsSchema
    );

    return buildMayaQuote(data?.UnitValuePrice, target, data);
  }
}

export const mayaFundProvider = new MayaFundProvider();
