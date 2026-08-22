import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth-edge";

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

  const authToken = request.cookies.get("auth-token")?.value;

  if (!authToken) {
    const requiresSession = !isPublicRoute && pathname !== "/";
    if (requiresSession) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return nextWithoutClientIdentityHeaders(request);
  }

  const session = await verifyJWT(authToken);

  if (!session || session.expiresAt < new Date()) {
    return redirectToLoginClearingSession(request);
  }

  if (pathname.startsWith("/api/") && !isPublicApiRoute) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", session.userId);
    requestHeaders.set("x-user-email", session.email);

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

function redirectToLoginClearingSession(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set("auth-token", "", {
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
  requestHeaders.delete("x-user-id");
  requestHeaders.delete("x-user-email");

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
