import test from "node:test";
import assert from "node:assert/strict";
import { semseEventSchema } from "@semse/schemas";
import { OrchestrationService } from "../dist/modules/orchestration/orchestration.service.js";
import { InMemoryOrchestrationRepository } from "../dist/modules/orchestration/orchestration.repository.js";
import { PrometeoCopilotService } from "../dist/modules/prometeo-copilot/prometeo-copilot.service.js";
import { WorkspaceService } from "../dist/modules/workspace/workspace.service.js";
import { InMemoryWorkspaceStateRepository } from "../dist/modules/workspace/workspace.repository.js";
import { InMemoryCopilotSessionRepository } from "../dist/modules/prometeo-copilot/prometeo-copilot.repository.js";

const actor = {
  userId: "u1",
  tenantId: "t1",
  orgId: "o1",
  roles: ["agents:run:create"],
  requestId: "req-1",
};

/** Captures every emission and asserts the event is a valid canonical SemseEvent. */
class RecordingBus {
  constructor() {
    this.emitted = [];
  }
  async emit(event, context) {
    // Proves the emitted event is a real, catalog-defined SemseEvent.
    const parsed = semseEventSchema.parse(event);
    this.emitted.push({ event: parsed, context });
    return [];
  }
  ofType(type) {
    return this.emitted.filter((e) => e.event.type === type);
  }
}

test("orchestrate emits a canonical agent.action_logged event", async () => {
  const bus = new RecordingBus();
  const svc = new OrchestrationService(new InMemoryOrchestrationRepository(), bus);
  const res = await svc.orchestrate(actor, { message: "quiero un presupuesto y un plan de hitos" });

  const logged = bus.ofType("agent.action_logged");
  assert.equal(logged.length, 1);
  const { event, context } = logged[0];
  assert.equal(event.payload.agentType, "prometeo-orchestrator");
  assert.equal(event.payload.actionType, "generate");
  assert.equal(event.payload.targetType, "orchestration");
  assert.equal(event.payload.targetId, res.orchestrationId);
  assert.equal(event.payload.agentRunId, res.orchestrationId);
  assert.equal(event.payload.requiresHumanReview, res.requiresApproval);
  assert.ok(event.payload.confidence >= 0 && event.payload.confidence <= 1);
  assert.equal(event.meta.correlationId, res.orchestrationId);
  assert.equal(event.meta.tenantId, actor.tenantId);
  // Emit context carries the invoking principal for audit correlation.
  assert.equal(context.tenantId, actor.tenantId);
  assert.equal(context.orgId, actor.orgId);
  assert.equal(context.userId, actor.userId);
  assert.equal(context.requestId, actor.requestId);
});

test("orchestrate requiring approval also emits agent.human_review_requested", async () => {
  const bus = new RecordingBus();
  const svc = new OrchestrationService(new InMemoryOrchestrationRepository(), bus);
  const res = await svc.orchestrate(actor, { message: "hmmm" }); // ambiguous → approval

  assert.equal(res.requiresApproval, true);
  const review = bus.ofType("agent.human_review_requested");
  assert.equal(review.length, 1);
  assert.equal(review[0].event.payload.reason, "ambiguous_intent");
  assert.equal(review[0].event.payload.targetId, res.orchestrationId);
  assert.equal(review[0].event.payload.urgency, "medium");
});

test("orchestrate without approval does not request human review", async () => {
  const bus = new RecordingBus();
  const svc = new OrchestrationService(new InMemoryOrchestrationRepository(), bus);
  const res = await svc.orchestrate(actor, { message: "muéstrame el estado y progreso" });

  assert.equal(res.requiresApproval, false);
  assert.equal(bus.ofType("agent.human_review_requested").length, 0);
  assert.equal(bus.ofType("agent.action_logged").length, 1);
  assert.equal(bus.ofType("agent.action_logged")[0].event.payload.requiresHumanReview, false);
});

test("orchestrate still works when no domain event bus is wired", async () => {
  const svc = new OrchestrationService(new InMemoryOrchestrationRepository());
  const res = await svc.orchestrate(actor, { message: "presupuesto" });
  assert.equal(res.status, "completed");
});

test("copilot createMission emits a canonical agent.action_logged event", async () => {
  const bus = new RecordingBus();
  const svc = new PrometeoCopilotService(
    new OrchestrationService(new InMemoryOrchestrationRepository()),
    new WorkspaceService(new InMemoryWorkspaceStateRepository()),
    new InMemoryCopilotSessionRepository(),
    bus,
  );
  const res = await svc.createMission(actor, {
    copilotSessionId: "3f0d2c1e-5b6a-4c7d-8e9f-0a1b2c3d4e5f",
    missionType: "project",
    title: "Nueva misión",
  });

  const logged = bus.ofType("agent.action_logged");
  assert.equal(logged.length, 1);
  const { event, context } = logged[0];
  assert.equal(event.payload.agentType, "prometeo-copilot");
  assert.equal(event.payload.actionType, "generate");
  assert.equal(event.payload.targetType, "mission");
  assert.equal(event.payload.targetId, res.missionId);
  assert.equal(event.payload.requiresHumanReview, false);
  assert.equal(event.payload.confidence, 1);
  assert.equal(context.requestId, actor.requestId);
});
