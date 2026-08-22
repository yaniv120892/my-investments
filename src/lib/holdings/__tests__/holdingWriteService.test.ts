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
  MANUAL_VALUE_UPDATED_AT,
  OWNER_USER_ID,
  createHoldingInputFixture,
  manualHoldingFixture,
  repositoryStub,
} = await import("@/lib/holdings/__tests__/holdingTestFixtures");

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
      findHoldingOwnedBy: vi.fn(async () => manualHoldingFixture()),
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
      priceSource: PriceSource.MAYA_ETF,
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

describe("HoldingWriteService.recordManualValues", () => {
  function manualRepository() {
    return repositoryStub({
      findHoldingsOwnedBy: vi.fn(async (_userId: string, ids: string[]) =>
        ids.map((id) => manualHoldingFixture({ id }))
      ),
    });
  }

  it("re-dates a value the owner confirmed without changing it", async () => {
    const repository = manualRepository();
    const service = serviceFor(repository);

    await service.recordManualValues(OWNER_USER_ID, [
      { holdingId: "holding-1", manualValueNis: 84919 },
    ]);

    const [userId, entries, confirmedAt] = vi.mocked(
      repository.recordManualValues
    ).mock.calls[0];
    expect(userId).toBe(OWNER_USER_ID);
    expect(entries).toEqual([{ holdingId: "holding-1", manualValueNis: 84919 }]);
    expect(confirmedAt).not.toEqual(MANUAL_VALUE_UPDATED_AT);
  });

  it("hands the repository one review to write, under one timestamp", async () => {
    const repository = manualRepository();
    const service = serviceFor(repository);

    const confirmedAt = await service.recordManualValues(OWNER_USER_ID, [
      { holdingId: "holding-1", manualValueNis: 310000 },
      { holdingId: "holding-2", manualValueNis: 96000 },
    ]);

    expect(repository.recordManualValues).toHaveBeenCalledTimes(1);
    expect(vi.mocked(repository.recordManualValues).mock.calls[0][2]).toEqual(
      confirmedAt
    );
  });

  it("writes nothing when one line of the review is invalid", async () => {
    const repository = manualRepository();
    const service = serviceFor(repository);

    await expect(
      service.recordManualValues(OWNER_USER_ID, [
        { holdingId: "holding-1", manualValueNis: 310000 },
        { holdingId: "holding-2", manualValueNis: -1 },
      ])
    ).rejects.toThrow(/cannot be negative/);
    expect(repository.recordManualValues).not.toHaveBeenCalled();
  });

  it("refuses to store a value against a market-priced holding", async () => {
    const repository = repositoryStub();
    const service = serviceFor(repository);

    await expect(
      service.recordManualValues(OWNER_USER_ID, [
        { holdingId: "holding-1", manualValueNis: 310000 },
      ])
    ).rejects.toThrow(/Only a manually priced holding/);
    expect(repository.recordManualValues).not.toHaveBeenCalled();
  });

  it("refuses a holding that belongs to another user", async () => {
    const repository = repositoryStub({
      findHoldingsOwnedBy: vi.fn(async () => []),
    });
    const service = serviceFor(repository);

    await expect(
      service.recordManualValues("user-other", [
        { holdingId: "holding-1", manualValueNis: 310000 },
      ])
    ).rejects.toThrow(/holding-1/);
    expect(repository.recordManualValues).not.toHaveBeenCalled();
  });

  it("names each rejected line by its holding, so the form can show it", async () => {
    const repository = manualRepository();
    const service = serviceFor(repository);

    await expect(
      service.recordManualValues(OWNER_USER_ID, [
        { holdingId: "holding-2", manualValueNis: -1 },
      ])
    ).rejects.toMatchObject({
      fieldErrors: {
        "values.holding-2": expect.stringMatching(/cannot be negative/),
      },
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
