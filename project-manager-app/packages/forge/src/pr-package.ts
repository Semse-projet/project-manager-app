import { getForgeAgentManifest } from "./registry.js";
import { matchesScope } from "./policy.js";
import type { ForgePatchResult } from "./patch-writer.js";
import type { ForgeToolPlan } from "./tool-adapter.js";
import type {
  ForgeApprovalMode,
  ForgePolicyResult,
  ForgePRPackage,
  ForgeTaskPacket,
  ForgeVerificationMatrix
} from "./types.js";

export type PRPackageProviderInput = {
  runId: string;
  task: ForgeTaskPacket;
  policy: ForgePolicyResult;
  patchResult?: ForgePatchResult;
  verification?: ForgeVerificationMatrix;
  toolPlan?: ForgeToolPlan;
};

export interface PRPackageProvider {
  assemble(input: PRPackageProviderInput): ForgePRPackage;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function isDefaultBranch(branch: string | undefined): boolean {
  return typeof branch === "string" && (branch === "main" || branch === "master");
}

function isForbiddenFile(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesScope(path, pattern));
}

function inferTitle(task: ForgeTaskPacket): string {
  const prefix = task.requestedRole ? `[${task.requestedRole}]` : "[forge]";
  const subject = task.title || task.objective || "SEMSE Forge proposal";
  return `${prefix} ${subject}`;
}

function inferCommitMessage(task: ForgeTaskPacket): string {
  const subject = task.title || task.objective || "SEMSE Forge proposal";
  return `feat(${task.requestedRole}): ${subject}`;
}

function buildBody(input: PRPackageProviderInput, changedFiles: string[]): string {
  const { task, policy, verification, patchResult } = input;
  const verificationSummary = verification
    ? `Verification: ${verification.passed ? "passed" : "failed"} (${verification.items.length} criteria)`
    : "Verification: not provided";

  const patchSummary = patchResult
    ? `Patch simulation: ${patchResult.decision} (${patchResult.results.length} files)`
    : "Patch simulation: not provided";

  const checklist = [
    "- [ ] Spec reviewed and linked",
    "- [ ] Scope validated (no forbidden files)",
    "- [ ] Sandbox plan reviewed",
    "- [ ] Patch plan reviewed",
    "- [ ] Tool plan reviewed",
    "- [ ] Verification passed",
    "- [ ] Approval required before merge"
  ].join("\n");

  const approvals = policy.requiredApprovals.length > 0
    ? `Required approvals: ${policy.requiredApprovals.join(", ")}`
    : "No additional approvals required.";

  return [
    `## Spec reference`,
    `- **Spec:** ${task.spec.path} (${task.spec.id})`,
    `- **Status:** ${task.spec.status}`,
    `- **Digest:** ${task.spec.digest}`,
    "",
    `## Objective`,
    task.objective || "No objective provided.",
    "",
    `## Risk level`,
    task.riskLevel,
    "",
    `## Verification summary`,
    verificationSummary,
    "",
    `## Patch summary`,
    patchSummary,
    "",
    `## Changed files`,
    changedFiles.length > 0 ? changedFiles.map((file) => `- ${file}`).join("\n") : "No file changes.",
    "",
    `## Approvals`,
    approvals,
    "",
    `## Checklist`,
    checklist
  ].join("\n");
}

function buildChecklist(task: ForgeTaskPacket, changedFiles: string[]): string[] {
  return [
    `Spec ${task.spec.id} reviewed and approved`,
    "Scope validated (no forbidden files)",
    "Sandbox plan reviewed",
    "Patch plan reviewed",
    "Tool plan reviewed",
    "Verification passed",
    changedFiles.length > 0 ? `Changed files reviewed (${changedFiles.length})` : "No file changes",
    "Approval required before merge"
  ];
}

function deriveReviewers(task: ForgeTaskPacket): string[] {
  const manifest = getForgeAgentManifest(task.requestedRole);
  const reviewers: string[] = [];
  if (manifest?.owner) reviewers.push(manifest.owner);
  if (task.riskLevel === "high" || task.riskLevel === "critical") {
    reviewers.push("ops_admin");
  }
  return unique(reviewers);
}

class DryRunPRPackageProvider implements PRPackageProvider {
  assemble(input: PRPackageProviderInput): ForgePRPackage {
    const { runId, task, policy, patchResult, verification } = input;
    const violations: string[] = [];

    if (policy.decision === "deny") {
      violations.push("pr.policy.denied");
    }

    if (!patchResult) {
      violations.push("pr.patch.missing");
    } else if (patchResult.decision === "deny") {
      violations.push("pr.patch.denied");
    }

    if (!verification) {
      violations.push("pr.verification.missing");
    } else if (!verification.passed) {
      violations.push("pr.verification.failed");
    }

    if (isDefaultBranch(task.targetBranch)) {
      violations.push("pr.target_branch.is_default");
    }

    const changedFiles = patchResult?.results
      .filter((result) => result.applied)
      .map((result) => result.path) ?? [];

    const forbiddenViolations = changedFiles
      .filter((path) => isForbiddenFile(path, task.forbiddenFiles))
      .map((path) => `pr.file.forbidden:${path}`);
    violations.push(...forbiddenViolations);

    if (violations.length > 0) {
      return {
        mode: "dry-run",
        decision: "deny",
        reason: `Cannot assemble PR package: ${violations.join("; ")}`,
        title: inferTitle(task),
        body: "",
        baseBranch: "main",
        headBranch: task.targetBranch,
        commits: [],
        changedFiles,
        reviewers: [],
        labels: [],
        draft: true,
        checklist: [],
        requiredApprovals: [],
        violations,
        auditTags: ["forge.pr.denied"]
      };
    }

    const baseBranch = typeof task.metadata?.baseBranch === "string" ? task.metadata.baseBranch : "main";
    const reviewers = deriveReviewers(task);
    const labels = unique(["forge", task.requestedRole, task.riskLevel]);
    const draft = task.riskLevel === "high" || task.riskLevel === "critical";
    const title = inferTitle(task);
    const body = buildBody(input, changedFiles);
    const checklist = buildChecklist(task, changedFiles);
    const commitMessage = inferCommitMessage(task);

    const decision: ForgePRPackage["decision"] = policy.decision === "require_approval" ? "require_approval" : "allow";
    const reason = decision === "allow"
      ? "Dry-run PR package assembled and ready for review."
      : `Dry-run PR package assembled but requires approvals: ${policy.requiredApprovals.join("; ")}.`;

    return {
      mode: "dry-run",
      decision,
      reason,
      title,
      body,
      baseBranch,
      headBranch: task.targetBranch,
      commits: [
        {
          message: commitMessage,
          files: changedFiles,
          body: `Automated proposal for ${task.spec.id} (run: ${runId})`
        }
      ],
      changedFiles,
      reviewers,
      labels,
      draft,
      checklist,
      requiredApprovals: policy.requiredApprovals,
      violations: [],
      auditTags: ["forge.pr.ready", "forge.pr.assembled"]
    };
  }
}

class LivePRPackageProvider implements PRPackageProvider {
  assemble(): ForgePRPackage {
    throw new Error("Live PR creation is not implemented in this phase. Use mode 'dry-run'.");
  }
}

export function createPRPackageProvider(config?: { mode?: "dry-run" | "live" }): PRPackageProvider {
  const mode = config?.mode ?? "dry-run";
  if (mode === "live") return new LivePRPackageProvider();
  return new DryRunPRPackageProvider();
}
