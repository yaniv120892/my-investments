import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { PlatformWriteValidator } = await import(
  "@/lib/holdings/platformWriteValidator"
);
const { HoldingValidationError, PlatformNameConflictError } = await import(
  "@/lib/holdings/holdingWriteErrors"
);
const { OWNER_USER_ID, platformFixture, repositoryStub } = await import(
  "@/lib/holdings/__tests__/holdingTestFixtures"
);

describe("PlatformWriteValidator.assertCanCreatePlatform", () => {
  it("accepts a new platform name for the requesting user", async () => {
    const repository = repositoryStub();
    const validator = new PlatformWriteValidator(repository);

    await validator.assertCanCreatePlatform(OWNER_USER_ID, {
      name: "Interactive Brokers",
      baseCurrency: "USD",
    });

    expect(repository.findPlatformByName).toHaveBeenCalledWith(
      OWNER_USER_ID,
      "Interactive Brokers"
    );
  });

  it("rejects a blank platform name", async () => {
    const validator = new PlatformWriteValidator(repositoryStub());

    await expect(
      validator.assertCanCreatePlatform(OWNER_USER_ID, {
        name: "   ",
        baseCurrency: "USD",
      })
    ).rejects.toBeInstanceOf(HoldingValidationError);
  });

  it("rejects a base currency the pricing service cannot convert", async () => {
    const validator = new PlatformWriteValidator(repositoryStub());

    await expect(
      validator.assertCanCreatePlatform(OWNER_USER_ID, {
        name: "Degiro",
        baseCurrency: "JPY",
      })
    ).rejects.toThrow(/JPY/);
  });

  it("rejects a duplicate platform name for the same user", async () => {
    const validator = new PlatformWriteValidator(
      repositoryStub({
        findPlatformByName: vi.fn(async () => platformFixture()),
      })
    );

    await expect(
      validator.assertCanCreatePlatform(OWNER_USER_ID, {
        name: "Blink",
        baseCurrency: "USD",
      })
    ).rejects.toBeInstanceOf(PlatformNameConflictError);
  });
});
