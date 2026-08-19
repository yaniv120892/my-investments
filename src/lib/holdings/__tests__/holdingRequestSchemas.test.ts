import { describe, expect, it } from "vitest";
import { AssetClass, Liquidity, PriceSource } from "@prisma/client";
import {
  parseCreateHoldingBody,
  parseCreatePlatformBody,
  parseUpdateHoldingBody,
} from "@/lib/holdings/holdingRequestSchemas";
import { HoldingValidationError } from "@/lib/holdings/holdingWriteErrors";

const VALID_BODY = {
  platformId: "platform-1",
  assetName: "  S&P 500  ",
  assetClass: AssetClass.EQUITY,
  liquidity: Liquidity.LIQUID,
  quantity: 148,
  priceSource: PriceSource.FINNHUB,
  sourceSymbol: " IVV ",
  currency: "USD",
};

function fieldErrorsOf(parse: () => unknown): Record<string, string> {
  try {
    parse();
  } catch (error) {
    if (error instanceof HoldingValidationError) {
      return error.fieldErrors;
    }
    throw error;
  }
  throw new Error("Expected the body to be rejected");
}

describe("parseCreateHoldingBody", () => {
  it("trims text fields", () => {
    const input = parseCreateHoldingBody(VALID_BODY);

    expect(input.assetName).toBe("S&P 500");
    expect(input.sourceSymbol).toBe("IVV");
  });

  it("names the field and the received value when a number is missing", () => {
    const fieldErrors = fieldErrorsOf(() =>
      parseCreateHoldingBody({ ...VALID_BODY, quantity: null })
    );

    expect(fieldErrors.quantity).toContain("quantity is required");
    expect(fieldErrors.quantity).toContain("null");
  });

  it("rejects an unknown price source", () => {
    const fieldErrors = fieldErrorsOf(() =>
      parseCreateHoldingBody({ ...VALID_BODY, priceSource: "MORNINGSTAR" })
    );

    expect(fieldErrors.priceSource).toContain("MORNINGSTAR");
  });

  it("rejects unknown fields rather than silently dropping them", () => {
    const fieldErrors = fieldErrorsOf(() =>
      parseCreateHoldingBody({ ...VALID_BODY, userId: "someone-else" })
    );

    expect(Object.keys(fieldErrors)).toContain("userId");
  });

  it("rejects a body that is not an object", () => {
    const fieldErrors = fieldErrorsOf(() => parseCreateHoldingBody("nope"));

    expect(Object.keys(fieldErrors)).toContain("body");
  });
});

describe("parseUpdateHoldingBody", () => {
  it("accepts a patch with a single field", () => {
    expect(parseUpdateHoldingBody({ quantity: 12 })).toEqual({ quantity: 12 });
  });

  it("accepts an explicit null that clears an optional field", () => {
    expect(parseUpdateHoldingBody({ targetPercent: null })).toEqual({
      targetPercent: null,
    });
  });

  it("still rejects a wrongly typed field", () => {
    const fieldErrors = fieldErrorsOf(() =>
      parseUpdateHoldingBody({ quantity: "148" })
    );

    expect(fieldErrors.quantity).toContain("148");
  });
});

describe("parseCreatePlatformBody", () => {
  it("trims the platform name", () => {
    expect(
      parseCreatePlatformBody({ name: " Blink ", baseCurrency: "USD" })
    ).toEqual({ name: "Blink", baseCurrency: "USD" });
  });

  it("rejects a missing base currency", () => {
    const fieldErrors = fieldErrorsOf(() =>
      parseCreatePlatformBody({ name: "Blink" })
    );

    expect(Object.keys(fieldErrors)).toContain("baseCurrency");
  });
});
