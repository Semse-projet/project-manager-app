import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, ConflictException, NotFoundException } from "@nestjs/common";
import { PrometeoToolExecutionService } from "../dist/modules/prometeo/prometeo-tool-execution.service.js";

function actor(overrides: Partial<{ userId: string; roles: string[] }> = {}) {
  return {
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: overrides.userId ?? "usr_1",
    roles: overrides.roles ?? ["PRO"],
  };
}

type FakeRow = Record<string, unknown>;

function makeFakeGovernance(seed: FakeRow[] = []) {
  const store = new Map<string, FakeRow>(seed.map((row) => [row.id as string, { ...row }]));
  const recorded: FakeRow[] = [];
  const created: FakeRow[] = [];
  const finalized: FakeRow[] = [];
  let nextId = seed.length + 1;

  return {
    store,
    recorded,
    created,
    finalized,
    async recordInvocation(input: FakeRow) {
      recorded.push(input);
    },
    async createProposedAction(input: FakeRow) {
      const id = `action_${nextId++}`;
      const row: FakeRow = { id, status: "PROPOSED", ...input };
      store.set(id, row);
      created.push(row);
      return row;
    },
    async findProposedAction({ id }: { id: string }) {
      const row = store.get(id);
      return row ? { ...row } : null;
    },
    async transitionProposedAction({ id, fromStatuses, toStatus, patch }: { id: string; fromStatuses: string[]; toStatus: string; patch: FakeRow }) {
      const row = store.get(id);
      if (!row || !fromStatuses.includes(row.status as string)) {
        return false;
      }
      Object.assign(row, { status: toStatus, ...patch });
      return true;
    },
    async finalizeProposedAction(input: { id: string; status: string; resultJson?: unknown; executedAt?: Date }) {
      finalized.push(input);
      const row = store.get(input.id);
      if (row) {
        Object.assign(row, { status: input.status, resultJson: input.resultJson, executedAt: input.executedAt });
      }
    },
  };
}

function makeService(overrides: {
  fieldOps?: Record<string, unknown>;
  agroTasks?: Record<string, unknown>;
  toolGovernance?: ReturnType<typeof makeFakeGovernance>;
} = {}) {
  return new PrometeoToolExecutionService(
    (overrides.fieldOps ?? {}) as never,
    {} as never,
    {} as never,
    (overrides.agroTasks ?? {}) as never,
    {} as never,
    {} as never,
    {} as never,
    overrides.toolGovernance as never,
  );
}

test("T-030: invokeWriteTool denies with 403 when the actor lacks the tool's declared write permission", async () => {
  const governance = makeFakeGovernance();
  const service = makeService({ toolGovernance: governance });

  await assert.rejects(
    () => service.invokeWriteTool(actor({ roles: ["CLIENT"] }) as never, "req_1", {
      namespace: "time_tracker",
      name: "start",
      input: { jobId: "job_1" },
    }),
    ForbiddenException,
  );

  assert.equal(governance.recorded.length, 1);
  assert.equal(governance.recorded[0]?.status, "blocked");
  assert.equal(governance.created.length, 0);
});

test("T-030b: invokeWriteTool creates a queued PrometeoProposedAction (does not execute yet) for a confirm-policy tool", async () => {
  const governance = makeFakeGovernance();
  const fieldOps = {
    async startTrackerSession() {
      throw new Error("must not execute before approval");
    },
  };
  const service = makeService({ fieldOps, toolGovernance: governance });

  const result = await service.invokeWriteTool(actor({ roles: ["PRO"], userId: "usr_1" }) as never, "req_1", {
    namespace: "time_tracker",
    name: "start",
    input: { jobId: "job_1" },
  });

  assert.equal(result.status, "queued");
  assert.ok(result.actionId);
  assert.equal(governance.created.length, 1);
  assert.equal(governance.created[0]?.namespace, "time_tracker");
  assert.equal(governance.created[0]?.approvalPolicy, "confirm");
  assert.deepEqual(governance.created[0]?.requiredApprovals, ["usr_1"]);
});

test("T-034: approving a confirm-policy proposed action as the original actor executes the real effect and persists resultJson", async () => {
  let calls = 0;
  const fieldOps = {
    async startTrackerSession(input: Record<string, unknown>) {
      calls += 1;
      return { id: "session_1", jobId: input.jobId, status: "RUNNING" };
    },
  };
  const governance = makeFakeGovernance([
    {
      id: "action_1",
      tenantId: "tenant_1",
      orgId: "org_1",
      actorId: "usr_1",
      namespace: "time_tracker",
      name: "start",
      approvalPolicy: "confirm",
      status: "PROPOSED",
      inputJson: { jobId: "job_1" },
    },
  ]);
  const service = makeService({ fieldOps, toolGovernance: governance });

  const result = await service.approveProposedAction(actor({ userId: "usr_1", roles: ["PRO"] }) as never, "req_1", "action_1");

  assert.equal(result.status, "succeeded");
  assert.equal(calls, 1);
  assert.equal(governance.finalized.length, 1);
  assert.equal(governance.finalized[0]?.status, "EXECUTED");
  assert.deepEqual(governance.finalized[0]?.resultJson, { id: "session_1", jobId: "job_1", status: "RUNNING" });
  assert.equal(governance.store.get("action_1")?.status, "EXECUTED");
});

test("T-034b: rejecting a proposed action leaves it REJECTED and never runs the effect", async () => {
  let calls = 0;
  const fieldOps = {
    async startTrackerSession() {
      calls += 1;
      return { id: "session_1" };
    },
  };
  const governance = makeFakeGovernance([
    {
      id: "action_1",
      tenantId: "tenant_1",
      orgId: "org_1",
      actorId: "usr_1",
      namespace: "time_tracker",
      name: "start",
      approvalPolicy: "confirm",
      status: "PROPOSED",
      inputJson: { jobId: "job_1" },
    },
  ]);
  const service = makeService({ fieldOps, toolGovernance: governance });

  const result = await service.rejectProposedAction(actor({ userId: "usr_1" }) as never, "req_1", "action_1", "no longer needed");

  assert.equal(result.status, "skipped");
  assert.equal(calls, 0);
  assert.equal(governance.store.get("action_1")?.status, "REJECTED");
  assert.equal(governance.store.get("action_1")?.rejectionReason, "no longer needed");
});

test("T-033: a non-admin actor who did not propose the action cannot approve it", async () => {
  const governance = makeFakeGovernance([
    {
      id: "action_1",
      tenantId: "tenant_1",
      orgId: "org_1",
      actorId: "usr_1",
      namespace: "time_tracker",
      name: "start",
      approvalPolicy: "confirm",
      status: "PROPOSED",
      inputJson: { jobId: "job_1" },
    },
  ]);
  const service = makeService({ toolGovernance: governance });

  await assert.rejects(
    () => service.approveProposedAction(actor({ userId: "usr_2", roles: ["PRO"] }) as never, "req_1", "action_1"),
    ForbiddenException,
  );
  assert.equal(governance.store.get("action_1")?.status, "PROPOSED");
});

test("T-033b: OPS_ADMIN can approve a confirm-policy action proposed by someone else", async () => {
  const fieldOps = {
    async startTrackerSession() {
      return { id: "session_1" };
    },
  };
  const governance = makeFakeGovernance([
    {
      id: "action_1",
      tenantId: "tenant_1",
      orgId: "org_1",
      actorId: "usr_1",
      namespace: "time_tracker",
      name: "start",
      approvalPolicy: "confirm",
      status: "PROPOSED",
      inputJson: { jobId: "job_1" },
    },
  ]);
  const service = makeService({ fieldOps, toolGovernance: governance });

  const result = await service.approveProposedAction(actor({ userId: "admin_1", roles: ["OPS_ADMIN"] }) as never, "req_1", "action_1");
  assert.equal(result.status, "succeeded");
});

test("T-033c: the proposing actor alone cannot approve a human_required action — only OPS_ADMIN can", async () => {
  const governance = makeFakeGovernance([
    {
      id: "action_1",
      tenantId: "tenant_1",
      orgId: "org_1",
      actorId: "usr_1",
      namespace: "payments",
      name: "propose_release",
      approvalPolicy: "human_required",
      status: "AWAITING_APPROVAL",
      inputJson: { milestoneId: "m_1" },
    },
  ]);
  const service = makeService({ toolGovernance: governance });

  await assert.rejects(
    () => service.approveProposedAction(actor({ userId: "usr_1", roles: ["PRO"] }) as never, "req_1", "action_1"),
    ForbiddenException,
  );
});

test("T-033d: approving/rejecting an unknown proposed action responds 404", async () => {
  const governance = makeFakeGovernance();
  const service = makeService({ toolGovernance: governance });

  await assert.rejects(
    () => service.approveProposedAction(actor({ roles: ["OPS_ADMIN"] }) as never, "req_1", "does_not_exist"),
    NotFoundException,
  );
});

test("T-035: approving an already-terminal proposed action responds 409, not a re-execution", async () => {
  const fieldOps = {
    async startTrackerSession() {
      throw new Error("must not execute a terminal action");
    },
  };
  const governance = makeFakeGovernance([
    {
      id: "action_1",
      tenantId: "tenant_1",
      orgId: "org_1",
      actorId: "usr_1",
      namespace: "time_tracker",
      name: "start",
      approvalPolicy: "confirm",
      status: "EXECUTED",
      inputJson: { jobId: "job_1" },
    },
  ]);
  const service = makeService({ fieldOps, toolGovernance: governance });

  await assert.rejects(
    () => service.approveProposedAction(actor({ userId: "usr_1" }) as never, "req_1", "action_1"),
    ConflictException,
  );
});

test("T-035b: two concurrent approvals of the same proposed action execute the effect exactly once — the loser gets 409", async () => {
  let calls = 0;
  const fieldOps = {
    async startTrackerSession(input: Record<string, unknown>) {
      calls += 1;
      return { id: "session_1", jobId: input.jobId };
    },
  };
  const governance = makeFakeGovernance([
    {
      id: "action_1",
      tenantId: "tenant_1",
      orgId: "org_1",
      actorId: "usr_1",
      namespace: "time_tracker",
      name: "start",
      approvalPolicy: "confirm",
      status: "PROPOSED",
      inputJson: { jobId: "job_1" },
    },
  ]);
  const service = makeService({ fieldOps, toolGovernance: governance });
  const proposer = actor({ userId: "usr_1" });

  const outcomes = await Promise.allSettled([
    service.approveProposedAction(proposer as never, "req_a", "action_1"),
    service.approveProposedAction(proposer as never, "req_b", "action_1"),
  ]);

  const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
  const rejected = outcomes.filter((o) => o.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok((rejected[0] as PromiseRejectedResult).reason instanceof ConflictException);
  assert.equal(calls, 1, "the underlying effect must run exactly once");
});
