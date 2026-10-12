import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Password for the legacy demo accounts (client/worker/admin@demo.semse).
 *
 * `demo1234` is public (it is in the repository, the seed and the docs), so it is only
 * ever acceptable in non-production environments. Production demo fallback is
 * disabled irrespective of SEMSE_DEMO_MODE and SEMSE_DEMO_PASSWORD.
 */
export const LOCAL_DEV_DEMO_PASSWORD = "demo1234";
export const MIN_PRODUCTION_DEMO_PASSWORD_LENGTH = 12;

export function resolveDemoLoginPassword(env: Record<string, string | undefined> = process.env): string | null {
  // Fail closed: no locally signed demo session in production, even with a private secret.
  if (env.NODE_ENV === "production") return null;
  return env.SEMSE_DEMO_PASSWORD?.trim() || LOCAL_DEV_DEMO_PASSWORD;
}

/** Constant-time comparison; `expected === null` means demo login is closed. */
export function demoPasswordMatches(candidate: string, expected: string | null): boolean {
  if (expected === null) return false;
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
