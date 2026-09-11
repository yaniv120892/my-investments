import { Liquidity } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  ReplaceTargetsInput,
  StoredTargets,
} from "@/lib/targets/target.types";

export class TargetRepository {
  public async findTargets(userId: string): Promise<StoredTargets> {
    const [classTargets, holdings] = await Promise.all([
      prisma.assetClassTarget.findMany({ where: { userId } }),
      prisma.holding.findMany({
        where: { userId, liquidity: Liquidity.LIQUID },
        select: { id: true, withinClassWeight: true },
      }),
    ]);

    return {
      classTargets: classTargets.map((target) => ({
        assetClass: target.assetClass,
        targetPercent: target.targetPercent,
      })),
      withinClassWeights: holdings.map((holding) => ({
        holdingId: holding.id,
        withinClassWeight: holding.withinClassWeight,
      })),
    };
  }

  public async findLiquidHoldingIds(userId: string): Promise<Set<string>> {
    const holdings = await prisma.holding.findMany({
      where: { userId, liquidity: Liquidity.LIQUID },
      select: { id: true },
    });
    return new Set(holdings.map((holding) => holding.id));
  }

  /**
   * One transaction, because "the class targets sum to 100" is only true of the
   * whole set: a half-applied save leaves targets that no reader can trust.
   */
  public async replaceTargets(
    userId: string,
    input: ReplaceTargetsInput
  ): Promise<void> {
    await prisma.$transaction([
      prisma.assetClassTarget.deleteMany({ where: { userId } }),
      prisma.assetClassTarget.createMany({
        data: input.classTargets.map((target) => ({
          userId,
          assetClass: target.assetClass,
          targetPercent: target.targetPercent,
        })),
      }),
      ...input.withinClassWeights.map((entry) =>
        prisma.holding.update({
          where: { id: entry.holdingId, userId },
          data: { withinClassWeight: entry.withinClassWeight },
        })
      ),
    ]);
  }
}

export const targetRepository = new TargetRepository();
