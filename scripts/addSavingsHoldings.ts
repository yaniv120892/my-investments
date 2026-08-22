import { readFileSync } from "node:fs";
import { PriceSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { holdingRepository } from "@/lib/holdings/holdingRepository";
import { holdingWriteService } from "@/lib/holdings/holdingWriteService";
import { describeError } from "@/utils/describeError";
import { MANUAL_VALUE_MAX_AGE_DAYS } from "@/utils/manualValueFreshness";
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
    args.find((argument) => !argument.startsWith("--")) ?? DEFAULT_VALUES_PATH;

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

  const takenAssetNames = await findTakenAssetNames(user.id, rows);
  const created: string[] = [];

  for (const row of rows) {
    if (takenAssetNames.has(row.assetName)) {
      continue;
    }

    const platformId = await resolvePlatformId(user.id, row.platform);
    // Through the app's own write path rather than raw Prisma, so the script
    // cannot create a row the holdings page would refuse to save.
    await holdingWriteService.createHolding(user.id, {
      platformId,
      assetName: row.assetName,
      assetClass: row.assetClass,
      liquidity: row.liquidity,
      quantity: MANUAL_HOLDING_QUANTITY,
      priceSource: PriceSource.MANUAL,
      sourceSymbol: null,
      currency: "NIS",
      targetPercent: null,
      manualValueNis: row.manualValueNis,
    });
    created.push(row.assetName);
  }

  reportOutcome(email, created, [...takenAssetNames]);
}

async function findTakenAssetNames(
  userId: string,
  rows: SavingsSeedRow[]
): Promise<Set<string>> {
  const existing = await prisma.holding.findMany({
    where: { userId, assetName: { in: rows.map((row) => row.assetName) } },
    select: { assetName: true },
  });
  return new Set(existing.map((holding) => holding.assetName));
}

async function resolvePlatformId(
  userId: string,
  name: string
): Promise<string> {
  const existing = await holdingRepository.findPlatformByName(userId, name);
  if (existing) {
    return existing.id;
  }
  const created = await holdingRepository.createPlatform(userId, name, "NIS");
  return created.id;
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
      `The values file at ${path} is not valid JSON (${describeError(error)})`
    );
  }
}

function reportPlan(rows: SavingsSeedRow[], valuesPath: string): void {
  console.log(`Would add ${rows.length} holdings from ${valuesPath}:`);
  for (const row of rows) {
    console.log(`  ${describeRow(row)}`);
  }
  console.log("Nothing was written (--dry-run).");
}

function reportOutcome(
  email: string,
  created: string[],
  skipped: string[]
): void {
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
    `Confirm these balances monthly from Holdings → Manual values; anything older than ${MANUAL_VALUE_MAX_AGE_DAYS} days is flagged as stale.`
  );
}

function describeRow(row: SavingsSeedRow): string {
  return `${row.assetName} — ${row.manualValueNis.toLocaleString("en-US")} NIS, ${
    row.platform
  }, ${row.assetClass}, ${row.liquidity}`;
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error) {
    console.error(describeError(error));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void run();
