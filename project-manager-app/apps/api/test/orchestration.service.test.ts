import test from "node:test";
import assert from "node:assert/strict";
import { OrchestrationService } from "../dist/modules/orchestration/orchestration.service.js";
import { InMemoryOrchestrationRepository } from "../dist/modules/orchestration/orchestration.repository.js";

const actor = { userId: "u1", tenantId: "t1", orgId: "o1", roles: ["agents:run:create"] };

function makeSvc() {
  return new OrchestrationService(new InMemoryOrchestrationRepository());
}

test("interpret routes budget keywords to marta", () => {
  const svc = makeSvc();
  const r = svc.interpret("Necesito un presupuesto para el proyecto");
  assert.equal(r.intent, "budget_estimate");
  assert.ok(r.confidence > 0.5);
});

test("interpret returns general_inquiry for unmatched", () => {
  const svc = makeSvc();
  const r = svc.interpret("hola");
  assert.equal(r.intent, "general_inquiry");
  assert.ok(r.confidence < 0.4);
});

test("interpret honors preferredAgents even without keywords", () => {
  const svc = makeSvc();
  const r = svc.interpret("hola", ["planner"]);
  assert.equal(r.intent, "planning");
});

test("interpret extracts amount and uuid entities", () => {
  const svc = makeSvc();
  const r = svc.interpret("presupuesto de $1,500 para 11111111-1111-1111-1111-111111111111");
  const types = r.entities.map((e) => e.type);
  assert.ok(types.includes("amount"));
  assert.ok(types.includes("resourceId"));
});

test("orchestrate completes and stores record", async () => {
  const svc = makeSvc();
  const res = await svc.orchestrate(actor, { message: "quiero un presupuesto y un plan de hitos" });
  assert.equal(res.status, "completed");
  assert.ok(res.agentsConsulted.length >= 1);
  assert.ok(res.plan.steps.length >= 1);
  assert.equal(res.requiresApproval, true);
  const fetched = await svc.getOrchestration(actor, res.orchestrationId);
  assert.equal(fetched.orchestrationId, res.orchestrationId);
  assert.equal(fetched.status, "completed");
});

test("orchestrate on ambiguous message requires approval and consults pulse", async () => {
  const svc = makeSvc();
  const res = await svc.orchestrate(actor, { message: "hmmm" });
  assert.equal(res.requiresApproval, true);
  assert.deepEqual(res.agentsConsulted.map((a) => a.agentId), ["pulse"]);
});

test("orchestrate with preferredAgents consults exactly those", async () => {
  const svc = makeSvc();
  const res = await svc.orchestrate(actor, {
    message: "revisa algo",
    preferredAgents: ["marta", "just"],
  });
  assert.deepEqual(res.agentsConsulted.map((a) => a.agentId).sort(), ["just", "marta"]);
});

test("status-only intent (pulse) does not require approval", async () => {
  const svc = makeSvc();
  const res = await svc.orchestrate(actor, { message: "muéstrame el estado y progreso" });
  assert.equal(res.requiresApproval, false);
});

test("consultAgent returns a per-agent response", () => {
  const svc = makeSvc();
  const res = svc.consultAgent(actor, "felix", { query: "necesito evidencia" });
  assert.equal(res.agentId, "felix");
  assert.ok(res.agentResponse.length > 0);
  assert.equal(res.requiresAction, true);
  assert.ok(res.suggestedActions.length >= 1);
});

test("getOrchestration throws for unknown id", async () => {
  const svc = makeSvc();
  await assert.rejects(() => svc.getOrchestration(actor, "nope"), /not found/);
});

test("getOrchestration enforces tenant isolation", async () => {
  const svc = makeSvc();
  const res = await svc.orchestrate(actor, { message: "presupuesto" });
  const other = { userId: "u2", tenantId: "t2", orgId: "o2", roles: [] };
  await assert.rejects(() => svc.getOrchestration(other, res.orchestrationId), /not found/);
});

test("orchestration record persists across service instances sharing a repository", async () => {
  const repo = new InMemoryOrchestrationRepository();
  const first = new OrchestrationService(repo);
  const res = await first.orchestrate(actor, { message: "presupuesto" });
  const second = new OrchestrationService(repo);
  const fetched = await second.getOrchestration(actor, res.orchestrationId);
  assert.equal(fetched.orchestrationId, res.orchestrationId);
});

test("agentIds lists all five specialists", () => {
  const ids = OrchestrationService.agentIds();
  assert.deepEqual(ids.sort(), ["felix", "just", "marta", "planner", "pulse"]);
});
