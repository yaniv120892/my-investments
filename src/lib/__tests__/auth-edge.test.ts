import { beforeEach, describe, expect, it } from "vitest";
import { verifyJWT } from "@/lib/auth-edge";

const SECRET = "test-secret-value";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeSegment(value: object): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function sign(signingInput: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput)
  );
  return base64Url(new Uint8Array(signature));
}

interface TokenOptions {
  secret?: string;
  algorithm?: string;
  expiresInSeconds?: number;
  userId?: string;
}

async function createToken(options: TokenOptions = {}): Promise<string> {
  const {
    secret = SECRET,
    algorithm = "HS256",
    expiresInSeconds = 3600,
    userId = "user-1",
  } = options;

  const header = encodeSegment({ alg: algorithm, typ: "JWT" });
  const payload = encodeSegment({
    userId,
    email: "someone@example.com",
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  });
  const signature = await sign(`${header}.${payload}`, secret);

  return `${header}.${payload}.${signature}`;
}

describe("verifyJWT", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  it("accepts a token signed with the configured secret", async () => {
    const session = await verifyJWT(await createToken());

    expect(session?.userId).toBe("user-1");
    expect(session?.email).toBe("someone@example.com");
  });

  it("rejects a token whose signature does not verify", async () => {
    const token = await createToken();
    const tampered = `${token.slice(0, -4)}AAAA`;

    expect(await verifyJWT(tampered)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createToken({ secret: "some-other-secret" });

    expect(await verifyJWT(token)).toBeNull();
  });

  it("rejects a forged token carrying no real signature", async () => {
    const header = encodeSegment({ alg: "HS256", typ: "JWT" });
    const payload = encodeSegment({
      userId: "victim",
      email: "victim@example.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(await verifyJWT(`${header}.${payload}.not-a-signature`)).toBeNull();
  });

  it("rejects the alg=none downgrade", async () => {
    const header = encodeSegment({ alg: "none", typ: "JWT" });
    const payload = encodeSegment({
      userId: "victim",
      email: "victim@example.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(await verifyJWT(`${header}.${payload}.`)).toBeNull();
  });

  it("rejects a payload tampered with after signing", async () => {
    const token = await createToken({ userId: "user-1" });
    const [header, , signature] = token.split(".");
    const swappedPayload = encodeSegment({
      userId: "someone-else",
      email: "someone@example.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(
      await verifyJWT(`${header}.${swappedPayload}.${signature}`)
    ).toBeNull();
  });

  it("rejects an expired token even when correctly signed", async () => {
    const token = await createToken({ expiresInSeconds: -60 });

    expect(await verifyJWT(token)).toBeNull();
  });

  it("rejects a malformed token", async () => {
    expect(await verifyJWT("not.a.jwt")).toBeNull();
    expect(await verifyJWT("onlyonesegment")).toBeNull();
    expect(await verifyJWT("")).toBeNull();
  });

  it("refuses every token when JWT_SECRET is unset", async () => {
    const token = await createToken();
    delete process.env.JWT_SECRET;

    expect(await verifyJWT(token)).toBeNull();
  });
});
