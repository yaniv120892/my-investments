import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { buildMayaQuote, fetchMayaJson } from "@/lib/providers/mayaApi";
import {
  fetchCallArguments,
  mockFetch,
} from "@/lib/providers/__tests__/mockFetch";

const anyBodySchema = z.looseObject({});

describe("fetchMayaJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the hotlink headers mayaapi requires", async () => {
    mockFetch({});
    await fetchMayaJson(
      "etf/tradedata",
      "1159250",
      "security: 1159250",
      anyBodySchema
    );
    const [, options] = fetchCallArguments();
    expect(options?.headers).toMatchObject({
      Referer: "https://maya.tase.co.il/",
      "X-Maya-With": "allow",
      "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
    });
  });

  it("builds the url from the endpoint and fund id", async () => {
    mockFetch({});
    await fetchMayaJson(
      "fund/details",
      "5109889",
      "fund: 5109889",
      anyBodySchema
    );
    const [url] = fetchCallArguments();
    expect(url).toBe(
      "https://mayaapi.tase.co.il/api/fund/details?fundId=5109889"
    );
  });

  it("names the target and status when the request fails", async () => {
    mockFetch({}, false, 500);
    await expect(
      fetchMayaJson("fund/details", "5109889", "fund: 5109889", anyBodySchema)
    ).rejects.toThrow(/5109889[\s\S]*500/);
  });

  it("explains that a 403 means either a wrong id or a rejected client", async () => {
    mockFetch({}, false, 403);
    await expect(
      fetchMayaJson(
        "etf/tradedata",
        "5109889",
        "security: 5109889",
        anyBodySchema
      )
    ).rejects.toThrow(/does not serve[\s\S]*hotlink/);
  });

  it("names the target when a 200 turns out not to be JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token '<'");
        },
      })
    );

    await expect(
      fetchMayaJson(
        "etf/tradedata",
        "1159250",
        "security: 1159250",
        anyBodySchema
      )
    ).rejects.toThrow(/1159250[\s\S]*etf\/tradedata/);
  });

  it("names the fields Maya sent when the body does not match the schema", async () => {
    mockFetch({ SomeRenamedField: 1 });
    await expect(
      fetchMayaJson(
        "etf/tradedata",
        "1159250",
        "security: 1159250",
        z.looseObject({ LastRate: z.number() })
      )
    ).rejects.toThrow(/does not recognise[\s\S]*SomeRenamedField/);
  });
});

describe("buildMayaQuote", () => {
  it("converts agorot to NIS", () => {
    const quote = buildMayaQuote(247640, "security: 1159250", {});
    expect(quote.price).toBeCloseTo(2476.4, 10);
    expect(quote.currency).toBe("NIS");
    expect(quote.source).toBe("Maya (TASE)");
  });

  it.each([
    { rate: undefined, label: "a missing rate" },
    { rate: 0, label: "a zero rate" },
    { rate: -5, label: "a negative rate" },
    { rate: "247640", label: "a rate that arrived as a string" },
  ])("throws rather than pricing a holding from $label", ({ rate }) => {
    expect(() => buildMayaQuote(rate, "security: 1159250", {})).toThrow(
      /1159250/
    );
  });

  it("lists the fields that did arrive, so a renamed field is diagnosable", () => {
    expect(() =>
      buildMayaQuote(undefined, "security: 1159250", {
        SecurityName: "ISH.FRF SP 500",
        ClosingRate: 247640,
      })
    ).toThrow(/SecurityName, ClosingRate/);
  });
});
