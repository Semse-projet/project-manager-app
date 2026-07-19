import type { ForgeApprovalMode, ForgeObservationPlan, ForgePolicyResult, ForgeTaskPacket } from "./types.js";

export type ObservationProviderInput = {
  runId: string;
  task: ForgeTaskPacket;
  policy: ForgePolicyResult;
};

export interface ObservationProvider {
  plan(input: ObservationProviderInput): ForgeObservationPlan;
}

const ALLOWED_ENVIRONMENTS = new Set(["sandbox", "local", "ci", "staging", "production"]);

class DryRunObservationProvider implements ObservationProvider {
  plan({ runId, task, policy }: ObservationProviderInput): ForgeObservationPlan {
    const violations: string[] = [];
    const requiredApprovals = new Set<ForgeApprovalMode>(policy.requiredApprovals);
    const environment = task.environment;
    const targetBranch = task.targetBranch;

    if (policy.decision === "deny") {
      violations.push("observation.policy.denied");
    }

    if (!ALLOWED_ENVIRONMENTS.has(environment)) {
      violations.push("observation.invalid_environment");
    }

    if (environment === "production" || task.riskLevel === "critical") {
      violations.push("observation.production_or_critical_requires_approval");
      requiredApprovals.add("dual_control");
    } else if (task.riskLevel === "high") {
      violations.push("observation.high_risk_requires_approval");
      requiredApprovals.add("ops_admin");
    }

    const hasHealthChecks = (task.allowedCommands ?? []).length > 0 || (task.acceptanceCriteria ?? []).length > 0;
    if (!hasHealthChecks) {
      violations.push("observation.missing_health_checks");
      requiredApprovals.add("ops_admin");
    }

    const auditTags = [
      "forge.observation.planned",
      `forge.run.${runId}`,
      `forge.agent.${task.requestedRole}`,
      `forge.environment.${environment}`
    ];

    const denyViolations = violations.filter((v) => !v.endsWith("_approval") && !v.endsWith("_checks"));
    if (denyViolations.length > 0) {
      return {
        mode: "dry-run",
        decision: "deny",
        reason: `Observation plan denied: ${denyViolations.join("; ")}`,
        environment,
        targetBranch,
        steps: [
          "identify_incident",
          "assess_blast_radius",
          "restore_previous_release",
          "verify_health",
          "observe"
        ],
        requiredApprovals: [...new Set(requiredApprovals)],
        violations,
        auditTags: [...auditTags, "forge.observation.denied"]
      };
    }

    const steps = [
      "collect_metrics",
      "check_slo",
      "scan_incidents",
      "verify_health",
      "observe"
    ];

    const approvals = [...new Set(requiredApprovals)];
    const hasApprovalViolation = violations.length > 0;
    const decision: ForgeObservationPlan["decision"] = approvals.length > 0 || hasApprovalViolation ? "require_approval" : "allow";

    return {
      mode: "dry-run",
      decision,
      reason:
        decision === "allow"
          ? `Dry-run observation plan for ${environment} passed; no open incidents and SLO stable.`
          : `Dry-run observation plan for ${environment} requires approval: ${approvals.join(", ")}`,
      environment,
      targetBranch,
      steps,
      requiredApprovals: approvals,
      violations,
      auditTags: decision === "allow" ? auditTags : [...auditTags, "forge.observation.approval_required"]
    };
  }
}

class LiveObservationProvider implements ObservationProvider {
  plan(): ForgeObservationPlan {
    throw new Error("Live observation is not implemented in this phase. Use mode 'dry-run'.");
  }
}

export function createObservationProvider(config?: { mode?: "dry-run" | "live" }): ObservationProvider {
  const mode = config?.mode ?? "dry-run";
  if (mode === "live") return new LiveObservationProvider();
  return new DryRunObservationProvider();
}
