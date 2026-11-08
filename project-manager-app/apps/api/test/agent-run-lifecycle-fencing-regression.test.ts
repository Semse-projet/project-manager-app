import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, ForbiddenException } from "@nestjs/common";

import { assertAgentRunMutationAccess } from "../dist/modules/agents/agents.controller.js";
import { AgentsRepository } from "../dist/modules/agents/agents.repository.js";
import { AgentsService } from "../dist/modules/agents/agents.service.js";

test("WORKER cannot start, complete or fail without a paired worker attempt", () => {
  for (const value of [{}, { workerId: "w1" }, { expectedAttempts: 1 }]) {
    assert.throws(() => assertAgentRunMutationAccess(["WORKER"], value),
      (error: unknown) => error instanceof ForbiddenException || error instanceof BadRequestException);
  }
  assert.doesNotThrow(() => assertAgentRunMutationAccess(["WORKER"], { workerId: "w1", expectedAttempts: 1 }));
  assert.doesNotThrow(() => assertAgentRunMutationAccess(["OPS_ADMIN"], {}));
  assert.doesNotThrow(() => assertAgentRunMutationAccess(["ADMIN"], {}));
  assert.throws(() => assertAgentRunMutationAccess(["OPS_ADMIN"], {workerId:"w1"}), BadRequestException);
});

test("idempotent repository replays do not repeat service audits, approvals or summaries", async () => {
  let status = "RUNNING";
  let auditWrites = 0;
  let approvalWrites = 0;
  let delegatedWrites = 0;
  const now = new Date();
  const row = {
    id:"run_test", tenantId:"tenant_a", agentType:"prometeo",
    triggerType:"manual", inputJson:{}, status, correlationId:"corr_test",
    workerId:"worker_test", attempts:1, maxAttempts:3, deadLettered:false,
    outputJson:null, error:null, startedAt:now, heartbeatAt:now,
    endedAt:null, durationMs:null, toolCallCount:0, createdAt:now, updatedAt:now,
  };
  const repository = new AgentsRepository({
    agentRun: {
      async findFirst() { return { ...row, status }; },
    },
  } as never, { async ensureActorContext() {} } as never);
  const service = new AgentsService(
    repository,
    { async append() { auditWrites++; } } as never,
    {} as never,
    { async register() { approvalWrites++; return []; } } as never,
    {} as never, {} as never, {} as never,
    { async updateStatus() { delegatedWrites++; return {projectId:null}; } } as never,
  );
  const base = {
    tenantId:"tenant_a", orgId:"org_a", userId:"user_a", runId:"run_test",
    requestId:"req_test", workerId:"worker_test", expectedAttempts:1,
  };
  const started = await service.start(base);
  assert.equal(started.status, "running");
  status = "COMPLETED";
  const completed = await service.complete({ ...base, output: { approvals: [{type:"test"}] } });
  assert.equal(completed.status, "completed");
  status = "FAILED";
  const failed = await service.fail({ ...base, error:"duplicate failure" });
  assert.equal(failed.status, "failed");
  assert.equal(auditWrites, 0, "replays must not emit duplicate audit entries");
  assert.equal(approvalWrites, 0, "a completed replay must never register approvals again");
  assert.equal(delegatedWrites, 0, "replays must not close delegations again");
});

test("worker token cannot finalize an unowned manual run", async () => {
  const now = new Date();
  const repository = new AgentsRepository({
    agentRun: {
      async findFirst() {
        return {
          id:"manual", tenantId:"tenant_a", agentType:"prometeo", triggerType:"manual",
          inputJson:{}, status:"RUNNING", correlationId:"corr_manual", workerId:null,
          attempts:1, maxAttempts:3, deadLettered:false, outputJson:null, error:null,
          startedAt:now, heartbeatAt:now, endedAt:null, durationMs:null,
          toolCallCount:0, createdAt:now, updatedAt:now,
        };
      },
    },
  } as never, { async ensureActorContext() {} } as never);
  const actor = { tenantId:"tenant_a", orgId:"org_a", userId:"user_a", runId:"manual" };
  await assert.rejects(repository.complete({...actor, workerId:"forged", expectedAttempts:1}), 
    (error: unknown) => (error as {getStatus?:()=>number})?.getStatus?.() === 409);
});
