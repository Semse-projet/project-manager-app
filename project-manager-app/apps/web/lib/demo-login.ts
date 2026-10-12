import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Password for the legacy demo accounts (client/worker/admin@demo.semse).
 *
 * `demo1234` is public (it is in the repository, the seed and the docs), so it is only
 * ever acceptable in non-production environments. In production the demo fallback works
 * only if the operator sets an explicit SEMSE_DEMO_PASSWORD of at least 12 characters;
 * otherwise demo login is closed even when SEMSE_DEMO_MODE is "true".
 */
export const LOCAL_DEV_DEMO_PASSWORD = "demo1234";
export const MIN_PRODUCTION_DEMO_PASSWORD_LENGTH = 12;

export function resolveDemoLoginPassword(env: Record<string, string | undefined> = process.env): string | null {
  const configured = env.SEMSE_DEMO_PASSWORD?.trim();

  if (env.NODE_ENV !== "production") {
    return configured || LOCAL_DEV_DEMO_PASSWORD;
  }

  if (!configured || configured.length < MIN_PRODUCTION_DEMO_PASSWORD_LENGTH || configured === LOCAL_DEV_DEMO_PASSWORD) {
    return null;
  }

  return configured;
}

/** Constant-time comparison; `expected === null` means demo login is closed. */
export function demoPasswordMatches(candidate: string, expected: string | null): boolean {
  if (expected === null) return false;
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
