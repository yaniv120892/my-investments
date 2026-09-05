import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth-edge";
import {
  AUTH_COOKIE_NAME,
  USER_EMAIL_HEADER,
  USER_ID_HEADER,
} from "@/lib/authTokens";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicRoutes = ["/login", "/signup", "/api/auth", "/api/snapshot"];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  const publicApiRoutes = ["/api/auth"];
  const isPublicApiRoute = publicApiRoutes.some((route) =>
    pathname.startsWith(route)
  );

  const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  const requiresSession = !isPublicRoute && pathname !== "/";

  if (!authToken) {
    if (requiresSession) {
      return unauthenticatedResponse(request);
    }
    return nextWithoutClientIdentityHeaders(request);
  }

  const session = await verifyJWT(authToken);

  if (!session || session.expiresAt < new Date()) {
    // A stale cookie must not lock the holder out of the endpoint that fixes
    // it: /api/auth/login is public, and rejecting it here is unrecoverable.
    if (!requiresSession) {
      return clearSession(nextWithoutClientIdentityHeaders(request));
    }
    return clearSession(unauthenticatedResponse(request));
  }

  if (pathname.startsWith("/api/") && !isPublicApiRoute) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(USER_ID_HEADER, session.userId);
    requestHeaders.set(USER_EMAIL_HEADER, session.email);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (pathname === "/login" || pathname === "/signup") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return nextWithoutClientIdentityHeaders(request);
}

/**
 * Redirecting an API request sends the login page's HTML back to `fetch`, which
 * follows it and reports a 200 — so the caller's `response.json()` fails as a
 * syntax error rather than as the auth failure it is.
 */
function unauthenticatedResponse(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

function clearSession(response: NextResponse): NextResponse {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
  });
  return response;
}

/**
 * Route handlers treat x-user-id / x-user-email as proof of an authenticated
 * session, so any copy the client sent must be dropped on the paths where this
 * middleware does not overwrite them itself.
 */
function nextWithoutClientIdentityHeaders(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(USER_ID_HEADER);
  requestHeaders.delete(USER_EMAIL_HEADER);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
