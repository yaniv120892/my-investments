import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isCronSecretAuthorized,
  isSnapshotRequestAuthorized,
} from "@/lib/snapshotAuthorization";

const CRON_SECRET = "test-cron-secret";

describe("isSnapshotRequestAuthorized", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
      return;
    }
    process.env.CRON_SECRET = originalCronSecret;
  });

  it("accepts a bearer token matching CRON_SECRET", () => {
    const headers = new Headers({ authorization: `Bearer ${CRON_SECRET}` });
    expect(isSnapshotRequestAuthorized(headers)).toBe(true);
  });

  it("rejects a bearer token that does not match CRON_SECRET", () => {
    const headers = new Headers({ authorization: "Bearer wrong-secret" });
    expect(isSnapshotRequestAuthorized(headers)).toBe(false);
  });

  it("rejects a bearer token that only shares a prefix with CRON_SECRET", () => {
    const headers = new Headers({ authorization: "Bearer test-cron" });
    expect(isSnapshotRequestAuthorized(headers)).toBe(false);
  });

  it("rejects a request with no authorization header and no session", () => {
    expect(isSnapshotRequestAuthorized(new Headers())).toBe(false);
  });

  it("rejects an authorization header that is not a bearer token", () => {
    const headers = new Headers({ authorization: CRON_SECRET });
    expect(isSnapshotRequestAuthorized(headers)).toBe(false);
  });

  it("rejects the bearer path when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    const headers = new Headers({ authorization: "Bearer " });
    expect(isSnapshotRequestAuthorized(headers)).toBe(false);
  });

  it("rejects the bearer path when CRON_SECRET is empty", () => {
    process.env.CRON_SECRET = "";
    const headers = new Headers({ authorization: "Bearer " });
    expect(isSnapshotRequestAuthorized(headers)).toBe(false);
  });

  it("rejects the bearer path when CRON_SECRET is whitespace only", () => {
    process.env.CRON_SECRET = "   ";
    const headers = new Headers({ authorization: "Bearer    " });
    expect(isSnapshotRequestAuthorized(headers)).toBe(false);
  });

  it("accepts a request carrying an injected session header without a bearer token", () => {
    const headers = new Headers({ "x-user-id": "user-123" });
    expect(isSnapshotRequestAuthorized(headers)).toBe(true);
  });

  it("rejects a blank session header", () => {
    const headers = new Headers({ "x-user-id": "   " });
    expect(isSnapshotRequestAuthorized(headers)).toBe(false);
  });
});

describe("isCronSecretAuthorized", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
      return;
    }
    process.env.CRON_SECRET = originalCronSecret;
  });

  it("accepts a bearer token matching CRON_SECRET", () => {
    const headers = new Headers({ authorization: `Bearer ${CRON_SECRET}` });
    expect(isCronSecretAuthorized(headers)).toBe(true);
  });

  it("rejects a session header, so a browser cannot be made to trigger it", () => {
    const headers = new Headers({ "x-user-id": "user-123" });
    expect(isCronSecretAuthorized(headers)).toBe(false);
  });

  it("rejects a wrong bearer token even alongside a session header", () => {
    const headers = new Headers({
      "x-user-id": "user-123",
      authorization: "Bearer wrong-secret",
    });
    expect(isCronSecretAuthorized(headers)).toBe(false);
  });

  it("rejects when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    const headers = new Headers({ authorization: `Bearer ${CRON_SECRET}` });
    expect(isCronSecretAuthorized(headers)).toBe(false);
  });
});
