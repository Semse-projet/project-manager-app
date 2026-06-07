import test from "node:test";
import assert from "node:assert/strict";
import { DeveloperRuntimeApprovalService } from "../dist/modules/developer-runtime/developer-runtime.approval.service.js";
import { DeveloperRuntimeShellService } from "../dist/modules/developer-runtime/developer-runtime.shell.service.js";
import { DeveloperRuntimeService } from "../dist/modules/developer-runtime/developer-runtime.service.js";
import { DeveloperRuntimeValidationService } from "../dist/modules/developer-runtime/developer-runtime.validation.service.js";

function createService() {
  const sessions = new Map();
  const missions = new Map();
  const repository = {
    async listSessions() {
      return Array.from(sessions.values());
    },
    async getSession(input) {
      const session = sessions.get(input.sessionId);
      return {
        session,
        mission: missions.get(session.missionId) ?? null,
      };
    },
    async createSession(input) {
      sessions.set(input.session.id, input.session);
      return input.session;
    },
    async saveMission(input) {
      sessions.set(input.session.id, input.session);
      missions.set(input.mission.id, input.mission);
      return input.mission;
    },
  } as any;

  return new DeveloperRuntimeService(
    repository,
    new DeveloperRuntimeApprovalService(),
    { enqueueExecution: async () => undefined } as any,
    new DeveloperRuntimeShellService(),
    new DeveloperRuntimeValidationService(),
  );
}

test("developer runtime service creates sessions and missions with derived approvals", async () => {
  const service = createService();
  const session = await service.createSession(
    {
      repoId: "project-manager-app",
      branch: "main",
      goal: "Corrige el build del repo",
      selectedAgents: [],
    },
    { tenantId: "tnt_test", orgId: "org_test", userId: "usr_test" },
    "req_test",
  );

  const mission = await service.createMission(
    session.id,
    {
      intent: {
        goal: "Corrige el build del repo",
        category: "bugfix",
        confidence: 0.9,
        riskLevel: "medium",
        requiresApproval: true,
        repoId: "project-manager-app",
        branch: "main",
      },
    },
    { tenantId: "tnt_test", orgId: "org_test", userId: "usr_test" },
    "req_test",
  );

  const detail = await service.getSession(session.id, {
    tenantId: "tnt_test",
    orgId: "org_test",
    userId: "usr_test",
  });

  assert.equal(mission.plan.length, 4);
  assert.equal(detail.session.state, "awaiting_approval");
  assert.ok(mission.plan.some((step) => step.approvalRequired));
  assert.match(detail.session.summary ?? "", /validations:/);
});

test("developer runtime service exposes catalog with tools", () => {
  const service = createService();
  const catalog = service.getCatalog() as { tools?: string[]; agents: Array<{ role: string }> };

  assert.ok(Array.isArray(catalog.tools));
  assert.ok(catalog.tools?.includes("runBuild"));
  assert.ok(catalog.agents.some((agent) => agent.role === "qa-agent"));
});
