import type { UserCapabilityView } from "../app/semse-api";

export function deriveActiveCapability(
  capabilities: UserCapabilityView[],
  activeOrgId: string | null,
): UserCapabilityView | null {
  if (!activeOrgId) return null;
  return capabilities.find((capability) => capability.orgId === activeOrgId) ?? null;
}
