import { describe, expect, it } from "vitest";
import { AssetClass, Liquidity } from "@prisma/client";
import { SAVINGS_HOLDINGS, toSeedRows } from "../savingsHoldings";

function balancesFor(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ...Object.fromEntries(
      SAVINGS_HOLDINGS.map((holding) => [holding.key, 1000])
    ),
    ...overrides,
  };
}

describe("SAVINGS_HOLDINGS", () => {
  it("covers the six savings the sheet importer left behind", () => {
    expect(SAVINGS_HOLDINGS.map((holding) => holding.assetName)).toEqual([
      "חסכון טווח קצר",
      "קרן השתלמות סתיו",
      "קרן השתלמות יניב",
      "פנסיה יניב סה״כ",
      "פנסיה סתיו",
      "קרן חירום כספית",
    ]);
  });

  it("keys every row uniquely, because the values file is keyed by it", () => {
    const keys = SAVINGS_HOLDINGS.map((holding) => holding.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("toSeedRows", () => {
  it("takes a bare number as the balance", () => {
    const rows = toSeedRows(balancesFor({ pension_stav: 412500 }));

    const pension = rows.find((row) => row.key === "pension_stav");
    expect(pension?.manualValueNis).toBe(412500);
    expect(pension?.assetName).toBe("פנסיה סתיו");
  });

  it("lets a row override the class its מסלול actually holds", () => {
    const rows = toSeedRows(
      balancesFor({
        study_fund_yaniv: {
          valueNis: 96000,
          assetClass: AssetClass.NON_EQUITY,
        },
      })
    );

    expect(rows.find((row) => row.key === "study_fund_yaniv")).toMatchObject({
      manualValueNis: 96000,
      assetClass: AssetClass.NON_EQUITY,
      liquidity: Liquidity.ILLIQUID,
      platform: "Long-term savings",
    });
  });

  it("keeps the default class when the row only carries a balance", () => {
    const rows = toSeedRows(balancesFor());

    expect(rows.find((row) => row.key === "study_fund_stav")).toMatchObject({
      assetClass: AssetClass.EQUITY,
      liquidity: Liquidity.ILLIQUID,
      platform: "Long-term savings",
    });
  });

  it("refuses a file that is missing a balance, rather than creating the rest", () => {
    const values = balancesFor();
    delete values.pension_yaniv;

    expect(() => toSeedRows(values)).toThrow(/missing: pension_yaniv/);
  });

  it("refuses a key it does not know, which is usually a typo", () => {
    expect(() => toSeedRows(balancesFor({ pension_yanniv: 1 }))).toThrow(
      /unknown: pension_yanniv/
    );
  });

  it("refuses a balance that is not a finite number", () => {
    expect(() => toSeedRows(balancesFor({ pension_stav: "412500" }))).toThrow(
      /must be a number, or an object carrying valueNis/
    );
    expect(() =>
      toSeedRows(balancesFor({ pension_stav: { valueNis: "412500" } }))
    ).toThrow(/finite number in NIS/);
    expect(() => toSeedRows(balancesFor({ pension_stav: -1 }))).toThrow(
      /cannot be negative/
    );
  });

  it("refuses an asset class that is not one of the enum's", () => {
    expect(() =>
      toSeedRows(
        balancesFor({ pension_stav: { valueNis: 1, assetClass: "BONDS" } })
      )
    ).toThrow(/pension_stav.assetClass must be one of/);
  });

  it("refuses anything that is not an object of balances", () => {
    expect(() => toSeedRows([1, 2, 3])).toThrow(/must be a JSON object/);
    expect(() => toSeedRows(null)).toThrow(/must be a JSON object/);
  });
});

describe("the committed example file", () => {
  it("names every holding, so a copy of it is a complete file", async () => {
    const example = await import("../savingsValues.example.json");

    expect(Object.keys(example.default).sort()).toEqual(
      SAVINGS_HOLDINGS.map((holding) => holding.key).sort()
    );
    expect(() => toSeedRows(example.default)).not.toThrow();
  });
});
