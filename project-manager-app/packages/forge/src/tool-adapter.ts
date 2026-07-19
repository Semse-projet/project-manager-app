import type { ForgeApprovalMode, ForgeRiskLevel, ForgeTaskPacket, ForgeToolName } from "./types.js";
import { getForgeAgentManifest } from "./registry.js";

export type ToolPlanDecision = "allow" | "deny" | "require_approval";

export type ToolPlanEntry = {
  name: ForgeToolName;
  allowed: boolean;
  violations: string[];
};

export type ForgeToolPlan = {
  mode: "dry-run" | "live";
  decision: ToolPlanDecision;
  reason: string;
  action: string;
  riskLevel: ForgeRiskLevel;
  tools: ToolPlanEntry[];
  requiredApprovals: ForgeApprovalMode[];
  violations: string[];
  auditTags: string[];
};

export interface ToolAdapter {
  plan(input: { task: ForgeTaskPacket; action: string }): ForgeToolPlan;
}

const ACTION_TO_TOOLS: Record<string, ForgeToolName[]> = {
  "runtime.execute": [],

  "run.coordinate": ["repo.read", "task.plan", "approval.request", "audit.record"],
  "task.assign": ["repo.read", "task.plan", "audit.record"],
  "review.request": ["repo.read", "approval.request", "audit.record"],
  "pr.prepare": ["repo.read", "repo.search", "pr.prepare", "audit.record"],

  "spec.draft": ["repo.read", "repo.search", "spec.read", "spec.write", "audit.record"],
  "spec.refine": ["repo.read", "repo.search", "spec.read", "spec.write", "audit.record"],
  "acceptance.define": ["repo.read", "spec.read", "spec.write", "audit.record"],
  "dependency.map": ["repo.read", "repo.search", "spec.read", "task.plan", "audit.record"],

  "domain.map": ["repo.read", "repo.search", "spec.read", "schema.propose", "audit.record"],
  "contract.propose": ["repo.read", "spec.read", "schema.propose", "audit.record"],
  "event.map": ["repo.read", "spec.read", "audit.record"],
  "schema.propose": ["repo.read", "spec.read", "schema.propose", "audit.record"],
  "migration.propose": ["repo.read", "spec.read", "schema.propose", "migration.propose", "test.write", "audit.record"],
  "data.contract": ["repo.read", "spec.read", "schema.propose", "audit.record"],
  "rollback.plan": ["repo.read", "spec.read", "migration.propose", "audit.record"],

  "creator.interview": ["spec.read", "spec.write", "task.plan", "audit.record"],
  "blueprint.create": ["repo.read", "spec.read", "spec.write", "task.plan", "audit.record"],
  "curriculum.structure": ["repo.read", "spec.read", "spec.write", "task.plan", "audit.record"],
  "publication.propose": ["repo.read", "spec.read", "marketplace.publish.propose", "approval.request", "audit.record"],

  "marketplace.publish.propose": ["repo.read", "spec.read", "marketplace.publish.propose", "approval.request", "audit.record"],

  "code.implement": ["repo.read", "repo.search", "spec.read", "code.write", "test.write", "command.run", "audit.record"],
  "test.implement": ["repo.read", "spec.read", "code.write", "test.write", "command.run", "audit.record"],
  "api.contract.implement": ["repo.read", "spec.read", "code.write", "test.write", "command.run", "audit.record"],
  "ui.implement": ["repo.read", "spec.read", "code.write", "test.write", "command.run", "audit.record"],
  "ux.flow": ["repo.read", "spec.read", "audit.record"],
  "ui.compose": ["repo.read", "spec.read", "code.write", "test.write", "command.run", "audit.record"],
  "accessibility.verify": ["repo.read", "command.run", "audit.record"],

  "connector.implement": ["repo.read", "spec.read", "code.write", "test.write", "command.run", "audit.record"],
  "contract.verify": ["repo.read", "spec.read", "command.run", "audit.record"],
  "webhook.verify": ["repo.read", "spec.read", "command.run", "audit.record"],

  "verify.typecheck": ["repo.read", "command.run", "audit.record"],
  "verify.lint": ["repo.read", "command.run", "audit.record"],
  "verify.test": ["repo.read", "command.run", "test.write", "audit.record"],
  "verify.build": ["repo.read", "command.run", "audit.record"],
  "verify.acceptance": ["repo.read", "command.run", "audit.record"],

  "security.review": ["repo.read", "repo.search", "command.run", "audit.record"],
  "threat.model": ["repo.read", "repo.search", "spec.read", "audit.record"],
  "dependency.audit": ["repo.read", "command.run", "audit.record"],

  "ci.implement": ["repo.read", "spec.read", "code.write", "command.run", "audit.record"],
  "deployment.propose": ["repo.read", "spec.read", "deployment.propose", "approval.request", "audit.record"],
  "rollback.prepare": ["repo.read", "spec.read", "deployment.propose", "approval.request", "audit.record"],

  "docs.update": ["repo.read", "spec.read", "spec.write", "audit.record"],
  "changelog.update": ["repo.read", "spec.read", "spec.write", "audit.record"],
  "runbook.update": ["repo.read", "spec.read", "spec.write", "audit.record"],
  "traceability.update": ["repo.read", "spec.read", "spec.write", "audit.record"],

  "governance.review": ["repo.read", "repo.search", "spec.read", "audit.record"],
  "authority.verify": ["repo.read", "spec.read", "audit.record"],
  "audit.verify": ["repo.read", "repo.search", "audit.record"],

  "approval.request": ["approval.request", "audit.record"]
};

const CRITICAL_ACTIONS = new Set([
  "deployment.propose",
  "migration.propose",
  "schema.propose",
  "data.contract",
  "rollback.plan",
  "rollback.prepare",
  "publication.propose",
  "marketplace.publish.propose",
  "security.review",
  "approval.request",
  "run.coordinate"
]);

class DryRunToolAdapter implements ToolAdapter {
  plan({ task, action }: { task: ForgeTaskPacket; action: string }): ForgeToolPlan {
    const manifest = getForgeAgentManifest(task.requestedRole);
    const allowedTools = new Set(manifest.allowedTools);

    if (action === "runtime.execute") {
      return {
        mode: "dry-run",
        decision: "allow",
        reason: "runtime.execute has no fixed tool mapping in dry-run; commands are validated by sandbox.",
        action,
        riskLevel: task.riskLevel,
        tools: [],
        requiredApprovals: [],
        violations: [],
        auditTags: ["forge.tools.planned", `forge.agent.${task.requestedRole}`]
      };
    }

    const requiredTools = ACTION_TO_TOOLS[action];
    if (!requiredTools) {
      return {
        mode: "dry-run",
        decision: "deny",
        reason: `Action '${action}' is not mapped to any known tool set.`,
        action,
        riskLevel: task.riskLevel,
        tools: [],
        requiredApprovals: [],
        violations: ["tool.action.unknown"],
        auditTags: ["forge.tools.denied", `forge.agent.${task.requestedRole}`]
      };
    }

    const tools: ToolPlanEntry[] = requiredTools.map((name) => {
      const allowed = allowedTools.has(name);
      return {
        name,
        allowed,
        violations: allowed ? [] : [`tool.${name.replace(/\./g, "_")}.not_allowed`]
      };
    });

    const missingTools = tools.filter((t) => !t.allowed).map((t) => t.name);
    const allViolations = tools.flatMap((t) => t.violations);

    if (missingTools.length > 0) {
      return {
        mode: "dry-run",
        decision: "deny",
        reason: `Action '${action}' requires tools not in manifest: ${missingTools.join(", ")}`,
        action,
        riskLevel: task.riskLevel,
        tools,
        requiredApprovals: [],
        violations: [...allViolations, "tool.missing_tools"],
        auditTags: ["forge.tools.denied", `forge.agent.${task.requestedRole}`]
      };
    }

    const isCritical = CRITICAL_ACTIONS.has(action) || task.riskLevel === "critical";
    if (isCritical) {
      return {
        mode: "dry-run",
        decision: "require_approval",
        reason: `Action '${action}' is critical or risk level is '${task.riskLevel}'; approval required.`,
        action,
        riskLevel: task.riskLevel,
        tools,
        requiredApprovals: [manifest.approvalMode === "none" ? "ops_admin" : manifest.approvalMode],
        violations: [],
        auditTags: ["forge.tools.approval_required", `forge.agent.${task.requestedRole}`]
      };
    }

    return {
      mode: "dry-run",
      decision: "allow",
      reason: `Action '${action}' maps to allowed tools for '${task.requestedRole}'.`,
      action,
      riskLevel: task.riskLevel,
      tools,
      requiredApprovals: [],
      violations: [],
      auditTags: ["forge.tools.planned", `forge.agent.${task.requestedRole}`]
    };
  }
}

class LiveToolAdapter implements ToolAdapter {
  plan(): ForgeToolPlan {
    throw new Error("Live tool invocation is not implemented in this phase. Use mode 'dry-run'.");
  }
}

export function createToolAdapter(config?: { mode?: "dry-run" | "live" }): ToolAdapter {
  const mode = config?.mode ?? "dry-run";
  if (mode === "live") return new LiveToolAdapter();
  return new DryRunToolAdapter();
}
