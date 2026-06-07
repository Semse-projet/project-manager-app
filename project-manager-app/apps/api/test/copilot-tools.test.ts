import test from "node:test";
import assert from "node:assert/strict";
import { toolCallToProposedPlan, toolCallsToActions } from "../dist/modules/agents/harnesses/copilot-tools.js";

const milestoneCall = {
  toolName: "propose_milestone_approval",
  toolUseId: "toolu_01",
  input: { milestoneId: "ms_123", milestoneName: "Demolición", rationale: "Evidencia completa" },
};

const escrowCall = {
  toolName: "propose_escrow_release",
  toolUseId: "toolu_02",
  input: { amount: 3000, rationale: "Todos los hitos aprobados" },
};

const evidenceCall = {
  toolName: "request_missing_evidence",
  toolUseId: "toolu_03",
  input: { description: "Foto del trabajo terminado", milestoneId: "ms_123" },
};

const planCall = {
  toolName: "propose_plan",
  toolUseId: "toolu_04",
  input: {
    title: "Plan de cierre de milestone y escrow",
    goal: "Validar evidencia y ejecutar el release con control humano.",
    rationale: "Hay evidencia suficiente para avanzar, pero el release es una acción sensible.",
    risks: ["Liberar fondos sin evidencia final", "Falta de trazabilidad en aprobación"],
    requiredEvidence: ["Fotos finales", "Aceptación del cliente"],
    successCriteria: ["Milestone aprobado", "Escrow listo para release"],
    steps: [
      {
        id: "step_review",
        title: "Revisar evidencia",
        description: "Verificar fotos y entregables del milestone.",
        expectedOutcome: "Evidencia confirmada o brechas detectadas.",
        actionType: "PROPOSE_MILESTONE_APPROVAL",
        requiredEvidence: ["Fotos finales"],
        riskLevel: "medium",
        requiresApproval: false,
      },
      {
        id: "step_release",
        title: "Solicitar aprobación humana",
        description: "Presentar el plan y esperar confirmación.",
        expectedOutcome: "Plan aprobado antes del release.",
        actionType: "PROPOSE_ESCROW_RELEASE",
        dependsOnStepIds: ["step_review"],
        riskLevel: "high",
        requiresApproval: true,
      },
    ],
  },
};

test("toolCallsToActions produces correct AgentAction for milestone approval", () => {
  const [action] = toolCallsToActions([milestoneCall]);
  assert.equal(action.type, "PROPOSE_MILESTONE_APPROVAL");
  assert.equal(action.domain, "milestones");
  assert.equal(action.approvalMode, "required");
  assert.equal(action.riskLevel, "high");
  assert.ok(action.summary.includes("Demolición"));
  assert.equal(action.rationale, "Evidencia completa");
  assert.ok(action.id.length > 0);
});

test("toolCallsToActions produces correct AgentAction for escrow release", () => {
  const [action] = toolCallsToActions([escrowCall]);
  assert.equal(action.type, "PROPOSE_ESCROW_RELEASE");
  assert.equal(action.domain, "escrow");
  assert.equal(action.approvalMode, "required");
  assert.ok(action.summary.includes("3,000"));
});

test("toolCallsToActions produces recommended approval for evidence request", () => {
  const [action] = toolCallsToActions([evidenceCall]);
  assert.equal(action.type, "REQUEST_MISSING_EVIDENCE");
  assert.equal(action.approvalMode, "recommended");
  assert.equal(action.riskLevel, "low");
});

test("toolCallsToActions handles multiple calls in order", () => {
  const actions = toolCallsToActions([milestoneCall, escrowCall, evidenceCall]);
  assert.equal(actions.length, 3);
  assert.equal(actions[0]?.type, "PROPOSE_MILESTONE_APPROVAL");
  assert.equal(actions[1]?.type, "PROPOSE_ESCROW_RELEASE");
  assert.equal(actions[2]?.type, "REQUEST_MISSING_EVIDENCE");
  // Each action gets a unique id
  const ids = new Set(actions.map((a) => a.id));
  assert.equal(ids.size, 3);
});

test("toolCallToProposedPlan converts propose_plan tool call into structured plan", () => {
  const plan = toolCallToProposedPlan(planCall);
  assert.ok(plan);
  assert.equal(plan?.title, "Plan de cierre de milestone y escrow");
  assert.equal(plan?.goal, "Validar evidencia y ejecutar el release con control humano.");
  assert.equal(plan?.steps.length, 2);
  assert.equal(plan?.steps[0]?.id, "step_review");
  assert.equal(plan?.steps[0]?.capability, "worker");
  assert.ok(plan?.steps[0]?.toolsAllowed.includes("propose_milestone_approval"));
  assert.equal(plan?.steps[0]?.expectedOutcome, "Evidencia confirmada o brechas detectadas.");
  assert.deepEqual(plan?.steps[0]?.requiredEvidence, ["Fotos finales"]);
  assert.equal(plan?.steps[1]?.requiresApproval, true);
  assert.equal(plan?.steps[1]?.requiresApprovedPlan, true);
  assert.equal(plan?.steps[1]?.capability, "worker");
  assert.deepEqual(plan?.steps[1]?.dependsOnStepIds, ["step_review"]);
  assert.deepEqual(plan?.requiredEvidence, ["Fotos finales", "Aceptación del cliente"]);
});
