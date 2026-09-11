import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { USER_ID_HEADER } from "@/lib/authTokens";

/**
 * Hands a route handler the caller's id as a `string`.
 *
 * The middleware already answers an unauthenticated /api request with a 401
 * before any handler runs, so the missing-header branch is unreachable while
 * the matcher and the public-route list stay as they are. It exists so that
 * widening either one fails closed rather than passing `null` to a repository
 * as a user id, and so no handler can read the header without checking it.
 */
export function withUser<TRest extends unknown[]>(
  handler: (
    userId: string,
    request: NextRequest,
    ...rest: TRest
  ) => Promise<Response>
): (request: NextRequest, ...rest: TRest) => Promise<Response> {
  return async (request: NextRequest, ...rest: TRest): Promise<Response> => {
    const userId = request.headers.get(USER_ID_HEADER);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return handler(userId, request, ...rest);
  };
}
