import { BROWSER_USER_AGENT } from "@/lib/providers/browserUserAgent";
import type { SupportedCurrency } from "@/lib/pricing/supportedCurrencies";

const MAYA_API_ORIGIN = "https://mayaapi.tase.co.il/api";

export const MAYA_CURRENCY: SupportedCurrency = "NIS";
export const MAYA_SOURCE_LABEL = "Maya (TASE)";

/** TASE quotes every security in agorot, a hundredth of a shekel. */
export const AGOROT_TO_NIS = 0.01;

/**
 * mayaapi serves only what looks like maya.tase.co.il's own front end, and
 * answers anything else with a 403 — the same status Bizportal returned, for a
 * completely different reason. X-Maya-With is the site's hotlink token. The
 * Accept-Language header is not optional either: without it these exact headers
 * still 403 from Node while succeeding from curl, so the filter is reading more
 * than the token alone. Change nothing here without re-running the contract tests.
 */
const MAYA_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
  Referer: "https://maya.tase.co.il/",
  "X-Maya-With": "allow",
  "User-Agent": BROWSER_USER_AGENT,
};

/**
 * Maya splits its two products across endpoints that do not overlap: a mutual
 * fund id 403s on the ETF endpoint and vice versa. Worse, an id the endpoint
 * does not serve comes back as a 403 WAF page as often as a 404, so a provider
 * cannot tell "wrong product" from "we are being blocked" and must not guess.
 * Each PriceSource therefore names exactly one endpoint.
 */
export async function fetchMayaJson<T>(
  path: string,
  query: Record<string, string>,
  describeTarget: string
): Promise<T> {
  const url = `${MAYA_API_ORIGIN}/${path}?${new URLSearchParams(query)}`;
  const response = await fetch(url, { headers: MAYA_HEADERS });

  if (!response.ok) {
    throw new Error(
      `Maya request failed (${describeTarget}, status: ${response.status}, url: ${url})`
    );
  }

  return (await response.json()) as T;
}

export function agorotToNis(
  agorot: unknown,
  describeTarget: string,
  fieldsReturned: string[]
): number {
  if (typeof agorot !== "number" || !Number.isFinite(agorot) || agorot <= 0) {
    throw new Error(
      `Maya returned no usable rate (${describeTarget}, value: ${JSON.stringify(
        agorot
      )}, fields returned: ${fieldsReturned.join(", ")})`
    );
  }

  return agorot * AGOROT_TO_NIS;
}
