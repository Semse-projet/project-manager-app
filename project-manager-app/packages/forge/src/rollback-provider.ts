import type { ForgeApprovalMode, ForgeDeploymentPlan, ForgePolicyResult, ForgeRollbackPlan, ForgeTaskPacket } from "./types.js";
import { matchesScope } from "./policy.js";

export type RollbackProviderInput = {
  runId: string;
  task: ForgeTaskPacket;
  policy: ForgePolicyResult;
  deploymentPlan?: ForgeDeploymentPlan;
};

export interface RollbackProvider {
  plan(input: RollbackProviderInput): ForgeRollbackPlan;
}

const ALLOWED_ENVIRONMENTS = new Set(["sandbox", "local", "ci", "staging", "production"]);

const DATA_PATTERNS = [
  "packages/db/prisma/schema.prisma",
  "packages/db/prisma/migrations/**",
  "**/*.sql"
];

function touchesDataFiles(allowedFiles?: string[]): boolean {
  return (allowedFiles ?? []).some((path) =>
    DATA_PATTERNS.some((scope) => matchesScope(path, scope))
  );
}

class DryRunRollbackProvider implements RollbackProvider {
  plan({ runId, task, policy, deploymentPlan }: RollbackProviderInput): ForgeRollbackPlan {
    const violations: string[] = [];
    const requiredApprovals = new Set<ForgeApprovalMode>(policy.requiredApprovals);
    const environment = task.environment;
    const targetBranch = task.targetBranch;

    if (policy.decision === "deny") {
      violations.push("rollback.policy.denied");
    }

    if (deploymentPlan && deploymentPlan.decision === "deny") {
      violations.push("rollback.deployment_plan.denied");
    }

    if (!ALLOWED_ENVIRONMENTS.has(environment)) {
      violations.push("rollback.invalid_environment");
    }

    if (environment === "production" && (task.riskLevel === "high" || task.riskLevel === "critical")) {
      violations.push("rollback.production_requires_approval");
      requiredApprovals.add("dual_control");
    }

    if (environment === "production" && targetBranch !== "main" && targetBranch !== "master") {
      violations.push("rollback.production_requires_default_branch");
    }

    const hasDataFiles = touchesDataFiles(task.allowedFiles);
    if (hasDataFiles) {
      violations.push("rollback.data_files_require_approval");
      requiredApprovals.add("security");
    }

    const auditTags = [
      "forge.rollback.planned",
      `forge.run.${runId}`,
      `forge.agent.${task.requestedRole}`,
      `forge.environment.${environment}`
    ];

    const denyViolations = violations.filter((v) => !v.endsWith("_approval"));
    if (denyViolations.length > 0) {
      return {
        mode: "dry-run",
        decision: "deny",
        reason: `Rollback plan denied: ${denyViolations.join("; ")}`,
        environment,
        targetBranch,
        steps: [],
        requiredApprovals: [...new Set(requiredApprovals)],
        violations,
        auditTags: [...auditTags, "forge.rollback.denied"]
      };
    }

    const steps = [
      "identify_previous_release",
      "backup_state",
      ...(hasDataFiles ? ["data_backup"] : []),
      "restore_release",
      "verify_health",
      "observe"
    ];

    const approvals = [...new Set(requiredApprovals)];
    const hasApprovalViolation = violations.length > 0;
    const decision: ForgeRollbackPlan["decision"] = approvals.length > 0 || hasApprovalViolation ? "require_approval" : "allow";

    return {
      mode: "dry-run",
      decision,
      reason: decision === "allow"
        ? `Dry-run rollback plan for ${environment} passed.`
        : `Dry-run rollback plan for ${environment} requires approval: ${approvals.join(", ")}`,
      environment,
      targetBranch,
      steps,
      requiredApprovals: approvals,
      violations,
      auditTags: decision === "allow" ? auditTags : [...auditTags, "forge.rollback.approval_required"]
    };
  }
}

class LiveRollbackProvider implements RollbackProvider {
  plan(): ForgeRollbackPlan {
    throw new Error("Live rollback is not implemented in this phase. Use mode 'dry-run'.");
  }
}

export function createRollbackProvider(config?: { mode?: "dry-run" | "live" }): RollbackProvider {
  const mode = config?.mode ?? "dry-run";
  if (mode === "live") return new LiveRollbackProvider();
  return new DryRunRollbackProvider();
}
