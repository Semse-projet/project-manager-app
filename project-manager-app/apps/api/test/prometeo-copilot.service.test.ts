import test from "node:test";
import assert from "node:assert/strict";
import { PrometeoCopilotService } from "../dist/modules/prometeo-copilot/prometeo-copilot.service.js";
import { OrchestrationService } from "../dist/modules/orchestration/orchestration.service.js";
import { InMemoryOrchestrationRepository } from "../dist/modules/orchestration/orchestration.repository.js";
import { WorkspaceService } from "../dist/modules/workspace/workspace.service.js";
import { InMemoryWorkspaceStateRepository } from "../dist/modules/workspace/workspace.repository.js";
import { InMemoryCopilotSessionRepository } from "../dist/modules/prometeo-copilot/prometeo-copilot.repository.js";

const actor = { userId: "u1", tenantId: "t1", orgId: "o1", roles: ["agents:run:create"] };

function build() {
  return new PrometeoCopilotService(
    new OrchestrationService(new InMemoryOrchestrationRepository()),
    new WorkspaceService(new InMemoryWorkspaceStateRepository()),
    new InMemoryCopilotSessionRepository(),
  );
}

test("detectContext maps a jobs URL to the jobs module", () => {
  const svc = build();
  const res = svc.detectContext(actor, { currentUrl: "https://app.semse.io/client/jobs/abc123" });
  assert.equal(res.module, "jobs");
  assert.equal(res.resource.type, "job");
  assert.equal(res.resource.id, "abc123");
  assert.ok(res.confidence >= 0.9);
  assert.ok(res.suggestedActions.length >= 1);
});

test("detectContext accepts bare paths", () => {
  const svc = build();
  const res = svc.detectContext(actor, { currentUrl: "/projects/p1" });
  assert.equal(res.module, "projects");
  assert.equal(res.resource.id, "p1");
});

test("detectContext falls back to dashboard with low confidence", () => {
  const svc = build();
  const res = svc.detectContext(actor, { currentUrl: "https://app.semse.io/unknown-area" });
  assert.equal(res.module, "dashboard");
  assert.ok(res.confidence <= 0.3);
});

test("detectContext respects additionalContext overrides", () => {
  const svc = build();
  const res = svc.detectContext(actor, {
    currentUrl: "/projects",
    additionalContext: { resourceId: "forced", resourceType: "custom" },
  });
  assert.equal(res.resource.id, "forced");
  assert.equal(res.resource.type, "custom");
});

test("processMessage suggests a mission for high-confidence intent", async () => {
  const svc = build();
  const res = await svc.processMessage(actor, {
    message: "necesito un presupuesto para la obra",
    context: { module: "jobs" },
  });
  assert.equal(res.requiresWorkspace, true);
  assert.ok(res.missionSuggestion);
  assert.equal(res.missionSuggestion?.type, "project");
  assert.ok(res.sessionId.length > 0);
});

test("processMessage on vague input does not require workspace", async () => {
  const svc = build();
  const res = await svc.processMessage(actor, { message: "hola" });
  assert.equal(res.requiresWorkspace, false);
  assert.equal(res.missionSuggestion, undefined);
});

test("processMessage reuses an existing session id", async () => {
  const svc = build();
  const first = await svc.processMessage(actor, { message: "presupuesto" });
  const second = await svc.processMessage(actor, {
    message: "otra cosa",
    sessionId: first.sessionId,
  });
  assert.equal(second.sessionId, first.sessionId);
});

test("session state persists across service instances sharing a repository", async () => {
  const sessions = new InMemoryCopilotSessionRepository();
  const make = () =>
    new PrometeoCopilotService(
      new OrchestrationService(new InMemoryOrchestrationRepository()),
      new WorkspaceService(new InMemoryWorkspaceStateRepository()),
      sessions,
    );
  const first = await make().processMessage(actor, { message: "presupuesto" });
  const second = await make().processMessage(actor, {
    message: "otra cosa",
    sessionId: first.sessionId,
  });
  assert.equal(second.sessionId, first.sessionId);
});

test("createMission loads a workspace mission and returns a url", async () => {
  const svc = build();
  const res = await svc.createMission(actor, {
    copilotSessionId: "sess-1",
    missionType: "budget",
    title: "Presupuesto obra",
  });
  assert.ok(res.missionId.length > 0);
  assert.equal(res.type, "budget");
  assert.equal(res.title, "Presupuesto obra");
  assert.match(res.workspaceUrl, /^\/workspace\?mission=/);
});

test("executeAction completes inline read-only actions", () => {
  const svc = build();
  const res = svc.executeAction(actor, {
    action: "job.summary",
    targetResource: { resourceId: "j1", resourceType: "job" },
  });
  assert.equal(res.status, "completed");
  assert.equal(res.requiresWorkspace, false);
});

test("executeAction defers mutating actions to workspace", () => {
  const svc = build();
  const res = svc.executeAction(actor, {
    action: "budget.suggest",
    targetResource: { resourceId: "j1", resourceType: "job" },
  });
  assert.equal(res.status, "pending");
  assert.equal(res.requiresWorkspace, true);
});
