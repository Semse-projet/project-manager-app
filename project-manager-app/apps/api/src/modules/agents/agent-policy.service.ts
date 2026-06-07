import { Injectable } from "@nestjs/common";
import type { CopilotProposedPlan } from "./plan-mode.types.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high";

export type PolicyResult =
  | { allowed: true }
  | { allowed: false; reason: string; requiresPlan: boolean };

// ── Rules ─────────────────────────────────────────────────────────────────────

// Actions that ALWAYS require an approved plan before execution
const PLAN_REQUIRED_ACTIONS = new Set([
  "PROPOSE_ESCROW_RELEASE",
  "PROPOSE_DISPUTE_OPEN",
]);

// Actions that require a plan when riskLevel is high
const PLAN_REQUIRED_IF_HIGH = new Set([
  "PROPOSE_MILESTONE_APPROVAL",
  "PROPOSE_DISPUTE_RESOLVE",
]);

// Actions always allowed without a plan
const ALWAYS_ALLOWED = new Set([
  "REQUEST_MISSING_EVIDENCE",
  "DRAFT_MESSAGE",
  "ASSESS_RISK",
]);

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class AgentPolicyService {
  /**
   * Check whether an action is allowed given the current active plan.
   * Pure logic — no I/O.
   */
  checkActionAllowed(input: {
    actionType: string;
    riskLevel?: RiskLevel;
    activePlan: CopilotProposedPlan | null;
  }): PolicyResult {
    const { actionType, riskLevel = "medium", activePlan } = input;
    const type = actionType.toUpperCase();

    if (ALWAYS_ALLOWED.has(type)) {
      return { allowed: true };
    }

    const planApproved = activePlan?.status === "approved" || activePlan?.status === "executing";
    const planExists = activePlan !== null;

    if (PLAN_REQUIRED_ACTIONS.has(type)) {
      if (!planApproved) {
        return {
          allowed: false,
          reason: planExists
            ? `La acción '${actionType}' requiere un plan aprobado. El plan actual está en estado '${activePlan!.status}' — pide al usuario que lo apruebe primero.`
            : `La acción '${actionType}' requiere un plan formal aprobado. Propone un plan usando 'propose_plan' antes de ejecutar esta acción.`,
          requiresPlan: true,
        };
      }
      return { allowed: true };
    }

    if (PLAN_REQUIRED_IF_HIGH.has(type) && riskLevel === "high") {
      if (!planApproved) {
        return {
          allowed: false,
          reason: planExists
            ? `La acción '${actionType}' de alto riesgo requiere plan aprobado. Estado actual: '${activePlan!.status}'.`
            : `La acción '${actionType}' es de alto riesgo. Propone un plan antes de proceder.`,
          requiresPlan: true,
        };
      }
    }

    if (riskLevel === "high" && !planApproved) {
      return {
        allowed: false,
        reason: `Acción de alto riesgo '${actionType}' bloqueada sin plan aprobado. Crea y aprueba un plan primero.`,
        requiresPlan: true,
      };
    }

    return { allowed: true };
  }

  /**
   * Filter a list of proposed actions by policy.
   * Returns allowed actions and a list of blocked reasons.
   */
  filterActions(input: {
    actions: Array<{ id?: string; type: string; riskLevel?: string; summary: string }>;
    activePlan: CopilotProposedPlan | null;
  }): {
    allowed: typeof input.actions;
    blocked: Array<{ actionType: string; summary: string; reason: string }>;
  } {
    const allowed: typeof input.actions = [];
    const blocked: Array<{ actionType: string; summary: string; reason: string }> = [];

    for (const action of input.actions) {
      const result = this.checkActionAllowed({
        actionType: action.type,
        riskLevel: (action.riskLevel ?? "medium") as RiskLevel,
        activePlan: input.activePlan,
      });

      if (result.allowed) {
        allowed.push(action);
      } else {
        blocked.push({ actionType: action.type, summary: action.summary, reason: result.reason });
      }
    }

    return { allowed, blocked };
  }
}
