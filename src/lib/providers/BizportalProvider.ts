import * as cheerio from "cheerio";
import { PriceSource } from "@prisma/client";
import type { Currency, PriceProvider, Quote } from "@/lib/providers/types";

const BIZPORTAL_URL = "https://www.bizportal.co.il/tradedfund/quote/generalview";
const BIZPORTAL_CURRENCY: Currency = "NIS";
const AGOROT_TO_NIS = 0.01;
const TRADED_FUND_PRICE_LABEL = "שער נעילה";
const MUTUAL_FUND_PRICE_LABEL = "מחיר פדיון";

export class BizportalProvider implements PriceProvider {
  public readonly source = PriceSource.BIZPORTAL;

  public async fetchQuote(sourceSymbol: string): Promise<Quote> {
    const url = `${BIZPORTAL_URL}/${encodeURIComponent(sourceSymbol)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; my-investments/1.0)" },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(
        `Bizportal request failed (security: ${sourceSymbol}, status: ${response.status}, url: ${url})`
      );
    }

    const html = await response.text();
    const agorot =
      this.parseTradedFundAgorot(html) ?? this.parseMutualFundAgorot(html);

    if (agorot === null) {
      throw new Error(
        `Bizportal page contained neither a "${TRADED_FUND_PRICE_LABEL}" nor a "${MUTUAL_FUND_PRICE_LABEL}" price (security: ${sourceSymbol}, url: ${url}). The page markup has probably changed.`
      );
    }

    return {
      price: agorot * AGOROT_TO_NIS,
      currency: BIZPORTAL_CURRENCY,
      fetchedAt: new Date(),
      source: "Bizportal",
    };
  }

  private parseTradedFundAgorot(html: string): number | null {
    const $ = cheerio.load(html);
    let agorot: number | null = null;

    $("dt").each((_index, element) => {
      const label = $(element).clone().children().remove().end().text().trim();
      if (label !== TRADED_FUND_PRICE_LABEL) {
        return;
      }
      const parsed = this.parseNumber(
        $(element).next("dd").find("span").last().text()
      );
      if (parsed !== null) {
        agorot = parsed;
      }
    });

    return agorot;
  }

  private parseMutualFundAgorot(html: string): number | null {
    const $ = cheerio.load(html);
    let agorot: number | null = null;

    $(".top-area-cube").each((_index, element) => {
      const label = $(element).find(".label").first().text().trim();
      if (label !== MUTUAL_FUND_PRICE_LABEL) {
        return;
      }
      const parsed = this.parseNumber($(element).find(".num").first().text());
      if (parsed !== null) {
        agorot = parsed;
      }
    });

    return agorot;
  }

  private parseNumber(text: string): number | null {
    const parsed = parseFloat(text.replace(/,/g, "").trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }
}

export const bizportalProvider = new BizportalProvider();
