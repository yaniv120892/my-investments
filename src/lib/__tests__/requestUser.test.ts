import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { USER_ID_HEADER } from "@/lib/authTokens";
import { withUser } from "@/lib/requestUser";

function request(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL("http://localhost/api/holdings"), {
    method: "POST",
    headers,
  });
}

describe("withUser", () => {
  it("passes the header's user id to the handler", async () => {
    const handler = vi.fn(async (userId: string) =>
      NextResponse.json({ userId })
    );

    const response = await withUser(handler)(
      request({ [USER_ID_HEADER]: "user-1" })
    );

    expect(handler).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({ userId: "user-1" });
  });

  it("answers 401 without running the handler when the header is absent", async () => {
    const handler = vi.fn(async () => NextResponse.json({}));

    const response = await withUser(handler)(request());

    expect(handler).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("forwards the route context a dynamic segment handler needs", async () => {
    const handler = vi.fn(
      async (
        userId: string,
        _request: NextRequest,
        context: { params: Promise<{ id: string }> }
      ) => NextResponse.json({ userId, ...(await context.params) })
    );

    const response = await withUser(handler)(
      request({ [USER_ID_HEADER]: "user-1" }),
      { params: Promise.resolve({ id: "holding-1" }) }
    );

    await expect(response.json()).resolves.toEqual({
      userId: "user-1",
      id: "holding-1",
    });
  });
});
