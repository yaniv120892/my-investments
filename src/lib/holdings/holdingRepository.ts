import type { Holding, Platform } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  HoldingPersistenceData,
  HoldingUpdateData,
  HoldingWithPlatform,
  ManualValueRecord,
} from "@/lib/holdings/holdingWrite.types";

export class HoldingRepository {
  public async findHoldingOwnedBy(
    userId: string,
    holdingId: string
  ): Promise<Holding | null> {
    return prisma.holding.findFirst({ where: { id: holdingId, userId } });
  }

  public async findPlatformOwnedBy(
    userId: string,
    platformId: string
  ): Promise<Platform | null> {
    return prisma.platform.findFirst({ where: { id: platformId, userId } });
  }

  public async findPlatformByName(
    userId: string,
    name: string
  ): Promise<Platform | null> {
    return prisma.platform.findFirst({ where: { userId, name } });
  }

  public async listPlatforms(userId: string): Promise<Platform[]> {
    return prisma.platform.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
  }

  public async createPlatform(
    userId: string,
    name: string,
    baseCurrency: string
  ): Promise<Platform> {
    return prisma.platform.create({ data: { userId, name, baseCurrency } });
  }

  public async createHolding(
    userId: string,
    data: HoldingPersistenceData
  ): Promise<HoldingWithPlatform> {
    return prisma.holding.create({
      data: { ...data, userId },
      include: { platform: true },
    });
  }

  public async updateHolding(
    userId: string,
    holdingId: string,
    data: HoldingUpdateData
  ): Promise<HoldingWithPlatform> {
    return prisma.holding.update({
      where: { id: holdingId, userId },
      data,
      include: { platform: true },
    });
  }

  public async recordManualValue(
    userId: string,
    holdingId: string,
    record: ManualValueRecord
  ): Promise<HoldingWithPlatform> {
    return prisma.holding.update({
      where: { id: holdingId, userId },
      data: record,
      include: { platform: true },
    });
  }

  public async deleteHoldingWithSnapshots(
    userId: string,
    holdingId: string
  ): Promise<void> {
    await prisma.$transaction([
      prisma.holdingSnapshot.deleteMany({
        where: { holdingId, holding: { userId } },
      }),
      prisma.holding.deleteMany({ where: { id: holdingId, userId } }),
    ]);
  }
}

export const holdingRepository = new HoldingRepository();
