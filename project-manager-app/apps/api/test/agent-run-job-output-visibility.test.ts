import test from "node:test";
import assert from "node:assert/strict";
import { AgentsRepository } from "../dist/modules/agents/agents.repository.js";

const tenantId = "tenant_default";
const jobId = "job_qa_scoped";
const sample = {
  id: "run_qa_scoped", tenantId, agentType: "pricing", triggerType: "event",
  correlationId: "job:" + jobId + ":created",
  inputJson: {
    eventType: "job.created",
    eventPayload: { jobId, clientOrgId: "org_owner" },
    operatorContext: { tenantId, orgId: "org_owner" },
  },
  inputSummary: "original event context",
  outputSummary: "Pricing used current confidential budget",
  status: "COMPLETED", workerId: "worker_qa", attempts: 1, maxAttempts: 3,
  deadLettered: false, outputJson: { result: { budgetMin: 4800, scopeSummary: "private scope" } },
  error: null, startedAt: new Date(), heartbeatAt: new Date(),
  endedAt: new Date(), durationMs: 11, toolCallCount: 0,
  createdAt: new Date(), updatedAt: new Date(),
};
const actor = (orgId: string, roles: string[]) => ({
  tenantId, orgId, userId: "usr_qa", roles,
});
function setup() {
  const calls: Array<{kind:string;where:unknown}> = [];
  let writes = 0;
  const client = {
    agentRun: {
      async findMany(args: {where:unknown}) {
        calls.push({kind:"runs",where:args.where}); return [sample];
      },
      async findFirst(args: {where:unknown}) {
        calls.push({kind:"run",where:args.where}); return sample;
      },
      async update() { writes++; throw Error("Unintended mutation"); },
    },
    job: {
      async findMany(args: {where:Record<string,unknown>}) {
        calls.push({kind:"jobs",where:args.where});
        return args.where.clientOrgId === "org_owner" || args.where.clientOrgId === undefined
          ? [{id:jobId}] : [];
      },
      async findFirst(args: {where:Record<string,unknown>}) {
        calls.push({kind:"job",where:args.where});
        return args.where.clientOrgId === "org_owner" || args.where.clientOrgId === undefined
          ? {id:jobId} : null;
      },
    },
  };
  const repo = new AgentsRepository(
    client as never,
    {async ensureActorContext() {}} as never
  );
  return {repo,calls,getWrites:()=>writes};
}

test("originating CLIENT may read its own Job-derived AgentRun output", async () => {
  const {repo}=setup();
  const principal=actor("org_owner",["CLIENT"]);
  const detail=await repo.findById({...principal,runId:sample.id});
  assert.ok(JSON.stringify(detail.output).includes("4800"));
  const list=await repo.list(principal);
  assert.equal(list.length,1);
  assert.ok(JSON.stringify(list[0].output).includes("4800"));
  const events=await repo.getEvents({...principal,runId:sample.id});
  assert.equal(events.events.find(e=>e.type==="completed")?.detail,sample.outputSummary);
});

test("another CLIENT org cannot read Job-derived output through list, detail or events", async () => {
  const {repo,calls}=setup();
  const principal=actor("org_other",["CLIENT"]);
  const detail=await repo.findById({...principal,runId:sample.id});
  assert.equal(detail.output,undefined);
  assert.equal(detail.error,undefined);
  const list=await repo.list(principal);
  assert.equal(list[0].output,undefined);
  const events=await repo.getEvents({...principal,runId:sample.id});
  assert.equal(events.events.some(e=>e.type==="input"),false);
  assert.equal(events.events.find(e=>e.type==="completed")?.detail,"Run completed successfully");
  assert.ok(calls.some(c=>c.kind==="job" && (c.where as Record<string,unknown>).clientOrgId==="org_other"));
  assert.ok(calls.some(c=>c.kind==="jobs" && (c.where as Record<string,unknown>).clientOrgId==="org_other"));
});

test("WORKER without jobs:read cannot obtain enriched output from run read", async () => {
  const {repo,calls}=setup();
  const principal=actor("org_owner",["WORKER"]);
  const detail=await repo.findById({...principal,runId:sample.id});
  const list=await repo.list(principal);
  assert.equal(detail.output,undefined);
  assert.equal(list[0].output,undefined);
  assert.equal(calls.filter(c=>c.kind==="job"||c.kind==="jobs").length,0);
});

test("OPS_ADMIN intentionally uses tenant-wide Job visibility policy", async () => {
  const {repo}=setup();
  const detail=await repo.findById({...actor("org_admin",["OPS_ADMIN"]),runId:sample.id});
  assert.ok(JSON.stringify(detail.output).includes("4800"));
});

test("cancel endpoint rejects unrelated org without mutating or revealing output", async () => {
  const {repo,getWrites}=setup();
  await assert.rejects(
    repo.cancel({...actor("org_other",["CLIENT"]),runId:sample.id}),
    (error:unknown)=>(error as {getStatus?:()=>number})?.getStatus?.()===404
  );
  assert.equal(getWrites(),0);
});
