import test from "node:test";
import assert from "node:assert/strict";
import { AgentsRepository } from "../dist/modules/agents/agents.repository.js";

const tenantId = "tenant_a";
const originOrgId = "org_client_a";
const worker = { tenantId, orgId: "org_service", userId: "usr_worker_system",
  runId: "run_context_1", workerId: "qa-worker", expectedAttempts: 1 };
const run = {
  correlationId: "job:job_owned:created",
  inputJson: {
    eventType: "job.created",
    eventPayload: { jobId: "job_owned", clientOrgId: originOrgId },
    operatorContext: { orgId: originOrgId, tenantId }
  }
};
const row = {
  id: "job_owned", title: "Test job", scope: "Only a synthetic run",
  category: null, status: "PUBLISHED", urgency: "low",
  budgetMin: { toNumber: () => 123 }, budgetMax: null
};

function repository(overrides: {
  run?: unknown; job?: unknown; lockGranted?: boolean;
} = {}) {
  const calls: {
    runWhere?: unknown; jobWhere?: unknown; jobSelect?: unknown;
    lockSql?: string; lockParams?: unknown[]; transactionUsed?: boolean;
  } = {};
  const client = {
    async $transaction(callback: (tx: unknown) => Promise<unknown>): Promise<unknown> {
      calls.transactionUsed = true;
      return callback(client);
    },
    async $queryRaw(strings: TemplateStringsArray, ...params: unknown[]) {
      calls.lockSql = strings.join("?");
      calls.lockParams = params;
      if (overrides.lockGranted === false ||
        params[0] !== worker.runId || params[1] !== worker.tenantId ||
        params[2] !== worker.workerId || params[3] !== worker.expectedAttempts) return [];
      return [{id: worker.runId}];
    },
    agentRun: {
      async findFirst(args: { where: Record<string, unknown> }) {
        calls.runWhere = args.where;
        const result = overrides.run === undefined ? run : overrides.run;
        if (args.where.tenantId !== tenantId || args.where.workerId !== worker.workerId ||
            args.where.attempts !== worker.expectedAttempts ||
            args.where.status !== "RUNNING" || args.where.deadLettered !== false ||
            args.where.triggerType !== "event") return null;
        return result;
      },
    },
    job: {
      async findFirst(args: { where: Record<string, unknown>; select: Record<string, unknown> }) {
        calls.jobWhere = args.where;
        calls.jobSelect = args.select;
        if (args.where.id !== "job_owned" ||
            args.where.tenantId !== tenantId ||
            args.where.clientOrgId !== originOrgId ||
            args.where.deletedAt !== null) return null;
        return overrides.job === undefined ? row : overrides.job;
      }
    }
  };
  const subject = new AgentsRepository(client as never,
    { async ensureActorContext() {} } as never);
  return { subject, calls };
}

test("only fenced active event attempts obtain the originating Job, with a minimal projection", async () => {
  const {subject,calls} = repository();
  const result = await subject.getClaimedJobCreatedContext(worker);
  assert.equal(result.job.id, "job_owned");
  assert.equal(result.job.budgetMin, 123);
  assert.equal(result.job.budgetMax, null);
  assert.equal(calls.transactionUsed, true, "run lock and Job read must share a transaction");
  assert.match(calls.lockSql ?? "", /FOR SHARE/, "run row must be locked");
  assert.match(calls.lockSql ?? "", /status = 'RUNNING'/);
  assert.match(calls.lockSql ?? "", /"deadLettered" = FALSE/);
  assert.deepEqual(calls.lockParams, [worker.runId, worker.tenantId, worker.workerId, worker.expectedAttempts]);
  assert.deepEqual(Object.keys(result.job).sort(),
    ["budgetMax","budgetMin","category","id","scope","status","title","urgency"].sort());
  assert.deepEqual(calls.jobWhere, {
    id: "job_owned", tenantId, clientOrgId: originOrgId, deletedAt: null
  });
  assert.deepEqual(calls.runWhere, {
    id: worker.runId, tenantId, status: "RUNNING",
    workerId: worker.workerId, attempts: 1,
    deadLettered: false, triggerType: "event",
    agentType: {in: ["pricing","risk"]}
  });
  assert.equal((calls.jobSelect as Record<string,unknown>).clientOrgId, undefined,
    "do not expose org identifiers");
});

test("fencing refuses another worker, generation, tenant, or terminal run", async () => {
  const {subject} = repository();
  for (const change of [
    {workerId: "different-worker"},
    {expectedAttempts: 2},
    {tenantId: "tenant_b"},
  ]) {
    await assert.rejects(
      subject.getClaimedJobCreatedContext({...worker, ...change}),
      (error: unknown) => (error as {getStatus?:()=>number})?.getStatus?.() === 404
    );
  }
});

test("a reclaimed/terminal run without the current row lock cannot read its Job", async () => {
  const {subject, calls} = repository({lockGranted: false});
  await assert.rejects(
    subject.getClaimedJobCreatedContext(worker),
    (error: unknown) => (error as {getStatus?:()=>number})?.getStatus?.() === 404
  );
  assert.equal(calls.jobWhere, undefined, "no Job query after a failed lease lock");
});

test("event source must match Job, event metadata and origin org; no arbitrary resource", async () => {
  const variants = [
    { ...run, correlationId: "anything-else" },
    { ...run, inputJson: { ...run.inputJson, eventType: "manual" } },
    { ...run, inputJson: { ...run.inputJson, eventPayload: { jobId:"job_owned", clientOrgId:"org_wrong" } } },
    { ...run, inputJson: { ...run.inputJson, operatorContext: { orgId:"org_wrong", tenantId } } },
    { ...run, inputJson: { ...run.inputJson, operatorContext: { orgId:originOrgId, tenantId:"tenant_b" } } },
    { ...run, inputJson: { ...run.inputJson, eventPayload: { jobId:"job_not_owned", clientOrgId:originOrgId } } },
  ];
  for (const variant of variants) {
    const {subject} = repository({run: variant});
    await assert.rejects(
      subject.getClaimedJobCreatedContext(worker),
      (error: unknown) => (error as {getStatus?:()=>number})?.getStatus?.() === 404
    );
  }
  const {subject} = repository({job:null});
  await assert.rejects(subject.getClaimedJobCreatedContext(worker),
    (error: unknown) => (error as {getStatus?:()=>number})?.getStatus?.() === 404);
});
