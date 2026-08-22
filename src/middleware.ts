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
    if (!isPublicRoute && pathname !== "/") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return nextWithoutClientIdentityHeaders(request);
  }

  const session = await verifyJWT(authToken);

  if (!session) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set("auth-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
    });
    return response;
  }

  if (session.expiresAt < new Date()) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set("auth-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
    });
    return response;
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
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
