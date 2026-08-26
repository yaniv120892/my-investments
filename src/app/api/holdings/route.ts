import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Holding, Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { priceHoldings } from "@/lib/pricing/portfolioPricingService";
import { computeAllocation, groupBy } from "@/lib/pricing/allocation";
import { parseCreateHoldingBody } from "@/lib/holdings/holdingRequestSchemas";
import { holdingWriteService } from "@/lib/holdings/holdingWriteService";
import { toWriteErrorResponse } from "@/lib/holdings/holdingWriteErrorResponse";
import { readJsonBody } from "@/lib/holdings/requestBody";
import { USER_ID_HEADER } from "@/lib/authTokens";
import { describeError } from "@/utils/describeError";

type PricedRow = {
  holding: Holding & { platform: Platform };
  valueInNis: number;
};

export async function GET(request: NextRequest) {
  const userId = request.headers.get(USER_ID_HEADER);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const holdings = await prisma.holding.findMany({
    where: { userId },
    include: { platform: true },
    orderBy: { assetName: "asc" },
  });

  try {
    const pricing = await priceHoldings(holdings);
    const valueByHoldingId = new Map(
      pricing.valuations.map((valuation) => [
        valuation.holdingId,
        valuation.valueInNis,
      ])
    );
    const unitPriceByHoldingId = new Map(
      pricing.valuations.map((valuation) => [
        valuation.holdingId,
        valuation.unitPrice,
      ])
    );

    const pricedRows: PricedRow[] = holdings.flatMap((holding) => {
      const valueInNis = valueByHoldingId.get(holding.id);
      if (valueInNis === undefined) {
        return [];
      }
      return [{ holding, valueInNis }];
    });

    return NextResponse.json({
      holdings: holdings.map((holding) => ({
        ...holding,
        valueInNis: valueByHoldingId.get(holding.id) ?? null,
        unitPrice: unitPriceByHoldingId.get(holding.id) ?? null,
      })),
      summary: {
        totalValueNis: pricing.totalValueNis,
        pricedValueNis: pricing.pricedValueNis,
        isComplete: pricing.failures.length === 0,
        holdingCount: holdings.length,
        pricedCount: pricing.valuations.length,
        usdToNisRate: pricing.usdToNisRate,
        lastUpdated: new Date(),
      },
      allocation: {
        byAssetClass: groupBy(
          pricedRows,
          (row) => row.holding.assetClass,
          (row) => row.valueInNis
        ),
        byLiquidity: groupBy(
          pricedRows,
          (row) => row.holding.liquidity,
          (row) => row.valueInNis
        ),
        byPlatform: groupBy(
          pricedRows,
          (row) => row.holding.platform.name,
          (row) => row.valueInNis
        ),
        byCurrency: groupBy(
          pricedRows,
          (row) => row.holding.currency,
          (row) => row.valueInNis
        ),
      },
      drift: buildDriftByPlatform(pricedRows),
      failures: pricing.failures,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Unable to price the portfolio, so no totals can be shown (${describeError(
          error
        )})`,
      },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get(USER_ID_HEADER);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const input = parseCreateHoldingBody(await readJsonBody(request));
    const holding = await holdingWriteService.createHolding(userId, input);
    return NextResponse.json({ holding }, { status: 201 });
  } catch (error) {
    return toWriteErrorResponse(error);
  }
}

function buildDriftByPlatform(pricedRows: PricedRow[]) {
  const platformNames = [
    ...new Set(pricedRows.map((row) => row.holding.platform.name)),
  ];

  return platformNames
    .map((platformName) => {
      const rows = pricedRows.filter(
        (row) => row.holding.platform.name === platformName
      );
      const hasTargets = rows.some((row) => row.holding.targetPercent !== null);
      if (!hasTargets) {
        return null;
      }
      return {
        platformName,
        targetTotalPercent: rows.reduce(
          (sum, row) => sum + (row.holding.targetPercent ?? 0),
          0
        ),
        slices: computeAllocation(
          rows.map((row) => ({
            key: row.holding.assetName,
            valueInNis: row.valueInNis,
            targetPercent: row.holding.targetPercent,
          }))
        ),
      };
    })
    .filter((entry) => entry !== null);
}
