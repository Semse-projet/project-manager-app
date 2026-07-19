import type {
  ForgeAgentManifest,
  ForgeApprovalMode,
  ForgePolicyResult,
  ForgeRiskLevel,
  ForgeTaskPacket
} from "./types.js";

const riskWeight: Record<ForgeRiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const productionSensitiveActions = new Set([
  "deployment.execute",
  "production.write",
  "secret.write",
  "identity.policy.change",
  "payment.policy.change"
]);

const dualControlActions = new Set([
  "database.migrate",
  "schema.apply",
  "deployment.execute",
  "secret.write",
  "identity.policy.change",
  "payment.policy.change"
]);

export function matchesScope(path: string, scope: string): boolean {
  if (scope === "**") return true;

  if (scope.startsWith("**/")) {
    const suffix = scope.slice(3);
    if (!suffix) return true;
    if (suffix.includes("*")) {
      const fileName = path.split("/").pop() ?? "";
      const starIndex = suffix.indexOf("*");
      const prefix = suffix.slice(0, starIndex);
      const rest = suffix.slice(starIndex + 1);
      if (!fileName.startsWith(prefix)) return false;
      if (rest && !fileName.endsWith(rest)) return false;
      return true;
    }
    return path === suffix || path.endsWith("/" + suffix);
  }

  if (scope.endsWith("/**")) {
    const prefix = scope.slice(0, -3);
    if (prefix === "") return true;
    return path === prefix || path.startsWith(prefix + "/");
  }

  if (scope.endsWith("*")) {
    return path.startsWith(scope.slice(0, -1));
  }

  return path === scope;
}

function requiredApprovalModes(
  manifest: ForgeAgentManifest,
  task: ForgeTaskPacket,
  action: string
): ForgeApprovalMode[] {
  const modes = new Set<ForgeApprovalMode>();

  if (manifest.approvalMode !== "none") modes.add(manifest.approvalMode);
  if (task.environment === "production" || productionSensitiveActions.has(action)) {
    modes.add("ops_admin");
  }
  if (dualControlActions.has(action) || task.riskLevel === "critical") {
    modes.add("dual_control");
  }
  if (action === "creator.publish" || action === "marketplace.publish") {
    modes.add("creator_review");
    modes.add("ops_admin");
  }

  return [...modes].filter((mode) => mode !== "none");
}

export function evaluateForgePolicy(input: {
  manifest: ForgeAgentManifest;
  task: ForgeTaskPacket;
  action: string;
  changedFiles?: string[];
}): ForgePolicyResult {
  const { manifest, task, action } = input;
  const changedFiles = input.changedFiles ?? [];
  const violations: string[] = [];
  const auditTags: string[] = ["forge.policy.evaluated", `forge.agent.${manifest.role}`];

  if (task.spec.status !== "APPROVED" && !action.startsWith("spec.")) {
    violations.push("policy.spec.must_be_approved");
  }

  const branchAgnosticActions = new Set(["deployment.propose", "rollback.prepare"]);
  if ((task.targetBranch === "main" || task.targetBranch === "master") && !branchAgnosticActions.has(action)) {
    violations.push("policy.no_direct_default_branch");
  }

  if (!manifest.allowedActions.includes(action)) {
    violations.push("policy.action.not_allowed");
  }

  if (riskWeight[task.riskLevel] > riskWeight[manifest.maxRiskLevel]) {
    violations.push("policy.risk.exceeds_agent_limit");
  }

  for (const path of changedFiles) {
    const taskAllows = task.allowedFiles.some((scope) => matchesScope(path, scope));
    const agentAllows = manifest.fileScopes.some((scope) => matchesScope(path, scope));
    const forbidden = task.forbiddenFiles.some((scope) => matchesScope(path, scope));

    if (!taskAllows) violations.push(`policy.task.file_out_of_scope:${path}`);
    if (!agentAllows) violations.push(`policy.agent.file_out_of_scope:${path}`);
    if (forbidden) violations.push(`policy.task.file_forbidden:${path}`);
  }

  if (violations.length > 0) {
    return {
      decision: "deny",
      reason: "One or more Forge policies denied the requested action.",
      riskLevel: task.riskLevel,
      requiredApprovals: [],
      violatedPolicies: [...new Set(violations)],
      auditTags: [...auditTags, "forge.policy.denied"]
    };
  }

  const approvals = requiredApprovalModes(manifest, task, action);
  if (approvals.length > 0) {
    return {
      decision: "require_approval",
      reason: "The action is within scope but requires explicit human approval.",
      riskLevel: task.riskLevel,
      requiredApprovals: approvals,
      violatedPolicies: [],
      auditTags: [...auditTags, "forge.policy.approval_required"]
    };
  }

  return {
    decision: "allow",
    reason: "The action is approved by the current Forge policy set.",
    riskLevel: task.riskLevel,
    requiredApprovals: [],
    violatedPolicies: [],
    auditTags: [...auditTags, "forge.policy.allowed"]
  };
}
