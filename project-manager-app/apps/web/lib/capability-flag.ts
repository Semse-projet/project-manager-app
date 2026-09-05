export function isCapabilitySelectorEnabled(tenantId: string): boolean {
  const enabled = (process.env.SEMSE_IDENTITY_CAPABILITY_UI_ENABLED ?? "").trim().toLowerCase() === "true";
  if (enabled) return true;

  const allowlist = (process.env.SEMSE_IDENTITY_CAPABILITY_UI_CANARY_TENANT_IDS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return allowlist.includes(tenantId);
}
