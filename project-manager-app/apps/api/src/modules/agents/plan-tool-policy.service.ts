import { Injectable } from "@nestjs/common";
import type { PlanStepCapability } from "./plan-mode.types.js";

type StepLike = {
  capability: PlanStepCapability;
  toolsAllowed: string[];
  requiresApprovedPlan: boolean;
  requiredEvidence?: string[];
  evidenceStatus?: "missing" | "partial" | "satisfied";
  riskLevel: "low" | "medium" | "high";
  status: string;
};

export type ToolPolicyDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

const CAPABILITY_TOOL_MAP: Record<PlanStepCapability, string[]> = {
  dispute: ["propose_dispute_open", "request_missing_evidence", "draft_dispute_message"],
  searching: ["search_patterns", "read_file", "list_directory"],
  perambulating: ["explore_project", "inspect_structure", "summarize_findings"],
  composing: ["draft_message", "compose_response", "summarize_plan"],
  clouding: ["call_llm_provider", "route_provider", "fallback_provider"],
  shelling: ["run_command", "run_build", "run_typecheck"],
  editing: ["edit_file", "apply_patch"],
  testing: ["run_tests", "inspect_test_failure"],
  waiting: ["wait_background_terminal", "read_background_result"],
  worker: ["enqueue_worker_job", "inspect_worker_status", "propose_milestone_approval", "propose_escrow_release", "propose_dispute_resolve"],
  delegating: ["delegate_task", "request_agent_help", "transfer_control"],
};

function isCapability(value: unknown): value is PlanStepCapability {
  return value === "dispute" ||
    value === "searching" ||
    value === "perambulating" ||
    value === "composing" ||
    value === "clouding" ||
    value === "shelling" ||
    value === "editing" ||
    value === "testing" ||
    value === "waiting" ||
    value === "worker" ||
    value === "delegating";
}

export function normalizePlanToolName(toolName: string): string {
  return toolName.trim().toLowerCase();
}

export function getCapabilityTools(capability: PlanStepCapability): string[] {
  return [...CAPABILITY_TOOL_MAP[capability]];
}

export function inferPlanStepCapability(input: {
  capability?: unknown;
  actionType?: unknown;
  title?: unknown;
  toolsAllowed?: unknown;
  riskLevel?: unknown;
}): PlanStepCapability {
  if (isCapability(input.capability)) return input.capability;

  const actionType = typeof input.actionType === "string" ? normalizePlanToolName(input.actionType) : "";
  const title = typeof input.title === "string" ? input.title.toLowerCase() : "";
  const tools = Array.isArray(input.toolsAllowed)
    ? input.toolsAllowed.filter((tool): tool is string => typeof tool === "string").map(normalizePlanToolName)
    : [];

  if (actionType.includes("dispute") || tools.some((tool) => CAPABILITY_TOOL_MAP.dispute.includes(tool))) return "dispute";
  if (actionType.includes("escrow") || actionType.includes("milestone") || tools.some((tool) => CAPABILITY_TOOL_MAP.worker.includes(tool))) return "worker";
  if (title.includes("buscar") || title.includes("search") || title.includes("leer") || title.includes("archivo")) return "searching";
  if (title.includes("recorrer") || title.includes("explorar") || title.includes("mapa") || title.includes("contexto")) return "perambulating";
  if (title.includes("mensaje") || title.includes("redact") || title.includes("compose")) return "composing";
  if (title.includes("shell") || title.includes("build") || title.includes("command")) return "shelling";
  if (title.includes("edit") || title.includes("patch")) return "editing";
  if (title.includes("test")) return "testing";
  if (title.includes("wait") || title.includes("esper")) return "waiting";
  if (title.includes("worker") || title.includes("cola")) return "worker";
  if (title.includes("deleg") || title.includes("ayuda") || title.includes("transfer")) return "delegating";

  return input.riskLevel === "high" ? "worker" : "searching";
}

export function inferToolsAllowed(input: {
  capability: PlanStepCapability;
  toolsAllowed?: unknown;
  actionType?: unknown;
}): string[] {
  const explicit = Array.isArray(input.toolsAllowed)
    ? input.toolsAllowed
        .filter((tool): tool is string => typeof tool === "string")
        .map(normalizePlanToolName)
    : [];
  const boundAction = typeof input.actionType === "string" && input.actionType.trim().length > 0
    ? [normalizePlanToolName(input.actionType)]
    : [];

  return Array.from(new Set([...getCapabilityTools(input.capability), ...boundAction, ...explicit]));
}

export function defaultRequiresApprovedPlan(input: {
  capability: PlanStepCapability;
  riskLevel: "low" | "medium" | "high";
  explicit?: unknown;
}): boolean {
  if (typeof input.explicit === "boolean") return input.explicit;
  if (input.capability === "dispute" || input.capability === "worker") return true;
  return input.riskLevel === "high";
}

@Injectable()
export class PlanToolPolicyService {
  canCapabilityUseTool(capability: PlanStepCapability, toolName: string): boolean {
    return getCapabilityTools(capability).includes(normalizePlanToolName(toolName));
  }

  validateToolExecution(input: {
    step: StepLike;
    toolName: string;
    planApproved: boolean;
  }): ToolPolicyDecision {
    const toolName = normalizePlanToolName(input.toolName);
    const allowedTools = input.step.toolsAllowed.map(normalizePlanToolName);

    if (!allowedTools.includes(toolName)) {
      return {
        allowed: false,
        reason: `La tool '${toolName}' no está permitida para capability '${input.step.capability}'.`,
      };
    }

    if (input.step.status === "completed" || input.step.status === "skipped" || input.step.status === "blocked" || input.step.status === "failed") {
      return {
        allowed: false,
        reason: `La tool '${toolName}' no puede correr porque el step está '${input.step.status}'.`,
      };
    }

    if (input.step.requiresApprovedPlan && !input.planApproved) {
      return {
        allowed: false,
        reason: `La capability '${input.step.capability}' requiere plan aprobado antes de usar '${toolName}'.`,
      };
    }

    if (
      (input.step.capability === "editing" || input.step.capability === "shelling" || input.step.capability === "testing" || input.step.capability === "worker" || input.step.capability === "dispute" || input.step.capability === "delegating") &&
      input.step.status !== "ready" &&
      input.step.status !== "executing"
    ) {
      return {
        allowed: false,
        reason: `La capability '${input.step.capability}' exige step ready/executing. Estado actual: '${input.step.status}'.`,
      };
    }

    if (input.step.riskLevel === "high" && !input.planApproved) {
      return {
        allowed: false,
        reason: `Tool '${toolName}' bloqueada: paso high-risk sin plan aprobado.`,
      };
    }

    if (
      (input.step.requiredEvidence?.length ?? 0) > 0 &&
      input.step.evidenceStatus !== "satisfied" &&
      input.step.capability !== "waiting"
    ) {
      return {
        allowed: false,
        reason: `Tool '${toolName}' bloqueada por evidencia incompleta para el paso.`,
      };
    }

    return { allowed: true };
  }
}
