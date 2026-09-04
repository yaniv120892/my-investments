import { Liquidity } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { HoldingTrendPoint } from "@/lib/holdings/holdingTrendRepository.types";

export type { HoldingTrendPoint } from "@/lib/holdings/holdingTrendRepository.types";

export class HoldingTrendRepository {
  /** `/api/holdings/history` aggregates the holding dimension away. */
  public async findHoldingTrend(
    userId: string,
    holdingId: string,
    since: Date
  ): Promise<HoldingTrendPoint[]> {
    const snapshots = await prisma.holdingSnapshot.findMany({
      where: { holdingId, date: { gte: since }, holding: { userId } },
      orderBy: { date: "asc" },
      select: { date: true, unitPrice: true, valueNis: true, currency: true },
    });

    return snapshots.map((snapshot) => ({
      date: snapshot.date.toISOString().split("T")[0],
      unitPrice: snapshot.unitPrice,
      valueNis: snapshot.valueNis,
      currency: snapshot.currency,
    }));
  }

  public async findLiquidHoldingsByName(
    userId: string,
    assetName: string
  ): Promise<{ id: string; assetName: string }[]> {
    return prisma.holding.findMany({
      where: {
        userId,
        liquidity: Liquidity.LIQUID,
        assetName: { contains: assetName, mode: "insensitive" },
      },
      select: { id: true, assetName: true },
      orderBy: { assetName: "asc" },
    });
  }
}

export const holdingTrendRepository = new HoldingTrendRepository();
