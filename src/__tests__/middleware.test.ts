import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, USER_ID_HEADER } from "@/lib/authTokens";

const verifyJWT = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth-edge", () => ({ verifyJWT }));

const { middleware } = await import("@/middleware");

const VALID_SESSION = {
  userId: "user-1",
  email: "owner@example.com",
  expiresAt: new Date(Date.now() + 60_000),
};

function request(path: string, cookie?: string): NextRequest {
  const built = new NextRequest(new URL(`http://localhost${path}`), {
    method: "POST",
  });
  if (cookie) {
    built.cookies.set(AUTH_COOKIE_NAME, cookie);
  }
  return built;
}

describe("middleware", () => {
  beforeEach(() => {
    verifyJWT.mockReset();
  });

  it("answers an unauthenticated API request with 401, not a redirect", async () => {
    const response = await middleware(request("/api/holdings"));

    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("still redirects an unauthenticated page request to /login", async () => {
    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("lets an expired cookie through to the login endpoint that fixes it", async () => {
    verifyJWT.mockResolvedValue(null);

    const response = await middleware(request("/api/auth/login", "stale"));

    expect(response.status).not.toBe(401);
    expect(response.headers.get("location")).toBeNull();
  });

  it("rejects an expired cookie on a private API route and clears it", async () => {
    verifyJWT.mockResolvedValue(null);

    const response = await middleware(request("/api/holdings", "stale"));

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain(AUTH_COOKIE_NAME);
  });

  it("sets the identity headers on an authenticated API request", async () => {
    verifyJWT.mockResolvedValue(VALID_SESSION);

    const response = await middleware(request("/api/holdings", "good"));

    expect(response.headers.get("x-middleware-override-headers")).toContain(
      USER_ID_HEADER
    );
  });

  it("strips a client-sent identity header where it does not set one", async () => {
    const forged = new NextRequest(new URL("http://localhost/"), {
      headers: { [USER_ID_HEADER]: "someone-else" },
    });

    const response = await middleware(forged);

    expect(
      response.headers.get(`x-middleware-request-${USER_ID_HEADER}`)
    ).toBeNull();
  });
});
