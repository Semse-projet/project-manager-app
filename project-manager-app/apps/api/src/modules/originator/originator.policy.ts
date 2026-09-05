export function isOriginatorRegistrationEnabled(
  tenantId: string,
  environment: Record<string, string | undefined> = process.env,
): boolean {
  if (environment.SEMSE_ORIGINATOR_REGISTRATION_ENABLED === "true") {
    return true;
  }
  const allowlist = new Set(
    (environment.SEMSE_ORIGINATOR_CANARY_TENANT_IDS ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
  return allowlist.has(tenantId);
}
