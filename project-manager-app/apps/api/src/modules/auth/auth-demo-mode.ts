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
