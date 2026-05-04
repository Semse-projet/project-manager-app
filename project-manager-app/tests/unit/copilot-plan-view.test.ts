import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCopilotPlanSections,
  buildCopilotPlanStepFacts,
  getCopilotPlanProgress,
  getCopilotPlanStatusLabel,
} from "../../apps/web/app/lib/copilot-plan-view.ts";

const plan = {
  id: "plan_1",
  title: "Plan formal",
  goal: "Aprobar el hito y preparar el escrow release.",
  rationale: "Hay evidencia, pero falta el gate humano final.",
  status: "pending_approval" as const,
  steps: [
    {
      id: "step_1",
      order: 1,
      title: "Revisar evidencia",
      description: "Confirmar fotos finales.",
      expectedOutcome: "Evidencia validada.",
      capability: "searching" as const,
      toolsAllowed: ["search_patterns", "read_file", "list_directory"],
      riskLevel: "medium" as const,
      requiresApproval: false,
      requiresApprovedPlan: false,
      status: "blocked" as const,
      dependsOnStepIds: ["step_0"],
      requiredEvidence: ["Fotos finales"],
      evidenceStatus: "missing" as const,
      blockReason: "Evidencia faltante: Fotos finales",
      boundAction: {
        actionType: "PROPOSE_MILESTONE_APPROVAL",
        approvalMode: "manual" as const,
        riskLevel: "medium" as const,
      },
    },
  ],
  risks: ["Liberación sin evidencia final"],
  requiredEvidence: ["Fotos finales", "Aceptación del cliente"],
  successCriteria: ["Milestone aprobado", "Escrow listo para release"],
  createdAt: new Date().toISOString(),
};

test("buildCopilotPlanSections exposes plan sections required by frontend", () => {
  const sections = buildCopilotPlanSections(plan);
  const titles = sections.map((section) => section.title);

  assert.deepEqual(titles, [
    "Objetivo",
    "Fundamento",
    "Riesgos",
    "Evidencia requerida",
    "Criterios de éxito",
  ]);
  assert.ok(sections[2]?.items.includes("Liberación sin evidencia final"));
  assert.ok(sections[3]?.items.includes("Aceptación del cliente"));
});

test("getCopilotPlanStatusLabel returns user-facing copy", () => {
  assert.equal(getCopilotPlanStatusLabel("pending_approval"), "Pendiente de aprobación");
  assert.equal(getCopilotPlanStatusLabel("approved"), "Plan aprobado");
});

test("getCopilotPlanProgress computes visible progress for task graph UI", () => {
  const progress = getCopilotPlanProgress({
    ...plan,
    progress: undefined,
    steps: [
      { ...plan.steps[0], id: "step_1", status: "completed" as const, blockReason: undefined, blockedReason: undefined },
      { ...plan.steps[0], id: "step_2", status: "ready" as const, blockReason: undefined, blockedReason: undefined },
      { ...plan.steps[0], id: "step_3", status: "failed" as const, blockReason: "Error", blockedReason: "Error" },
    ],
  });

  assert.equal(progress.totalSteps, 3);
  assert.equal(progress.completedSteps, 1);
  assert.equal(progress.readySteps, 1);
  assert.equal(progress.failedSteps, 1);
  assert.equal(progress.percent, 33);
});

test("buildCopilotPlanStepFacts exposes blocked reason and bindings", () => {
  const facts = buildCopilotPlanStepFacts(plan.steps[0]!);
  assert.ok(facts.some((fact) => fact.includes("Capability: searching")));
  assert.ok(facts.some((fact) => fact.includes("Tools: search_patterns, read_file, list_directory")));
  assert.ok(facts.some((fact) => fact.includes("Depende de: step_0")));
  assert.ok(facts.some((fact) => fact.includes("Evidencia: Fotos finales")));
  assert.ok(facts.some((fact) => fact.includes("Acción: PROPOSE_MILESTONE_APPROVAL")));
  assert.ok(facts.some((fact) => fact.includes("Bloqueo: Evidencia faltante: Fotos finales")));
});
