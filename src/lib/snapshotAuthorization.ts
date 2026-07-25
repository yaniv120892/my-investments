import { createHash, timingSafeEqual } from "crypto";

const BEARER_PREFIX = "Bearer ";

export function isSnapshotRequestAuthorized(headers: Headers): boolean {
  return hasAuthenticatedSession(headers) || hasValidCronSecret(headers);
}

/**
 * Vercel Cron can only issue GET requests, and a GET that a browser session
 * could authorize would be triggerable cross-site by any page that embeds the
 * URL, so the scheduled entry point accepts the shared secret only.
 */
export function isCronSecretAuthorized(headers: Headers): boolean {
  return hasValidCronSecret(headers);
}

function hasAuthenticatedSession(headers: Headers): boolean {
  const userId = headers.get("x-user-id");
  return userId !== null && userId.trim().length > 0;
}

function hasValidCronSecret(headers: Headers): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret || configuredSecret.trim().length === 0) {
    return false;
  }

  const authorizationHeader = headers.get("authorization");
  if (!authorizationHeader?.startsWith(BEARER_PREFIX)) {
    return false;
  }

  const providedSecret = authorizationHeader.slice(BEARER_PREFIX.length);
  return isTimingSafeEqual(providedSecret, configuredSecret);
}

function isTimingSafeEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}
