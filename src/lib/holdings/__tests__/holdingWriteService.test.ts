import { describe, expect, it, vi } from "vitest";
import { PriceSource } from "@prisma/client";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { HoldingWriteService } = await import(
  "@/lib/holdings/holdingWriteService"
);
const { HoldingWriteValidator } = await import(
  "@/lib/holdings/holdingWriteValidator"
);
const {
  OWNER_USER_ID,
  createHoldingInputFixture,
  holdingFixture,
  repositoryStub,
} = await import("@/lib/holdings/__tests__/holdingTestFixtures");

const MANUAL_VALUE_UPDATED_AT = new Date("2026-07-01T09:00:00.000Z");

function serviceFor(repository: ReturnType<typeof repositoryStub>) {
  return new HoldingWriteService(
    repository,
    new HoldingWriteValidator(repository)
  );
}

describe("HoldingWriteService.createHolding", () => {
  it("stamps manualValueUpdatedAt when the holding is created with a manual value", async () => {
    const repository = repositoryStub();
    const service = serviceFor(repository);

    await service.createHolding(
      OWNER_USER_ID,
      createHoldingInputFixture({
        priceSource: PriceSource.MANUAL,
        sourceSymbol: null,
        currency: "NIS",
        manualValueNis: 84919,
      })
    );

    expect(repository.createHolding).toHaveBeenCalledWith(
      OWNER_USER_ID,
      expect.objectContaining({
        manualValueNis: 84919,
        manualValueUpdatedAt: expect.any(Date),
      })
    );
  });

  it("leaves manualValueUpdatedAt empty for a market-priced holding", async () => {
    const repository = repositoryStub();
    const service = serviceFor(repository);

    await service.createHolding(OWNER_USER_ID, createHoldingInputFixture());

    expect(repository.createHolding).toHaveBeenCalledWith(
      OWNER_USER_ID,
      expect.objectContaining({
        manualValueNis: null,
        manualValueUpdatedAt: null,
        sourceSymbol: "IVV",
      })
    );
  });
});

describe("HoldingWriteService.updateHolding", () => {
  function manualRepository() {
    return repositoryStub({
      findHoldingOwnedBy: vi.fn(async () =>
        holdingFixture({
          priceSource: PriceSource.MANUAL,
          sourceSymbol: null,
          currency: "NIS",
          manualValueNis: 84919,
          manualValueUpdatedAt: MANUAL_VALUE_UPDATED_AT,
        })
      ),
    });
  }

  it("does not touch manualValueUpdatedAt when the manual value is unchanged", async () => {
    const repository = manualRepository();
    const service = serviceFor(repository);

    await service.updateHolding(OWNER_USER_ID, "holding-1", {
      manualValueNis: 84919,
      assetName: "שרה",
    });

    const [, , updateData] = vi.mocked(repository.updateHolding).mock.calls[0];
    expect(updateData.manualValueUpdatedAt).toBeUndefined();
    expect(updateData.assetName).toBe("שרה");
  });

  it("does not touch manualValueUpdatedAt when the patch omits the manual value", async () => {
    const repository = manualRepository();
    const service = serviceFor(repository);

    await service.updateHolding(OWNER_USER_ID, "holding-1", { quantity: 2 });

    const [, , updateData] = vi.mocked(repository.updateHolding).mock.calls[0];
    expect(updateData.manualValueUpdatedAt).toBeUndefined();
    expect(updateData.manualValueNis).toBe(84919);
  });

  it("stamps manualValueUpdatedAt when the manual value changes", async () => {
    const repository = manualRepository();
    const service = serviceFor(repository);

    await service.updateHolding(OWNER_USER_ID, "holding-1", {
      manualValueNis: 90000,
    });

    const [, , updateData] = vi.mocked(repository.updateHolding).mock.calls[0];
    expect(updateData.manualValueNis).toBe(90000);
    expect(updateData.manualValueUpdatedAt).toBeInstanceOf(Date);
    expect(updateData.manualValueUpdatedAt).not.toEqual(
      MANUAL_VALUE_UPDATED_AT
    );
  });

  it("clears manualValueUpdatedAt when the holding stops being manually priced", async () => {
    const repository = manualRepository();
    const service = serviceFor(repository);

    await service.updateHolding(OWNER_USER_ID, "holding-1", {
      priceSource: PriceSource.BIZPORTAL,
      sourceSymbol: "1159250",
    });

    const [userId, holdingId, updateData] = vi.mocked(repository.updateHolding)
      .mock.calls[0];
    expect(userId).toBe(OWNER_USER_ID);
    expect(holdingId).toBe("holding-1");
    expect(updateData.manualValueNis).toBeNull();
    expect(updateData.manualValueUpdatedAt).toBeNull();
    expect(updateData.sourceSymbol).toBe("1159250");
  });

  it("keeps the fields the patch does not mention", async () => {
    const repository = repositoryStub();
    const service = serviceFor(repository);

    await service.updateHolding(OWNER_USER_ID, "holding-1", { quantity: 200 });

    const [, , updateData] = vi.mocked(repository.updateHolding).mock.calls[0];
    expect(updateData).toMatchObject({
      quantity: 200,
      assetName: "S&P 500",
      sourceSymbol: "IVV",
      currency: "USD",
      platformId: "platform-1",
    });
  });
});

describe("HoldingWriteService.deleteHolding", () => {
  it("deletes the holding and its snapshots scoped to the owner", async () => {
    const repository = repositoryStub();
    const service = serviceFor(repository);

    await service.deleteHolding(OWNER_USER_ID, "holding-1");

    expect(repository.deleteHoldingWithSnapshots).toHaveBeenCalledWith(
      OWNER_USER_ID,
      "holding-1"
    );
  });

  it("does not delete anything when the holding belongs to another user", async () => {
    const repository = repositoryStub({
      findHoldingOwnedBy: vi.fn(async () => null),
    });
    const service = serviceFor(repository);

    await expect(
      service.deleteHolding("user-other", "holding-1")
    ).rejects.toThrow(/holding-1/);
    expect(repository.deleteHoldingWithSnapshots).not.toHaveBeenCalled();
  });
});
