import { AuthSession } from "@/types";

interface JWTPayload {
  userId: string;
  email: string;
  exp: number;
}

// Base64 URL decode
function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) {
    str += "=";
  }
  return atob(str);
}

// Parse JWT without verification (for Edge Runtime)
function parseJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

export function verifyJWT(token: string): AuthSession | null {
  try {
    const payload = parseJWT(token);
    if (!payload) {
      return null;
    }

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      expiresAt: new Date(payload.exp * 1000),
    };
  } catch (error) {
    console.error("JWT verification error:", error);
    return null;
  }
}
