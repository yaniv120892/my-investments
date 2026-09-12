import { describe, expect, it } from "vitest";
import { decideMigration } from "../migrationGate";

const PRODUCTION = {
  VERCEL_ENV: "production",
  DIRECT_URL: "postgresql://user:pass@host/db",
};

describe("decideMigration", () => {
  it("applies migrations on a production build", () => {
    expect(decideMigration(PRODUCTION)).toEqual({ apply: true });
  });

  it("skips a preview build, so an unmerged branch cannot migrate the live database", () => {
    const decision = decideMigration({ ...PRODUCTION, VERCEL_ENV: "preview" });

    expect(decision.apply).toBe(false);
    expect(decision).toHaveProperty(
      "reason",
      expect.stringContaining("preview")
    );
  });

  it("skips a development build", () => {
    expect(
      decideMigration({ ...PRODUCTION, VERCEL_ENV: "development" }).apply
    ).toBe(false);
  });

  it("skips entirely outside Vercel, where no build is deploying anything", () => {
    expect(decideMigration({ DIRECT_URL: PRODUCTION.DIRECT_URL }).apply).toBe(
      false
    );
  });

  it("fails a production build with a missing DIRECT_URL rather than migrating through the pooler", () => {
    expect(() => decideMigration({ VERCEL_ENV: "production" })).toThrow(
      /DIRECT_URL is required/
    );
  });

  it("does not require DIRECT_URL when it is not going to migrate", () => {
    expect(() => decideMigration({ VERCEL_ENV: "preview" })).not.toThrow();
  });
});
