import test from "node:test";
import assert from "node:assert/strict";
import { BuildOpsAgent } from "../dist/modules/semse-agents/buildops.agent.js";
import { EvidenceAgent } from "../dist/modules/semse-agents/evidence.agent.js";

function bus() { return { register() {} } as never; }

test("BuildOps templates render EN without changing schedule or milestone count", () => {
  const agent = new BuildOpsAgent(bus());
  for (const trade of ["electrical", "plumbing", "drywall", "painting", "custom"]) {
    const es = agent.createPlan(trade, 16);
    const en = agent.createPlan(trade, 16, "en");
    assert.equal(en.totalDays, es.totalDays);
    assert.deepEqual(en.phases.map(p => p.durationDays), es.phases.map(p => p.durationDays));
    assert.equal(en.phases.length, es.phases.length);
    assert.deepEqual(en.criticalPath, en.phases.map(p => p.name));
    assert.equal(en.phases.every(p => p.tasks.length > 0 && p.evidenceRequired.length > 0), true);
    assert.ok(en.reasoningSteps.every(step => !step.includes("Evidencia requerida") && !step.includes("Ruta crítica")));
  }
  const electrical = agent.createPlan("electrical", 16, "en");
  assert.equal(electrical.phases[0]?.tasks[0], "Install boxes");
  assert.equal(electrical.phases[0]?.milestoneTitle, "Electrical rough-in completed");
  assert.equal(electrical.phases[0]?.evidenceRequired[0], "Photo of installed wiring");
  const painting = agent.createPlan("painting", 16, "en");
  assert.deepEqual(painting.criticalPath, ["Preparation", "Painting"]);
  const unknown = agent.createPlan("custom", 16, "en");
  assert.equal(unknown.phases[0]?.name, "Execution");
  assert.equal(unknown.phases[0]?.tasks[0], "Perform work");
  assert.equal(agent.createPlan("painting", 16).phases[0]?.name, "Preparación");
});

test("Evidence checklist ES/EN preserves risk, required kinds, phases and original milestone", () => {
  const agent = new EvidenceAgent(bus());
  for (const trade of ["electrical", "plumbing", "drywall", "painting", "custom"]) {
    const es = agent.generateChecklist("Milestone " + trade, trade);
    const en = agent.generateChecklist("Milestone " + trade, trade, "en");
    assert.equal(en.milestoneTitle, es.milestoneTitle);
    assert.equal(en.disputeRisk, es.disputeRisk);
    assert.deepEqual(en.required.map(item => item.kind), es.required.map(item => item.kind));
    assert.deepEqual(en.required.map(item => item.phase), es.required.map(item => item.phase));
    assert.equal(en.required.length, es.required.length);
    assert.ok(en.required.every(item => item.label.trim() && item.description.trim()));
  }
  const en = agent.generateChecklist("Rough-in electrical", "electrical", "en");
  assert.equal(en.required[0]?.label, "Electrical rough-in photo");
  assert.equal(en.required[0]?.description, "Photo of wiring and boxes before walls are closed");
  assert.equal(en.disputeRisk, "high");
  const es = agent.generateChecklist("Rough-in electrical", "electrical");
  assert.equal(es.required[0]?.label, "Foto rough-in eléctrico");
  const fallback = agent.generateChecklist("User entered milestone", "unknown", "en");
  assert.equal(fallback.required[0]?.label, "Photo before work begins");
  assert.equal(fallback.milestoneTitle, "User entered milestone");
});
