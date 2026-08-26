/**
 * The names the middleware and the route handlers agree on. They are protocol,
 * not values: nothing in the type system objects to `"x-user-idd"`, and a
 * request carrying it reads as unauthenticated rather than as a typo.
 *
 * Kept free of imports so `src/middleware.ts` can use it on the edge runtime.
 */

/** Holds the session JWT the middleware verifies on every request. */
export const AUTH_COOKIE_NAME = "auth-token";

/**
 * Set by the middleware only, and stripped from every path where it does not
 * set them, so a route may treat their presence as proof of authentication.
 */
export const USER_ID_HEADER = "x-user-id";
export const USER_EMAIL_HEADER = "x-user-email";
