import { PriceSource } from "@prisma/client";
import { BROWSER_USER_AGENT } from "@/lib/providers/browserUserAgent";
import type { SupportedCurrency } from "@/lib/pricing/supportedCurrencies";
import type { PriceProvider, Quote } from "@/lib/providers/types";

const MAYA_FUND_DETAILS_URL = "https://mayaapi.tase.co.il/api/fund/details";
const MAYA_CURRENCY: SupportedCurrency = "NIS";
const AGOROT_TO_NIS = 0.01;

/**
 * mayaapi serves only what looks like maya.tase.co.il's own front end, and
 * answers anything else with a 403 — the same status Bizportal returned, for a
 * completely different reason. X-Maya-With is the site's hotlink token. The
 * Accept-Language header is not optional either: without it these exact headers
 * still 403 from Node while succeeding from curl, so the filter is reading more
 * than the token alone. Change nothing here without re-running the contract test.
 */
const MAYA_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
  Referer: "https://maya.tase.co.il/",
  "X-Maya-With": "allow",
  "User-Agent": BROWSER_USER_AGENT,
};

interface MayaFundDetails {
  UnitValuePrice?: number;
}

export class MayaProvider implements PriceProvider {
  public readonly source = PriceSource.MAYA;

  public async fetchQuote(sourceSymbol: string): Promise<Quote> {
    const url = `${MAYA_FUND_DETAILS_URL}?fundId=${encodeURIComponent(
      sourceSymbol
    )}`;
    const response = await fetch(url, { headers: MAYA_HEADERS });

    if (!response.ok) {
      throw new Error(
        `Maya request failed (fund: ${sourceSymbol}, status: ${response.status}, url: ${url})`
      );
    }

    const data: MayaFundDetails = await response.json();
    const agorot = data?.UnitValuePrice;

    if (typeof agorot !== "number" || !Number.isFinite(agorot) || agorot <= 0) {
      throw new Error(
        `Maya returned no usable unit value (fund: ${sourceSymbol}, UnitValuePrice: ${JSON.stringify(
          agorot
        )}, fields returned: ${Object.keys(data ?? {}).join(", ")})`
      );
    }

    return {
      price: agorot * AGOROT_TO_NIS,
      currency: MAYA_CURRENCY,
      fetchedAt: new Date(),
      source: "Maya (TASE)",
    };
  }
}

export const mayaProvider = new MayaProvider();
