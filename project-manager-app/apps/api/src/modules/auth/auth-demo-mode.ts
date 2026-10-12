import { createHash, timingSafeEqual } from "node:crypto";

export const LEGACY_DEMO_ACCOUNTS: Record<
  string,
  { userId: string; tenantId: string; orgId: string; roles: string[] }
> = {
  "client@demo.semse": {
    userId: "usr_client_001",
    tenantId: "tenant_default",
    orgId: "org_client_001",
    roles: ["CLIENT"],
  },
  "worker@demo.semse": {
    userId: "usr_worker_001",
    tenantId: "tenant_default",
    orgId: "org_pro_001",
    roles: ["PRO"],
  },
  "admin@demo.semse": {
    userId: "usr_admin_001",
    tenantId: "tenant_default",
    orgId: "org_admin_001",
    roles: ["OPS_ADMIN"],
  },
};

const LEGACY_DEMO_USER_IDS = new Set(
  Object.values(LEGACY_DEMO_ACCOUNTS).map((account) => account.userId),
);

export function isLegacyDemoLoginEnabled(): boolean {
  return process.env.SEMSE_DEMO_MODE === "true" || process.env.NODE_ENV !== "production";
}

export function isDisabledDemoIdentity(userId: string, roles: string[]): boolean {
  if (LEGACY_DEMO_USER_IDS.has(userId) && !isLegacyDemoLoginEnabled()) {
    return true;
  }

  const agroDemoEnabled =
    process.env.DEMO_MODE_ENABLED === "true" || process.env.NODE_ENV !== "production";
  return roles.includes("DEMO_AGRO") && !agroDemoEnabled;
}

/**
 * Password for the legacy demo accounts. `demo1234` is public (repository, seed, docs), so it is
 * only acceptable outside production. In production demo login needs an explicit
 * SEMSE_DEMO_PASSWORD of at least 12 characters; otherwise it stays closed even when
 * SEMSE_DEMO_MODE is "true".
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
