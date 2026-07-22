import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { PrometeoToolExecutionService } from "../dist/modules/prometeo/prometeo-tool-execution.service.js";

function actor(overrides: Partial<{ roles: string[] }> = {}) {
  return {
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: "usr_1",
    roles: overrides.roles ?? ["CLIENT"],
  };
}

function makeService(toolGovernance?: { recordInvocation: (input: Record<string, unknown>) => Promise<void> }) {
  // None of the injected collaborators are exercised when the policy denies
  // before reaching the execution switch.
  return new PrometeoToolExecutionService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    toolGovernance as never,
  );
}

test("T-013: invokeReadTool rejects with 403 when the actor lacks the tool's declared permission, even though agents:run:create already passed the controller gate", async () => {
  const service = makeService();

  // CLIENT does not hold field-ops:read in rbac.ts, so time_tracker.get_status must be denied here.
  await assert.rejects(
    () => service.invokeReadTool(actor({ roles: ["CLIENT"] }) as never, "req_1", {
      namespace: "time_tracker",
      name: "get_status",
      input: {},
    }),
    ForbiddenException,
  );
});

test("T-013b: invokeReadTool still rejects unknown tools with a 400, not silently allowing them through the policy check", async () => {
  const service = makeService();

  await assert.rejects(
    () => service.invokeReadTool(actor() as never, "req_1", {
      namespace: "does_not",
      name: "exist",
      input: {},
    }),
    /Unknown Prometeo tool/,
  );
});

test("T-013c: invokeReadTool still rejects write/critical tools before the policy check even runs", async () => {
  const service = makeService();

  await assert.rejects(
    () => service.invokeReadTool(actor({ roles: ["OPS_ADMIN"] }) as never, "req_1", {
      namespace: "payments",
      name: "propose_release",
      input: { milestoneId: "m_1" },
    }),
    /Prometeo P1 can only invoke read tools/,
  );
});

test("T-023: invokeReadTool records a blocked audit entry when the policy denies, before throwing", async () => {
  const recorded: Array<Record<string, unknown>> = [];
  const service = makeService({
    recordInvocation: async (input) => {
      recorded.push(input);
    },
  });

  await assert.rejects(
    () => service.invokeReadTool(actor({ roles: ["CLIENT"] }) as never, "req_1", {
      namespace: "time_tracker",
      name: "get_status",
      input: {},
    }),
    ForbiddenException,
  );

  assert.equal(recorded.length, 1);
  assert.equal(recorded[0]?.status, "blocked");
  assert.equal(recorded[0]?.namespace, "time_tracker");
  assert.match(String(recorded[0]?.blockedReason), /field-ops:read/);
});

test("T-023b: invokeReadTool records a succeeded audit entry for a wired, authorized read tool", async () => {
  const recorded: Array<Record<string, unknown>> = [];
  const fieldOps = {
    async getTrackerBootstrap() {
      return { activeSession: null, recentSessions: [], jobs: [], summaries: {} };
    },
  };
  const service = new PrometeoToolExecutionService(
    fieldOps as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { recordInvocation: async (input: Record<string, unknown>) => { recorded.push(input); } } as never,
  );

  const result = await service.invokeReadTool(actor({ roles: ["OPS_ADMIN"] }) as never, "req_1", {
    namespace: "time_tracker",
    name: "get_status",
    input: {},
  });

  assert.equal(result.status, "succeeded");
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0]?.status, "succeeded");
});

test("T-023c: invokeReadTool records a blocked audit entry for a registered-but-unwired tool", async () => {
  const recorded: Array<Record<string, unknown>> = [];
  const vision = {
    // analyze_video has no case in executeReadTool's switch — it's still adapterPending
    // (no temporal pipeline exists). The other 5 vision:run read tools were wired up
    // in the vision:run adapters increment; this is the only one left.
  };
  const service = new PrometeoToolExecutionService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    vision as never,
    { recordInvocation: async (input: Record<string, unknown>) => { recorded.push(input); } } as never,
  );

  const result = await service.invokeReadTool(actor({ roles: ["OPS_ADMIN"] }) as never, "req_1", {
    namespace: "vision",
    name: "analyze_video",
    input: { videoFileId: "vid_1" },
  });

  assert.equal(result.status, "blocked");
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0]?.status, "blocked");
});
