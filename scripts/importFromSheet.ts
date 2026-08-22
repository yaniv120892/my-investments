import { PrismaClient } from "@prisma/client";
import { SHEET_HOLDINGS, SHEET_PLATFORMS } from "./sheetData";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.IMPORT_USER_EMAIL;
  if (!email) {
    throw new Error(
      "IMPORT_USER_EMAIL is required so the importer knows which user to attach holdings to"
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`No user found with email ${email}; sign up first`);
  }

  await prisma.holdingSnapshot.deleteMany({
    where: { holding: { userId: user.id } },
  });
  await prisma.holding.deleteMany({ where: { userId: user.id } });
  await prisma.platform.deleteMany({ where: { userId: user.id } });

  const platformIdByName = new Map<string, string>();
  for (const platform of SHEET_PLATFORMS) {
    const created = await prisma.platform.create({
      data: {
        userId: user.id,
        name: platform.name,
        baseCurrency: platform.baseCurrency,
      },
    });
    platformIdByName.set(platform.name, created.id);
  }

  for (const holding of SHEET_HOLDINGS) {
    const platformId = platformIdByName.get(holding.platform);
    if (!platformId) {
      throw new Error(
        `Holding references unknown platform (asset: ${holding.assetName}, platform: ${holding.platform})`
      );
    }

    await prisma.holding.create({
      data: {
        userId: user.id,
        platformId,
        assetName: holding.assetName,
        assetClass: holding.assetClass,
        liquidity: holding.liquidity,
        quantity: holding.quantity,
        priceSource: holding.priceSource,
        sourceSymbol: holding.sourceSymbol,
        currency: holding.currency,
        targetPercent: holding.targetPercent,
        manualValueNis: holding.manualValueNis,
        manualValueUpdatedAt:
          holding.manualValueNis !== null ? new Date() : null,
      },
    });
  }

  const count = await prisma.holding.count({ where: { userId: user.id } });
  console.log(
    `Imported ${count} holdings across ${SHEET_PLATFORMS.length} platforms for ${email}`
  );
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void run();
