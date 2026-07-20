import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrometeoToolExecutionService } from "../dist/modules/prometeo/prometeo-tool-execution.service.js";

function actor(overrides: Partial<{ userId: string; roles: string[] }> = {}) {
  return {
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: overrides.userId ?? "usr_proposer",
    roles: overrides.roles ?? ["PRO"],
  };
}

function makeGovernanceMock() {
  const proposals = new Map<string, Record<string, unknown>>();
  let nextId = 1;
  return {
    calls: { createProposedAction: [] as unknown[], claimForApproval: [] as unknown[], reject: [] as unknown[], markExecuted: [] as unknown[] },
    proposals,
    async createProposedAction(input: Record<string, unknown>) {
      const id = `action_${nextId++}`;
      const record = {
        id,
        tenantId: input.tenantId,
        orgId: input.orgId,
        actorId: input.actorId,
        namespace: input.namespace,
        name: input.name,
        approvalPolicy: input.approvalPolicy,
        status: "AWAITING_APPROVAL",
        inputJson: input.inputJson,
        requiredApprovals: [],
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
        executedAt: null,
        resultJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      proposals.set(id, record);
      return record;
    },
    async findProposedAction(input: { id: string; tenantId: string }) {
      const record = proposals.get(input.id);
      if (!record || record.tenantId !== input.tenantId) return null;
      return record;
    },
    async claimForApproval(input: { id: string; tenantId: string; approvedBy: string }) {
      const record = proposals.get(input.id);
      if (!record || record.tenantId !== input.tenantId || record.status !== "AWAITING_APPROVAL") return false;
      record.status = "APPROVED";
      record.approvedBy = input.approvedBy;
      record.approvedAt = new Date();
      return true;
    },
    async markExecuted(input: { id: string; tenantId: string; resultJson: unknown }) {
      const record = proposals.get(input.id);
      if (record) {
        record.status = "EXECUTED";
        record.resultJson = input.resultJson;
        record.executedAt = new Date();
      }
    },
    async reject(input: { id: string; tenantId: string; rejectedBy: string; reason: string }) {
      const record = proposals.get(input.id);
      if (!record || record.tenantId !== input.tenantId || record.status !== "AWAITING_APPROVAL") return false;
      record.status = "REJECTED";
      record.rejectedBy = input.rejectedBy;
      record.rejectionReason = input.reason;
      record.rejectedAt = new Date();
      return true;
    },
    async recordInvocation() {},
  };
}

function makeService(input: {
  governance?: ReturnType<typeof makeGovernanceMock>;
  fieldOps?: Record<string, unknown>;
  agroTasks?: Record<string, unknown>;
} = {}) {
  return new PrometeoToolExecutionService(
    input.fieldOps ?? {},
    {} as never,
    {} as never,
    input.agroTasks ?? {},
    {} as never,
    {} as never,
    {} as never,
    (input.governance ?? makeGovernanceMock()) as never,
    undefined,
  );
}

// ── T-030/T-032: propose creates AWAITING_APPROVAL, does not execute ─────────

test("T-032: invokeWriteTool creates an AWAITING_APPROVAL proposal for a confirm-policy tool without executing it", async () => {
  const governance = makeGovernanceMock();
  let executed = false;
  const agroTasks = {
    async createTask() {
      executed = true;
      return { id: "task_1" };
    },
  };
  const service = makeService({ governance, agroTasks });

  const result = await service.invokeWriteTool(actor({ roles: ["PRO"] }) as never, "req_1", {
    namespace: "agro",
    name: "create_task",
    input: { farmId: "farm_1", title: "Feed cattle", type: "FEEDING" },
  });

  assert.equal((result as { status?: string }).status, "AWAITING_APPROVAL");
  assert.equal(executed, false, "the effect must not run until approved");
});

// ── T-033: permission enforcement + payments deferred to F2-D ────────────────

test("T-033: invokeWriteTool denies when the actor lacks the tool's declared permission", async () => {
  const service = makeService();

  await assert.rejects(
    () => service.invokeWriteTool(actor({ roles: ["CLIENT"] }) as never, "req_1", {
      namespace: "time_tracker",
      name: "start",
      input: { jobId: "job_1" },
    }),
    ForbiddenException,
  );
});

test("T-033b: invokeWriteTool creates an AWAITING_APPROVAL proposal for payments.propose_release now that F2-D is wired (was: rejected as not yet available)", async () => {
  // Superseded by F2-D: this used to assert a hard BadRequestException because
  // neither the permission (payments:write, granted by no role) nor the
  // execution path existed yet. Both are implemented now — see
  // prometeo-tool-governance.payments-gate.test.ts for the approve/reject/
  // fault-test coverage of what happens after this proposal exists.
  const governance = makeGovernanceMock();
  const service = makeService({ governance });

  const result = await service.invokeWriteTool(actor({ roles: ["OPS_ADMIN"] }) as never, "req_1", {
    namespace: "payments",
    name: "propose_release",
    input: { milestoneId: "m_1" },
  }) as { status?: string; approvalPolicy?: string };

  assert.equal(result.status, "AWAITING_APPROVAL");
  assert.equal(result.approvalPolicy, "human_required");
});

test("T-033c: invokeWriteTool rejects read tools routed here by mistake", async () => {
  const service = makeService();

  await assert.rejects(
    () => service.invokeWriteTool(actor({ roles: ["OPS_ADMIN"] }) as never, "req_1", {
      namespace: "time_tracker",
      name: "get_status",
      input: {},
    }),
    BadRequestException,
  );
});

// ── T-034: approve executes and persists; reject never executes ─────────────

test("T-034: approving a proposal executes the real effect and persists resultJson", async () => {
  const governance = makeGovernanceMock();
  const calls: unknown[] = [];
  const fieldOps = {
    async startTrackerSession(input: Record<string, unknown>) {
      calls.push(input);
      return { id: "session_1", status: "RUNNING" };
    },
  };
  const service = makeService({ governance, fieldOps });

  const proposed = await service.invokeWriteTool(actor({ userId: "usr_proposer", roles: ["PRO"] }) as never, "req_1", {
    namespace: "time_tracker",
    name: "start",
    input: { jobId: "job_1" },
  }) as { id: string };

  // Self-approval by the original proposer is allowed for "confirm" policy.
  const approved = await service.approveProposedAction(
    actor({ userId: "usr_proposer" }) as never,
    "req_2",
    proposed.id,
  );

  assert.equal(approved.status, "EXECUTED");
  assert.deepEqual(approved.resultJson, { id: "session_1", status: "RUNNING" });
  assert.equal(calls.length, 1);
  assert.equal((calls[0] as Record<string, unknown>).createdBy, "usr_proposer", "the effect must run as the original proposer, not the approver");
});

test("T-034b: OPS_ADMIN can approve someone else's proposal", async () => {
  const governance = makeGovernanceMock();
  const fieldOps = {
    async startTrackerSession() {
      return { id: "session_1", status: "RUNNING" };
    },
  };
  const service = makeService({ governance, fieldOps });

  const proposed = await service.invokeWriteTool(actor({ userId: "usr_proposer" }) as never, "req_1", {
    namespace: "time_tracker",
    name: "start",
    input: { jobId: "job_1" },
  }) as { id: string };

  const approved = await service.approveProposedAction(
    actor({ userId: "usr_admin", roles: ["OPS_ADMIN"] }) as never,
    "req_2",
    proposed.id,
  );
  assert.equal(approved.status, "EXECUTED");
});

test("T-034c: a third party who is neither the proposer nor OPS_ADMIN cannot approve or reject", async () => {
  const governance = makeGovernanceMock();
  const service = makeService({ governance });

  const proposed = await service.invokeWriteTool(actor({ userId: "usr_proposer" }) as never, "req_1", {
    namespace: "agro",
    name: "create_task",
    input: { farmId: "farm_1", title: "x", type: "OTHER" },
  }) as { id: string };

  await assert.rejects(
    () => service.approveProposedAction(actor({ userId: "usr_bystander", roles: ["PRO"] }) as never, "req_2", proposed.id),
    ForbiddenException,
  );
  await assert.rejects(
    () => service.rejectProposedAction(actor({ userId: "usr_bystander", roles: ["PRO"] }) as never, "req_2", proposed.id, "no"),
    ForbiddenException,
  );
});

test("T-034d: rejecting a proposal never executes the effect", async () => {
  const governance = makeGovernanceMock();
  let executed = false;
  const agroTasks = {
    async createTask() {
      executed = true;
      return { id: "task_1" };
    },
  };
  const service = makeService({ governance, agroTasks });

  const proposed = await service.invokeWriteTool(actor({ userId: "usr_proposer" }) as never, "req_1", {
    namespace: "agro",
    name: "create_task",
    input: { farmId: "farm_1", title: "x", type: "OTHER" },
  }) as { id: string };

  const rejected = await service.rejectProposedAction(
    actor({ userId: "usr_proposer" }) as never,
    "req_2",
    proposed.id,
    "changed my mind",
  );

  assert.equal(rejected.status, "REJECTED");
  assert.equal(rejected.rejectionReason, "changed my mind");
  assert.equal(executed, false);
});

test("T-034e: approving/rejecting an unknown actionId is 404", async () => {
  const service = makeService();
  await assert.rejects(
    () => service.approveProposedAction(actor() as never, "req_1", "does-not-exist"),
    NotFoundException,
  );
});

// ── T-035: double-decision race is 409, never double-executes ───────────────

test("T-035: approving an already-approved proposal responds 409 and does not execute twice", async () => {
  const governance = makeGovernanceMock();
  let executionCount = 0;
  const fieldOps = {
    async startTrackerSession() {
      executionCount += 1;
      return { id: "session_1", status: "RUNNING" };
    },
  };
  const service = makeService({ governance, fieldOps });

  const proposed = await service.invokeWriteTool(actor({ userId: "usr_proposer" }) as never, "req_1", {
    namespace: "time_tracker",
    name: "start",
    input: { jobId: "job_1" },
  }) as { id: string };

  await service.approveProposedAction(actor({ userId: "usr_proposer" }) as never, "req_2", proposed.id);
  await assert.rejects(
    () => service.approveProposedAction(actor({ userId: "usr_proposer" }) as never, "req_3", proposed.id),
    ConflictException,
  );

  assert.equal(executionCount, 1);
});

test("T-035b: rejecting an already-rejected proposal responds 409", async () => {
  const governance = makeGovernanceMock();
  const service = makeService({ governance });

  const proposed = await service.invokeWriteTool(actor({ userId: "usr_proposer" }) as never, "req_1", {
    namespace: "agro",
    name: "create_task",
    input: { farmId: "farm_1", title: "x", type: "OTHER" },
  }) as { id: string };

  await service.rejectProposedAction(actor({ userId: "usr_proposer" }) as never, "req_2", proposed.id, "no");
  await assert.rejects(
    () => service.rejectProposedAction(actor({ userId: "usr_proposer" }) as never, "req_3", proposed.id, "no again"),
    ConflictException,
  );
});

test("T-035c: rejecting an already-approved proposal responds 409, execution already happened once", async () => {
  const governance = makeGovernanceMock();
  const fieldOps = {
    async startTrackerSession() {
      return { id: "session_1", status: "RUNNING" };
    },
  };
  const service = makeService({ governance, fieldOps });

  const proposed = await service.invokeWriteTool(actor({ userId: "usr_proposer" }) as never, "req_1", {
    namespace: "time_tracker",
    name: "start",
    input: { jobId: "job_1" },
  }) as { id: string };

  await service.approveProposedAction(actor({ userId: "usr_proposer" }) as never, "req_2", proposed.id);
  await assert.rejects(
    () => service.rejectProposedAction(actor({ userId: "usr_proposer" }) as never, "req_3", proposed.id, "too late"),
    ConflictException,
  );
});
