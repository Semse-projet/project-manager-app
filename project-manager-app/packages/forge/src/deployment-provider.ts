import type { ForgeApprovalMode, ForgeDeploymentPlan, ForgePolicyResult, ForgePRPackage, ForgeTaskPacket } from "./types.js";
import { matchesScope } from "./policy.js";

export type DeploymentProviderInput = {
  runId: string;
  task: ForgeTaskPacket;
  policy: ForgePolicyResult;
  prPackage?: ForgePRPackage;
};

export interface DeploymentProvider {
  plan(input: DeploymentProviderInput): ForgeDeploymentPlan;
}

const ALLOWED_ENVIRONMENTS = new Set(["sandbox", "local", "ci", "staging", "production"]);

const CRITICAL_PATTERNS = [
  "packages/db/prisma/schema.prisma",
  "packages/db/prisma/migrations/**",
  ".github/workflows/**",
  "**/railway.json",
  "**/Dockerfile*",
  "**/docker-compose*"
];

function isCriticalPath(path: string): boolean {
  return CRITICAL_PATTERNS.some((scope) => matchesScope(path, scope));
}

function hasCriticalFiles(changedFiles?: string[]): boolean {
  return (changedFiles ?? []).some(isCriticalPath);
}

class DryRunDeploymentProvider implements DeploymentProvider {
  plan({ runId, task, policy, prPackage }: DeploymentProviderInput): ForgeDeploymentPlan {
    const violations: string[] = [];
    const requiredApprovals = new Set<ForgeApprovalMode>(policy.requiredApprovals);
    const environment = task.environment;
    const targetBranch = task.targetBranch;

    if (policy.decision === "deny") {
      violations.push("deployment.policy.denied");
    }

    if (prPackage && prPackage.decision === "deny") {
      violations.push("deployment.pr_package.denied");
    }

    if (!ALLOWED_ENVIRONMENTS.has(environment)) {
      violations.push("deployment.invalid_environment");
    }

    if (environment === "production" && (task.riskLevel === "high" || task.riskLevel === "critical")) {
      violations.push("deployment.production_requires_approval");
      requiredApprovals.add("dual_control");
    }

    if (environment === "production" && targetBranch !== "main" && targetBranch !== "master") {
      violations.push("deployment.production_requires_default_branch");
    }

    const changedFiles = prPackage?.changedFiles ?? [];
    if (hasCriticalFiles(changedFiles)) {
      violations.push("deployment.critical_infrastructure_requires_approval");
      requiredApprovals.add("security");
    }

    const auditTags = [
      "forge.deployment.planned",
      `forge.run.${runId}`,
      `forge.agent.${task.requestedRole}`,
      `forge.environment.${environment}`
    ];

    const denyViolations = violations.filter((v) => !v.endsWith("_approval"));
    if (denyViolations.length > 0) {
      return {
        mode: "dry-run",
        decision: "deny",
        reason: `Deployment plan denied: ${denyViolations.join("; ")}`,
        environment,
        targetBranch,
        steps: [],
        requiredApprovals: [...new Set(requiredApprovals)],
        violations,
        auditTags: [...auditTags, "forge.deployment.denied"]
      };
    }

    const steps = [
      `build:${environment}`,
      `test:${environment}`,
      `deploy:${environment}`,
      `verify:${environment}`,
      `observe:${environment}`
    ];

    const approvals = [...new Set(requiredApprovals)];
    const hasApprovalViolation = violations.length > 0;
    const decision: ForgeDeploymentPlan["decision"] = approvals.length > 0 || hasApprovalViolation ? "require_approval" : "allow";

    return {
      mode: "dry-run",
      decision,
      reason: decision === "allow"
        ? `Dry-run deployment plan to ${environment} passed.`
        : `Dry-run deployment plan to ${environment} requires approval: ${approvals.join(", ")}`,
      environment,
      targetBranch,
      steps,
      requiredApprovals: approvals,
      violations,
      auditTags: decision === "allow" ? auditTags : [...auditTags, "forge.deployment.approval_required"]
    };
  }
}

class LiveDeploymentProvider implements DeploymentProvider {
  plan(): ForgeDeploymentPlan {
    throw new Error("Live deployment is not implemented in this phase. Use mode 'dry-run'.");
  }
}

export function createDeploymentProvider(config?: { mode?: "dry-run" | "live" }): DeploymentProvider {
  const mode = config?.mode ?? "dry-run";
  if (mode === "live") return new LiveDeploymentProvider();
  return new DryRunDeploymentProvider();
}
