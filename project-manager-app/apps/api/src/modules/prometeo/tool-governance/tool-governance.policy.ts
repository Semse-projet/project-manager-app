import { hasPermission } from "../../../common/rbac.js";
import type { PrometeoToolDescriptor } from "@semse/schemas";

export type PrometeoToolPolicyDecision = "allow" | "deny" | "require_approval";

export type PrometeoToolPolicyResult = {
  decision: PrometeoToolPolicyDecision;
  missingPermissions: string[];
};

export function evaluatePrometeoToolPolicy(input: {
  actorRoles: readonly string[];
  descriptor: Pick<PrometeoToolDescriptor, "permissions" | "approvalPolicy">;
}): PrometeoToolPolicyResult {
  const missingPermissions = input.descriptor.permissions.filter(
    (permission) => !hasPermission(input.actorRoles, permission),
  );

  if (missingPermissions.length > 0) {
    return { decision: "deny", missingPermissions };
  }

  if (input.descriptor.approvalPolicy === "none") {
    return { decision: "allow", missingPermissions: [] };
  }

  return { decision: "require_approval", missingPermissions: [] };
}
