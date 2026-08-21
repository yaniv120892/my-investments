import { readFileSync } from "node:fs";
import { PriceSource, PrismaClient } from "@prisma/client";
import type { Platform } from "@prisma/client";
import { SAVINGS_HOLDINGS, toSeedRows } from "./savingsHoldings";
import type { SavingsSeedRow } from "./savingsHoldings";

/**
 * Adds the pension, study-fund and cash holdings the sheet importer left
 * behind. Unlike importFromSheet, this one adds and never removes: it is run
 * against a portfolio that is already live, so an existing holding of the same
 * name is reported and left exactly as it is.
 *
 *   IMPORT_USER_EMAIL=you@example.com npm run db:add-savings -- ./my-values.json
 *
 * Pass --dry-run to see what it would create without writing anything.
 */
const DEFAULT_VALUES_PATH = "scripts/savingsValues.json";
const MANUAL_HOLDING_QUANTITY = 1;

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.IMPORT_USER_EMAIL;
  if (!email) {
    throw new Error(
      "IMPORT_USER_EMAIL is required so the script knows whose portfolio to add to"
    );
  }

  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const valuesPath =
    args.find((arg) => !arg.startsWith("--")) ??
    process.env.SAVINGS_VALUES_FILE ??
    DEFAULT_VALUES_PATH;

  const rows = toSeedRows(readValuesFile(valuesPath));

  // Reported before the database is touched, so a values file can be checked
  // without a connection to the live portfolio.
  if (isDryRun) {
    reportPlan(rows, valuesPath);
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`No user found with email ${email}; sign up first`);
  }

  const confirmedAt = new Date();
  const created: string[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    const existing = await prisma.holding.findFirst({
      where: { userId: user.id, assetName: row.assetName },
    });
    if (existing) {
      skipped.push(row.assetName);
      continue;
    }

    const platform = await resolvePlatform(user.id, row.platform);
    await prisma.holding.create({
      data: {
        userId: user.id,
        platformId: platform.id,
        assetName: row.assetName,
        assetClass: row.assetClass,
        liquidity: row.liquidity,
        quantity: MANUAL_HOLDING_QUANTITY,
        priceSource: PriceSource.MANUAL,
        sourceSymbol: null,
        currency: "NIS",
        targetPercent: null,
        manualValueNis: row.manualValueNis,
        manualValueUpdatedAt: confirmedAt,
      },
    });
    created.push(row.assetName);
  }

  console.log(
    `Added ${created.length} holdings for ${email}${
      created.length > 0 ? `: ${created.join(", ")}` : ""
    }`
  );
  if (skipped.length > 0) {
    console.log(
      `Left ${skipped.length} alone because a holding of that name already exists: ${skipped.join(
        ", "
      )}`
    );
  }
  console.log(
    "Confirm these balances monthly from Holdings → Manual values; anything older than 35 days is flagged as stale."
  );
}

async function resolvePlatform(
  userId: string,
  name: string
): Promise<Platform> {
  const existing = await prisma.platform.findFirst({ where: { userId, name } });
  if (existing) {
    return existing;
  }
  return prisma.platform.create({
    data: { userId, name, baseCurrency: "NIS" },
  });
}

function readValuesFile(path: string): unknown {
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    throw new Error(
      `Could not read the values file at ${path}. Copy scripts/savingsValues.example.json, fill in the balances from your statements, and pass its path (keys: ${SAVINGS_HOLDINGS.map(
        (holding) => holding.key
      ).join(", ")})`
    );
  }

  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(
      `The values file at ${path} is not valid JSON (${String(error)})`
    );
  }
}

function reportPlan(rows: SavingsSeedRow[], valuesPath: string): void {
  console.log(`Would add ${rows.length} holdings from ${valuesPath}:`);
  for (const row of rows) {
    console.log(
      `  ${row.assetName} — ${row.manualValueNis.toLocaleString(
        "en-US"
      )} NIS, ${row.platform}, ${row.assetClass}, ${row.liquidity}`
    );
  }
  console.log("Nothing was written (--dry-run).");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
