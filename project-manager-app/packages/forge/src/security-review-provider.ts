import type { ForgeApprovalMode, ForgePolicyResult, ForgeSecurityFinding, ForgeSecurityReport, ForgeTaskPacket } from "./types.js";
import type { ForgePatchPlan } from "./patch-planner.js";
import { matchesScope } from "./policy.js";

export type SecurityReviewProviderInput = {
  runId: string;
  task: ForgeTaskPacket;
  policy: ForgePolicyResult;
  patchPlan?: ForgePatchPlan;
};

export interface SecurityReviewProvider {
  review(input: SecurityReviewProviderInput): ForgeSecurityReport;
}

const FORBIDDEN_PATTERNS = [
  ".env*",
  "**/*.key",
  "**/*.pem",
  "**/*.p12",
  "**/credentials*",
  "**/secrets*"
];

const SEVERITY_ORDER: Record<ForgeSecurityFinding["severity"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const SENSITIVE_PATTERNS: Array<{ rule: string; severity: ForgeSecurityFinding["severity"]; scope: string; message: string }> = [
  {
    rule: "security.env_file",
    severity: "high",
    scope: "**/.env*",
    message: "Environment files detected in scope; may contain secrets."
  },
  {
    rule: "security.credential_file",
    severity: "critical",
    scope: "**/*.key",
    message: "Credential material detected in scope."
  },
  {
    rule: "security.credential_file",
    severity: "critical",
    scope: "**/*.pem",
    message: "Credential material detected in scope."
  },
  {
    rule: "security.credential_file",
    severity: "critical",
    scope: "**/*.p12",
    message: "Credential material detected in scope."
  },
  {
    rule: "security.database_schema",
    severity: "high",
    scope: "packages/db/prisma/**",
    message: "Database schema or migration changes require data governance review."
  },
  {
    rule: "security.ci_workflow",
    severity: "medium",
    scope: ".github/workflows/**",
    message: "CI workflow changes can affect supply chain and deployment pipeline."
  },
  {
    rule: "security.infrastructure",
    severity: "high",
    scope: "**/railway.json",
    message: "Infrastructure configuration changes detected."
  },
  {
    rule: "security.infrastructure",
    severity: "high",
    scope: "**/Dockerfile*",
    message: "Container build changes detected."
  },
  {
    rule: "security.infrastructure",
    severity: "high",
    scope: "**/docker-compose*",
    message: "Container orchestration changes detected."
  },
  {
    rule: "security.auth_module",
    severity: "critical",
    scope: "packages/auth/**",
    message: "Authentication module changes require security review."
  },
  {
    rule: "security.agent_runtime",
    severity: "high",
    scope: "packages/agents/**",
    message: "Agent runtime changes can affect governed execution."
  },
  {
    rule: "security.payment_or_identity",
    severity: "critical",
    scope: "packages/payments/**",
    message: "Payment module changes require security and compliance review."
  },
  {
    rule: "security.payment_or_identity",
    severity: "critical",
    scope: "**/identity*",
    message: "Identity-related changes require security review."
  }
];

function collectPaths(task: ForgeTaskPacket, patchPlan?: ForgePatchPlan): string[] {
  const paths = new Set<string>();
  for (const scope of task.allowedFiles) {
    paths.add(scope);
  }
  if (patchPlan) {
    for (const change of patchPlan.changes) {
      paths.add(change.proposed.path);
    }
  }
  return [...paths];
}

function isForbidden(path: string): boolean {
  return FORBIDDEN_PATTERNS.some((scope) => matchesScope(path, scope));
}

function findFindings(paths: string[]): ForgeSecurityFinding[] {
  const findings: ForgeSecurityFinding[] = [];
  const seen = new Set<string>();

  for (const path of paths) {
    for (const pattern of SENSITIVE_PATTERNS) {
      if (matchesScope(path, pattern.scope) && !seen.has(`${path}:${pattern.rule}`)) {
        seen.add(`${path}:${pattern.rule}`);
        findings.push({
          id: `${pattern.rule}:${path}`,
          rule: pattern.rule,
          severity: pattern.severity,
          path,
          message: pattern.message
        });
      }
    }
  }

  return findings;
}

class DryRunSecurityReviewProvider implements SecurityReviewProvider {
  review({ runId, task, policy, patchPlan }: SecurityReviewProviderInput): ForgeSecurityReport {
    const violations: string[] = [];
    const requiredApprovals = new Set<ForgeApprovalMode>(policy.requiredApprovals);
    const paths = collectPaths(task, patchPlan);

    if (policy.decision === "deny") {
      violations.push("security.policy.denied");
    }

    const forbiddenPaths = paths.filter(isForbidden);
    if (forbiddenPaths.length > 0) {
      violations.push("security.forbidden_file");
      forbiddenPaths.forEach((path) => violations.push(`security.forbidden_file:${path}`));
    }

    const findings = findFindings(paths).sort(
      (a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]
    );

    const hasCriticalFinding = findings.some((f) => f.severity === "critical");
    const hasHighFinding = findings.some((f) => f.severity === "high");
    const hasMediumFinding = findings.some((f) => f.severity === "medium");
    const hasLowFinding = findings.some((f) => f.severity === "low");

    if (task.riskLevel === "critical" || hasCriticalFinding) {
      violations.push("security.critical_risk_or_finding");
      requiredApprovals.add("dual_control");
    }

    if (task.riskLevel === "high" || hasHighFinding) {
      violations.push("security.high_risk_or_finding");
      requiredApprovals.add("security");
      requiredApprovals.add("ops_admin");
    }

    if (hasMediumFinding || hasLowFinding) {
      violations.push("security.medium_or_low_finding");
      requiredApprovals.add("security");
    }

    const auditTags = [
      "forge.security.reviewed",
      `forge.run.${runId}`,
      `forge.agent.${task.requestedRole}`,
      `forge.risk.${task.riskLevel}`
    ];

    if (forbiddenPaths.length > 0 || policy.decision === "deny") {
      return {
        mode: "dry-run",
        decision: "deny",
        reason: `Security review denied: ${violations.filter((v) => !v.startsWith("security.forbidden_file:")).join("; ")}`,
        findings,
        requiredApprovals: [...new Set(requiredApprovals)],
        violations,
        auditTags: [...auditTags, "forge.security.denied"]
      };
    }

    const approvals = [...new Set(requiredApprovals)];
    const hasApprovalViolation = findings.length > 0 || task.riskLevel === "high" || task.riskLevel === "critical";
    const decision: ForgeSecurityReport["decision"] = approvals.length > 0 || hasApprovalViolation ? "require_approval" : "allow";

    return {
      mode: "dry-run",
      decision,
      reason:
        decision === "allow"
          ? "Dry-run security review passed with no sensitive patterns."
          : `Dry-run security review requires approval: ${approvals.join(", ")}`,
      findings,
      requiredApprovals: approvals,
      violations,
      auditTags: decision === "allow" ? auditTags : [...auditTags, "forge.security.approval_required"]
    };
  }
}

class LiveSecurityReviewProvider implements SecurityReviewProvider {
  review(): ForgeSecurityReport {
    throw new Error("Live security review is not implemented in this phase. Use mode 'dry-run'.");
  }
}

export function createSecurityReviewProvider(config?: { mode?: "dry-run" | "live" }): SecurityReviewProvider {
  const mode = config?.mode ?? "dry-run";
  if (mode === "live") return new LiveSecurityReviewProvider();
  return new DryRunSecurityReviewProvider();
}
