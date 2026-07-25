import { AuthSession } from "@/types";

const SUPPORTED_ALGORITHM = "HS256";

interface JwtHeader {
  alg: string;
}

interface JwtPayload {
  userId: string;
  email: string;
  exp: number;
}

export async function verifyJWT(token: string): Promise<AuthSession | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET is not set; refusing to authorize any session");
    return null;
  }

  const segments = token.split(".");
  if (segments.length !== 3) {
    return null;
  }
  const [encodedHeader, encodedPayload, encodedSignature] = segments;

  const header = decodeJsonSegment(encodedHeader);
  if (!isJwtHeader(header) || header.alg !== SUPPORTED_ALGORITHM) {
    return null;
  }

  const signatureIsValid = await isSignatureValid(
    `${encodedHeader}.${encodedPayload}`,
    encodedSignature,
    secret
  );
  if (!signatureIsValid) {
    return null;
  }

  const payload = decodeJsonSegment(encodedPayload);
  if (!isJwtPayload(payload)) {
    return null;
  }

  const expiresAt = new Date(payload.exp * 1000);
  if (expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return { userId: payload.userId, email: payload.email, expiresAt };
}

async function isSignatureValid(
  signingInput: string,
  encodedSignature: string,
  secret: string
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    return await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(encodedSignature),
      new TextEncoder().encode(signingInput)
    );
  } catch {
    return false;
  }
}

function decodeJsonSegment(segment: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)));
  } catch {
    return null;
  }
}

function base64UrlToBytes(segment: string): Uint8Array {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function isJwtHeader(value: unknown): value is JwtHeader {
  return (
    typeof value === "object" &&
    value !== null &&
    "alg" in value &&
    typeof value.alg === "string"
  );
}

function isJwtPayload(value: unknown): value is JwtPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("userId" in value) || !("email" in value) || !("exp" in value)) {
    return false;
  }
  return (
    typeof value.userId === "string" &&
    value.userId.length > 0 &&
    typeof value.email === "string" &&
    typeof value.exp === "number" &&
    Number.isFinite(value.exp)
  );
}
