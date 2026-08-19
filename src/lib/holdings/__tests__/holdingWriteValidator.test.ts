import { describe, expect, it, vi } from "vitest";
import { PriceSource } from "@prisma/client";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { HoldingWriteValidator } = await import(
  "@/lib/holdings/holdingWriteValidator"
);
const {
  HoldingNotFoundError,
  HoldingValidationError,
  PlatformNotFoundError,
} = await import("@/lib/holdings/holdingWriteErrors");
const {
  OTHER_USER_ID,
  OWNER_USER_ID,
  createHoldingInputFixture,
  holdingFixture,
  repositoryStub,
} = await import("@/lib/holdings/__tests__/holdingTestFixtures");

async function expectFieldErrors(
  action: Promise<unknown>
): Promise<Record<string, string>> {
  try {
    await action;
  } catch (error) {
    if (error instanceof HoldingValidationError) {
      return error.fieldErrors;
    }
    throw error;
  }
  throw new Error("Expected the validator to reject the request");
}

describe("HoldingWriteValidator.assertCanCreateHolding", () => {
  it("accepts a market-priced holding on a platform the user owns", async () => {
    const repository = repositoryStub();
    const validator = new HoldingWriteValidator(repository);

    await validator.assertCanCreateHolding(
      OWNER_USER_ID,
      createHoldingInputFixture()
    );

    expect(repository.findPlatformOwnedBy).toHaveBeenCalledWith(
      OWNER_USER_ID,
      "platform-1"
    );
  });

  it("rejects an asset name that is empty once trimmed", async () => {
    const validator = new HoldingWriteValidator(repositoryStub());

    const fieldErrors = await expectFieldErrors(
      validator.assertCanCreateHolding(
        OWNER_USER_ID,
        createHoldingInputFixture({ assetName: "   " })
      )
    );

    expect(fieldErrors.assetName).toMatch(/empty/i);
  });

  it("rejects a negative quantity and names the offending value", async () => {
    const validator = new HoldingWriteValidator(repositoryStub());

    const fieldErrors = await expectFieldErrors(
      validator.assertCanCreateHolding(
        OWNER_USER_ID,
        createHoldingInputFixture({ quantity: -3 })
      )
    );

    expect(fieldErrors.quantity).toContain("-3");
  });

  it("rejects a non-finite quantity", async () => {
    const validator = new HoldingWriteValidator(repositoryStub());

    const fieldErrors = await expectFieldErrors(
      validator.assertCanCreateHolding(
        OWNER_USER_ID,
        createHoldingInputFixture({ quantity: Number.NaN })
      )
    );

    expect(fieldErrors.quantity).toMatch(/finite/i);
  });

  it("accepts a quantity of exactly zero", async () => {
    const validator = new HoldingWriteValidator(repositoryStub());

    await expect(
      validator.assertCanCreateHolding(
        OWNER_USER_ID,
        createHoldingInputFixture({ quantity: 0 })
      )
    ).resolves.toBeUndefined();
  });

  it("rejects a currency the pricing service cannot convert", async () => {
    const validator = new HoldingWriteValidator(repositoryStub());

    const fieldErrors = await expectFieldErrors(
      validator.assertCanCreateHolding(
        OWNER_USER_ID,
        createHoldingInputFixture({ currency: "JPY" })
      )
    );

    expect(fieldErrors.currency).toContain("JPY");
    expect(fieldErrors.currency).toContain("NIS");
  });

  it("rejects a target percent above 100 and below 0", async () => {
    const validator = new HoldingWriteValidator(repositoryStub());

    const aboveBounds = await expectFieldErrors(
      validator.assertCanCreateHolding(
        OWNER_USER_ID,
        createHoldingInputFixture({ targetPercent: 100.5 })
      )
    );
    const belowBounds = await expectFieldErrors(
      validator.assertCanCreateHolding(
        OWNER_USER_ID,
        createHoldingInputFixture({ targetPercent: -0.5 })
      )
    );

    expect(aboveBounds.targetPercent).toContain("100.5");
    expect(belowBounds.targetPercent).toContain("-0.5");
  });

  it("accepts target percents at both bounds and a missing target percent", async () => {
    const validator = new HoldingWriteValidator(repositoryStub());

    await expect(
      validator.assertCanCreateHolding(
        OWNER_USER_ID,
        createHoldingInputFixture({ targetPercent: 0 })
      )
    ).resolves.toBeUndefined();
    await expect(
      validator.assertCanCreateHolding(
        OWNER_USER_ID,
        createHoldingInputFixture({ targetPercent: 100 })
      )
    ).resolves.toBeUndefined();
    await expect(
      validator.assertCanCreateHolding(
        OWNER_USER_ID,
        createHoldingInputFixture({ targetPercent: null })
      )
    ).resolves.toBeUndefined();
  });

  it("requires a source symbol for a market-priced holding", async () => {
    const validator = new HoldingWriteValidator(repositoryStub());

    const fieldErrors = await expectFieldErrors(
      validator.assertCanCreateHolding(
        OWNER_USER_ID,
        createHoldingInputFixture({ sourceSymbol: "  " })
      )
    );

    expect(fieldErrors.sourceSymbol).toContain(PriceSource.FINNHUB);
  });

  it("rejects a manual value on a market-priced holding", async () => {
    const validator = new HoldingWriteValidator(repositoryStub());

    const fieldErrors = await expectFieldErrors(
      validator.assertCanCreateHolding(
        OWNER_USER_ID,
        createHoldingInputFixture({ manualValueNis: 500 })
      )
    );

    expect(fieldErrors.manualValueNis).toContain("500");
  });

  it("requires a manual value for a manually priced holding", async () => {
    const validator = new HoldingWriteValidator(repositoryStub());

    const fieldErrors = await expectFieldErrors(
      validator.assertCanCreateHolding(
        OWNER_USER_ID,
        createHoldingInputFixture({
          priceSource: PriceSource.MANUAL,
          sourceSymbol: null,
          currency: "NIS",
        })
      )
    );

    expect(fieldErrors.manualValueNis).toMatch(/required/i);
  });

  it("rejects a source symbol on a manually priced holding", async () => {
    const validator = new HoldingWriteValidator(repositoryStub());

    const fieldErrors = await expectFieldErrors(
      validator.assertCanCreateHolding(
        OWNER_USER_ID,
        createHoldingInputFixture({
          priceSource: PriceSource.MANUAL,
          sourceSymbol: "IVV",
          currency: "NIS",
          manualValueNis: 84919,
        })
      )
    );

    expect(fieldErrors.sourceSymbol).toContain("IVV");
  });

  it("rejects a negative manual value but accepts a manual value of zero", async () => {
    const validator = new HoldingWriteValidator(repositoryStub());
    const manualInput = createHoldingInputFixture({
      priceSource: PriceSource.MANUAL,
      sourceSymbol: null,
      currency: "NIS",
    });

    const fieldErrors = await expectFieldErrors(
      validator.assertCanCreateHolding(OWNER_USER_ID, {
        ...manualInput,
        manualValueNis: -1,
      })
    );
    expect(fieldErrors.manualValueNis).toContain("-1");

    await expect(
      validator.assertCanCreateHolding(OWNER_USER_ID, {
        ...manualInput,
        manualValueNis: 0,
      })
    ).resolves.toBeUndefined();
  });

  it("reports every broken rule in one response", async () => {
    const validator = new HoldingWriteValidator(repositoryStub());

    const fieldErrors = await expectFieldErrors(
      validator.assertCanCreateHolding(
        OWNER_USER_ID,
        createHoldingInputFixture({
          assetName: "",
          quantity: -1,
          currency: "GBP",
          targetPercent: 250,
          sourceSymbol: null,
        })
      )
    );

    expect(Object.keys(fieldErrors).sort()).toEqual([
      "assetName",
      "currency",
      "quantity",
      "sourceSymbol",
      "targetPercent",
    ]);
  });

  it("rejects a platform that belongs to another user", async () => {
    const repository = repositoryStub({
      findPlatformOwnedBy: vi.fn(async () => null),
    });
    const validator = new HoldingWriteValidator(repository);

    await expect(
      validator.assertCanCreateHolding(
        OTHER_USER_ID,
        createHoldingInputFixture()
      )
    ).rejects.toBeInstanceOf(PlatformNotFoundError);
    expect(repository.findPlatformOwnedBy).toHaveBeenCalledWith(
      OTHER_USER_ID,
      "platform-1"
    );
  });
});

describe("HoldingWriteValidator.assertCanUpdateHolding", () => {
  it("rejects a holding that belongs to another user", async () => {
    const repository = repositoryStub({
      findHoldingOwnedBy: vi.fn(async () => null),
    });
    const validator = new HoldingWriteValidator(repository);

    await expect(
      validator.assertCanUpdateHolding(OTHER_USER_ID, "holding-1", {
        quantity: 5,
      })
    ).rejects.toBeInstanceOf(HoldingNotFoundError);
    expect(repository.findHoldingOwnedBy).toHaveBeenCalledWith(
      OTHER_USER_ID,
      "holding-1"
    );
  });

  it("returns the stored holding when the patch is valid", async () => {
    const validator = new HoldingWriteValidator(repositoryStub());

    const existingHolding = await validator.assertCanUpdateHolding(
      OWNER_USER_ID,
      "holding-1",
      { quantity: 200 }
    );

    expect(existingHolding.id).toBe("holding-1");
  });

  it("validates the merged holding, not just the patched fields", async () => {
    const validator = new HoldingWriteValidator(repositoryStub());

    const fieldErrors = await expectFieldErrors(
      validator.assertCanUpdateHolding(OWNER_USER_ID, "holding-1", {
        quantity: -2,
      })
    );

    expect(fieldErrors.quantity).toContain("-2");
  });

  it("requires a manual value when switching a holding to MANUAL", async () => {
    const validator = new HoldingWriteValidator(repositoryStub());

    const fieldErrors = await expectFieldErrors(
      validator.assertCanUpdateHolding(OWNER_USER_ID, "holding-1", {
        priceSource: PriceSource.MANUAL,
      })
    );

    expect(fieldErrors.manualValueNis).toMatch(/required/i);
    expect(fieldErrors.sourceSymbol).toBeUndefined();
  });

  it("accepts switching a manual holding back to a market price source", async () => {
    const repository = repositoryStub({
      findHoldingOwnedBy: vi.fn(async () =>
        holdingFixture({
          priceSource: PriceSource.MANUAL,
          sourceSymbol: null,
          currency: "NIS",
          manualValueNis: 84919,
        })
      ),
    });
    const validator = new HoldingWriteValidator(repository);

    await expect(
      validator.assertCanUpdateHolding(OWNER_USER_ID, "holding-1", {
        priceSource: PriceSource.YAHOO,
        sourceSymbol: "1159250",
      })
    ).resolves.toBeDefined();
  });

  it("rejects moving a holding onto a platform the user does not own", async () => {
    const repository = repositoryStub({
      findPlatformOwnedBy: vi.fn(async () => null),
    });
    const validator = new HoldingWriteValidator(repository);

    await expect(
      validator.assertCanUpdateHolding(OWNER_USER_ID, "holding-1", {
        platformId: "platform-of-someone-else",
      })
    ).rejects.toBeInstanceOf(PlatformNotFoundError);
  });
});

describe("HoldingWriteValidator.assertCanDeleteHolding", () => {
  it("returns the holding when the user owns it", async () => {
    const validator = new HoldingWriteValidator(repositoryStub());

    const holding = await validator.assertCanDeleteHolding(
      OWNER_USER_ID,
      "holding-1"
    );

    expect(holding.id).toBe("holding-1");
  });

  it("rejects deleting a holding that belongs to another user", async () => {
    const validator = new HoldingWriteValidator(
      repositoryStub({ findHoldingOwnedBy: vi.fn(async () => null) })
    );

    await expect(
      validator.assertCanDeleteHolding(OTHER_USER_ID, "holding-1")
    ).rejects.toBeInstanceOf(HoldingNotFoundError);
  });
});
