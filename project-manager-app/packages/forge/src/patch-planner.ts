import type { ForgeApprovalMode, ForgeRiskLevel, ForgeTaskPacket } from "./types.js";
import { matchesScope } from "./policy.js";

export type PatchOperation = "create" | "update" | "delete";

export type ProposedFileChange = {
  path: string;
  operation: PatchOperation;
  content?: string;
  diff?: string;
  reason?: string;
};

export type PatchPlanDecision = "allow" | "deny" | "require_approval";

export type PatchPlanChange = {
  proposed: ProposedFileChange;
  allowed: boolean;
  violations: string[];
};

export type ForgePatchPlan = {
  mode: PatchPlannerMode;
  decision: PatchPlanDecision;
  reason: string;
  riskLevel: ForgeRiskLevel;
  changes: PatchPlanChange[];
  requiredApprovals: ForgeApprovalMode[];
  violations: string[];
  auditTags: string[];
};

export interface PatchPlanner {
  plan(task: ForgeTaskPacket, proposedFiles: ProposedFileChange[]): ForgePatchPlan;
}

export type PatchPlannerMode = "dry-run" | "live";

const ABSOLUTE_OR_HOME = /^(?:\/|~)/;
const ENV_FILE = /(^|\/)\.env/;

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

function validateChange(change: ProposedFileChange, task: ForgeTaskPacket): PatchPlanChange {
  const violations: string[] = [];
  const path = change.path;

  if (!path) {
    violations.push("patch.empty_path");
  } else {
    if (path.includes("..")) violations.push("patch.parent_directory_reference");
    if (ABSOLUTE_OR_HOME.test(path)) violations.push("patch.absolute_or_home_path");
    if (ENV_FILE.test(path)) violations.push("patch.secret_file");
    if (task.targetBranch === "main" || task.targetBranch === "master") violations.push("patch.no_direct_default_branch");

    const allowedFiles = Array.isArray(task.allowedFiles) ? task.allowedFiles : [];
    const forbiddenFiles = Array.isArray(task.forbiddenFiles) ? task.forbiddenFiles : [];

    const taskAllows = allowedFiles.some((scope) => matchesScope(path, scope));
    const forbidden = forbiddenFiles.some((scope) => matchesScope(path, scope));

    if (!taskAllows) violations.push("patch.file_out_of_scope");
    if (forbidden) violations.push("patch.file_forbidden");

    if (!["create", "update", "delete"].includes(change.operation)) {
      violations.push("patch.invalid_operation");
    }

    if (change.operation === "delete") {
      violations.push("patch.delete_requires_approval");
    }

    if (isCriticalPath(path)) {
      violations.push("patch.critical_file");
    }
  }

  return { proposed: change, allowed: violations.length === 0, violations };
}

function computeDecision(
  allViolations: string[],
  riskLevel: ForgeRiskLevel
): PatchPlanDecision {
  const hasDenyViolation = allViolations.some(
    (v) =>
      v === "patch.empty_path" ||
      v === "patch.parent_directory_reference" ||
      v === "patch.absolute_or_home_path" ||
      v === "patch.secret_file" ||
      v === "patch.no_direct_default_branch" ||
      v === "patch.file_out_of_scope" ||
      v === "patch.file_forbidden" ||
      v === "patch.invalid_operation"
  );
  if (hasDenyViolation) return "deny";

  const hasApprovalViolation = allViolations.some(
    (v) => v === "patch.delete_requires_approval" || v === "patch.critical_file"
  );
  if (hasApprovalViolation || riskLevel === "critical") return "require_approval";

  return "allow";
}

class DryRunPatchPlanner implements PatchPlanner {
  plan(task: ForgeTaskPacket, proposedFiles: ProposedFileChange[]): ForgePatchPlan {
    const changes = (proposedFiles ?? []).map((change) => validateChange(change, task));
    const allViolations = changes.flatMap((change) => change.violations);
    const decision = computeDecision(allViolations, task.riskLevel);
    const requiredApprovals: ForgeApprovalMode[] = decision === "require_approval" ? ["ops_admin"] : [];

    const reason =
      decision === "allow"
        ? "Dry-run patch plan validation passed."
        : `Dry-run patch plan validation ${decision}: ${allViolations.join("; ")}`;

    return {
      mode: "dry-run",
      decision,
      reason,
      riskLevel: task.riskLevel,
      changes,
      requiredApprovals,
      violations: allViolations,
      auditTags: ["forge.patch.planned", `forge.agent.${task.requestedRole}`]
    };
  }
}

class LivePatchPlanner implements PatchPlanner {
  plan(): ForgePatchPlan {
    throw new Error("Live patch application is not implemented in this phase. Use mode 'dry-run'.");
  }
}

export function createPatchPlanner(config?: { mode?: PatchPlannerMode }): PatchPlanner {
  const mode = config?.mode ?? "dry-run";
  if (mode === "live") return new LivePatchPlanner();
  return new DryRunPatchPlanner();
}
