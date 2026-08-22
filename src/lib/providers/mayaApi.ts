import type { Quote } from "@/lib/providers/types";
import type { SupportedCurrency } from "@/lib/pricing/supportedCurrencies";

const MAYA_API_ORIGIN = "https://mayaapi.tase.co.il/api";
const MAYA_CURRENCY: SupportedCurrency = "NIS";
const MAYA_SOURCE_LABEL = "Maya (TASE)";
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
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

/**
 * Maya splits its two products across endpoints that do not overlap: a mutual
 * fund id 403s on the ETF endpoint and vice versa. Worse, an id the endpoint
 * does not serve comes back as a 403 WAF page as often as a 404, so a caller
 * cannot tell "wrong product" from "we are being blocked" and must not guess.
 * Each PriceSource therefore names exactly one endpoint.
 */
export async function fetchMayaJson<T>(
  path: string,
  fundId: string,
  describeTarget: string
): Promise<T> {
  const url = `${MAYA_API_ORIGIN}/${path}?fundId=${encodeURIComponent(fundId)}`;
  const response = await fetch(url, { headers: MAYA_HEADERS });

  if (!response.ok) {
    throw new Error(
      `Maya request failed (${describeTarget}, status: ${
        response.status
      }, url: ${url})${response.status === 403 ? FORBIDDEN_HINT : ""}`
    );
  }

  // A WAF challenge can arrive as a 200 carrying HTML, and the SyntaxError that
  // raises names neither the security nor the url — it would reach the Telegram
  // alert as a bare "Unexpected token '<'".
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(
      `Maya returned a ${response.status} that was not JSON, which usually means a WAF challenge page (${describeTarget}, url: ${url})`
    );
  }
}

export function buildMayaQuote(
  rate: unknown,
  describeTarget: string,
  data: object | null | undefined
): Quote {
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(
      `Maya returned no usable rate (${describeTarget}, value: ${JSON.stringify(
        rate
      )}, fields returned: ${Object.keys(data ?? {}).join(", ")})`
    );
  }

  return {
    price: rate * AGOROT_TO_NIS,
    currency: MAYA_CURRENCY,
    fetchedAt: new Date(),
    source: MAYA_SOURCE_LABEL,
  };
}

const FORBIDDEN_HINT =
  " — Maya answers 403 both for an id this endpoint does not serve and for a request its hotlink filter rejected, so check the id belongs to this endpoint before suspecting the headers";
