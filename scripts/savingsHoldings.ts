import { AssetClass, Liquidity } from "@prisma/client";

/**
 * The savings the Google Sheet tracked outside the tradable portfolio, and
 * which the sheet importer never carried across. Every one of them is priced
 * by hand: no free provider serves an individual's balance in a pension or a
 * study fund (see the Database section of CLAUDE.md), so the balances come
 * from a values file the owner fills in from their statements.
 *
 * The asset class here is only a default. A קרן השתלמות in מסלול מנייתי and one
 * in מסלול אג"ח are the same product with opposite exposure, and only the owner
 * knows which they hold — so the values file can override it per row, and the
 * holdings page can change it later.
 */
export interface SavingsHoldingDefinition {
  key: string;
  assetName: string;
  platform: string;
  assetClass: AssetClass;
  liquidity: Liquidity;
}

export const SAVINGS_PLATFORMS = {
  cash: "Cash & short term",
  longTerm: "Long-term savings",
} as const;

export const SAVINGS_HOLDINGS: SavingsHoldingDefinition[] = [
  {
    key: "short_term_savings",
    assetName: "חסכון טווח קצר",
    platform: SAVINGS_PLATFORMS.cash,
    assetClass: AssetClass.NON_EQUITY,
    liquidity: Liquidity.LIQUID,
  },
  {
    key: "study_fund_stav",
    assetName: "קרן השתלמות סתיו",
    platform: SAVINGS_PLATFORMS.longTerm,
    assetClass: AssetClass.EQUITY,
    liquidity: Liquidity.ILLIQUID,
  },
  {
    key: "study_fund_yaniv",
    assetName: "קרן השתלמות יניב",
    platform: SAVINGS_PLATFORMS.longTerm,
    assetClass: AssetClass.EQUITY,
    liquidity: Liquidity.ILLIQUID,
  },
  {
    key: "pension_yaniv",
    assetName: "פנסיה יניב סה״כ",
    platform: SAVINGS_PLATFORMS.longTerm,
    assetClass: AssetClass.NON_EQUITY,
    liquidity: Liquidity.ILLIQUID,
  },
  {
    key: "pension_stav",
    assetName: "פנסיה סתיו",
    platform: SAVINGS_PLATFORMS.longTerm,
    assetClass: AssetClass.NON_EQUITY,
    liquidity: Liquidity.ILLIQUID,
  },
  {
    key: "emergency_money_fund",
    assetName: "קרן חירום כספית",
    platform: SAVINGS_PLATFORMS.cash,
    assetClass: AssetClass.NON_EQUITY,
    liquidity: Liquidity.LIQUID,
  },
];

export interface SavingsSeedRow extends SavingsHoldingDefinition {
  manualValueNis: number;
}

/**
 * Every row must carry a balance. A holding created with no manual value fails
 * to price, and one failure suppresses the portfolio total — so a half-filled
 * values file would blank the dashboard rather than partially fill it.
 */
export function toSeedRows(values: unknown): SavingsSeedRow[] {
  if (typeof values !== "object" || values === null || Array.isArray(values)) {
    throw new Error(
      `The values file must be a JSON object keyed by holding (received: ${JSON.stringify(
        values
      )})`
    );
  }

  const entries = values as Record<string, unknown>;
  const knownKeys = new Set(SAVINGS_HOLDINGS.map((holding) => holding.key));
  const unknownKeys = Object.keys(entries).filter(
    (key) => !knownKeys.has(key)
  );
  if (unknownKeys.length > 0) {
    throw new Error(
      `The values file names holdings this script does not create (unknown: ${unknownKeys.join(
        ", "
      )}; known: ${[...knownKeys].join(", ")})`
    );
  }

  const missingKeys = SAVINGS_HOLDINGS.filter(
    (holding) => entries[holding.key] === undefined
  ).map((holding) => holding.key);
  if (missingKeys.length > 0) {
    throw new Error(
      `Every holding needs a balance before any of them is created (missing: ${missingKeys.join(
        ", "
      )})`
    );
  }

  return SAVINGS_HOLDINGS.map((holding) =>
    toSeedRow(holding, entries[holding.key])
  );
}

function toSeedRow(
  holding: SavingsHoldingDefinition,
  entry: unknown
): SavingsSeedRow {
  if (typeof entry === "number") {
    return { ...holding, manualValueNis: assertBalance(holding.key, entry) };
  }

  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    throw new Error(
      `A balance must be a number, or an object carrying valueNis (holding: ${
        holding.key
      }, received: ${JSON.stringify(entry)})`
    );
  }

  const override = entry as Record<string, unknown>;

  return {
    ...holding,
    assetClass: readEnum(
      AssetClass,
      override.assetClass,
      holding.assetClass,
      `${holding.key}.assetClass`
    ),
    liquidity: readEnum(
      Liquidity,
      override.liquidity,
      holding.liquidity,
      `${holding.key}.liquidity`
    ),
    platform: readPlatform(override.platform, holding),
    manualValueNis: assertBalance(holding.key, override.valueNis),
  };
}

function assertBalance(key: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `A balance must be a finite number in NIS (holding: ${key}, received: ${JSON.stringify(
        value
      )})`
    );
  }
  if (value < 0) {
    throw new Error(
      `A balance cannot be negative (holding: ${key}, received: ${value})`
    );
  }
  return value;
}

function readEnum<TEnum extends Record<string, string>>(
  enumeration: TEnum,
  provided: unknown,
  fallback: TEnum[keyof TEnum],
  field: string
): TEnum[keyof TEnum] {
  if (provided === undefined) {
    return fallback;
  }
  const allowed = Object.values(enumeration);
  if (typeof provided !== "string" || !allowed.includes(provided)) {
    throw new Error(
      `${field} must be one of ${allowed.join(
        ", "
      )} (received: ${JSON.stringify(provided)})`
    );
  }
  return provided as TEnum[keyof TEnum];
}

function readPlatform(
  provided: unknown,
  holding: SavingsHoldingDefinition
): string {
  if (provided === undefined) {
    return holding.platform;
  }
  if (typeof provided !== "string" || provided.trim().length === 0) {
    throw new Error(
      `${holding.key}.platform must be a non-empty name (received: ${JSON.stringify(
        provided
      )})`
    );
  }
  return provided.trim();
}
