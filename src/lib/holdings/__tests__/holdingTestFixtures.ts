import { vi } from "vitest";
import { AssetClass, Liquidity, PriceSource } from "@prisma/client";
import type { Holding, Platform } from "@prisma/client";
import type { HoldingRepository } from "@/lib/holdings/holdingRepository";
import type { CreateHoldingInput } from "@/lib/holdings/holdingWrite.types";

export const OWNER_USER_ID = "user-owner";
export const OTHER_USER_ID = "user-other";

export function platformFixture(overrides: Partial<Platform> = {}): Platform {
  return {
    id: "platform-1",
    userId: OWNER_USER_ID,
    name: "Blink",
    baseCurrency: "USD",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

export function holdingFixture(overrides: Partial<Holding> = {}): Holding {
  return {
    id: "holding-1",
    userId: OWNER_USER_ID,
    platformId: "platform-1",
    assetName: "S&P 500",
    assetClass: AssetClass.EQUITY,
    liquidity: Liquidity.LIQUID,
    quantity: 148,
    priceSource: PriceSource.FINNHUB,
    sourceSymbol: "IVV",
    currency: "USD",
    targetPercent: null,
    withinClassWeight: null,
    manualValueNis: null,
    manualValueUpdatedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

export const MANUAL_VALUE_UPDATED_AT = new Date("2026-07-01T09:00:00.000Z");

export function manualHoldingFixture(
  overrides: Partial<Holding> = {}
): Holding {
  return holdingFixture({
    priceSource: PriceSource.MANUAL,
    sourceSymbol: null,
    currency: "NIS",
    manualValueNis: 84919,
    manualValueUpdatedAt: MANUAL_VALUE_UPDATED_AT,
    ...overrides,
  });
}

export function createHoldingInputFixture(
  overrides: Partial<CreateHoldingInput> = {}
): CreateHoldingInput {
  return {
    platformId: "platform-1",
    assetName: "S&P 500",
    assetClass: AssetClass.EQUITY,
    liquidity: Liquidity.LIQUID,
    quantity: 148,
    priceSource: PriceSource.FINNHUB,
    sourceSymbol: "IVV",
    currency: "USD",
    ...overrides,
  };
}

export function repositoryStub(
  overrides: Partial<HoldingRepository> = {}
): HoldingRepository {
  return {
    findHoldingOwnedBy: vi.fn(async () => holdingFixture()),
    findPlatformOwnedBy: vi.fn(async () => platformFixture()),
    findPlatformByName: vi.fn(async () => null),
    listPlatforms: vi.fn(async () => [platformFixture()]),
    createPlatform: vi.fn(async () => platformFixture()),
    createHolding: vi.fn(async () => ({
      ...holdingFixture(),
      platform: platformFixture(),
    })),
    updateHolding: vi.fn(async () => ({
      ...holdingFixture(),
      platform: platformFixture(),
    })),
    findHoldingsOwnedBy: vi.fn(async (_userId: string, ids: string[]) =>
      ids.map((id) => holdingFixture({ id }))
    ),
    recordManualValues: vi.fn(async () => undefined),
    deleteHoldingWithSnapshots: vi.fn(async () => undefined),
    ...overrides,
  };
}
