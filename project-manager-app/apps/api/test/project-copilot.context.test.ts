import test from "node:test";
import assert from "node:assert/strict";
import { buildProjectCopilotPromptContext } from "../dist/modules/agents/harnesses/project-copilot.context.js";

test("active plan is injected into prompt context", () => {
  const context = buildProjectCopilotPromptContext({
    projectId: "proj_1",
    workspace: {
      projectId: "proj_1",
      title: "Renovación cocina",
      status: "in_progress",
      budgetTotal: 10000,
      milestonesTotal: 4,
      milestonesApproved: 2,
      escrowStatus: "FUNDED",
      escrowFunded: 8000,
      escrowReleased: 3000,
    },
    context: {
      projectId: "proj_1",
      jobCount: 0,
      openDisputeCount: 1,
      lastActivityAt: null,
    },
    corpusStatus: {
      projectId: "proj_1",
      documentCount: 5,
      evidenceCount: 5,
      indexedAt: new Date().toISOString(),
      status: "ready",
    },
    memoryContext: "Memoria relevante",
    activePlan: {
      id: "plan_1",
      title: "Plan de cierre",
      goal: "Aprobar milestone y liberar escrow con control.",
      rationale: "Hay evidencia suficiente, pero la acción es sensible.",
      status: "approved",
      steps: [],
      risks: ["Release prematuro"],
      requiredEvidence: ["Fotos finales"],
      successCriteria: ["Milestone aprobado"],
      approvedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    activePlanContext: "## Plan activo del proyecto",
  });

  assert.equal(context.activePlanTitle, "Plan de cierre");
  assert.equal(context.activePlanStatus, "approved");
  assert.equal(context.activePlanGoal, "Aprobar milestone y liberar escrow con control.");
  assert.equal(context.activePlanContext, "## Plan activo del proyecto");
});
