// Edge-safe by contract: no Node built-ins and no Prisma, because
// src/middleware.ts loads this.

export const AUTH_COOKIE_NAME = "auth-token";

export const USER_ID_HEADER = "x-user-id";
export const USER_EMAIL_HEADER = "x-user-email";
