import test from "node:test";
import assert from "node:assert/strict";
import { AgentsService } from "../dist/modules/agents/agents.service.js";
import { AgentsRepository } from "../dist/modules/agents/agents.repository.js";
import { DomainEventsRepository } from "../dist/modules/domain-events/domain-events.repository.js";
import { AgentDelegationRepository } from "../dist/modules/agents/agent-delegation.repository.js";

const actor = {
  tenantId: "tenant_qa", orgId: "org_service_worker", userId: "usr_worker",
  runId: "run_owner", workerId: "worker_qa", expectedAttempts: 1,
  requestId: "req_qa", verifiedWorkerClaim: true,
};

test("#1153: signed worker completion assigns approvals and audit to persisted run owner", async () => {
  const auditOrgs: string[] = [];
  const approvalOrgs: string[] = [];
  const run = {
    id: actor.runId, tenantId: actor.tenantId, orgId: "org_real_owner",
    agentType: "pricing", triggerType: "manual", input: {}, output: { summary: "ok" },
  };
  const service = new AgentsService(
    { async complete() { return run; } } as never,
    { async append(entry: { orgId: string }) { auditOrgs.push(entry.orgId); } } as never,
    {} as never,
    { async register(input: { orgId: string }) { approvalOrgs.push(input.orgId); return [{ id: "apr_qa" }]; } } as never,
    {} as never, {} as never, {} as never, {} as never,
  );
  await service.complete({ ...actor, output: { approvals: [{ id: "apr_qa" }] } });
  assert.deepEqual(approvalOrgs, ["org_real_owner"]);
  assert.deepEqual(auditOrgs, ["org_real_owner"]);
});

test("#1153: an unclassified legacy run cannot produce approvals under the service org", async () => {
  let changed = 0;
  const now = new Date();
  const repo = new AgentsRepository({
    agentRun: {
      async findFirst() {
        return { id: actor.runId, tenantId: actor.tenantId, orgId: null,
          agentType: "pricing", triggerType: "manual", status: "RUNNING",
          correlationId: "corr_qa", workerId: actor.workerId, attempts: 1,
          maxAttempts: 3, deadLettered: false, inputJson: {}, outputJson: null,
          startedAt: now, createdAt: now, updatedAt: now };
      },
      async updateMany() { changed++; return { count: 1 }; },
    },
  } as never, { async ensureActorContext() {} } as never);
  await assert.rejects(
    repo.complete({ ...actor, workerAccess: true, output: { approvals: [{ id: "unsafe" }] } }),
    (error: any) => error?.getStatus?.() === 409,
  );
  assert.equal(changed, 0, "no terminal DB update may occur for an unowned approval");
});


test("#1153: outbox correlation projection requires exact organization scope", async () => {
  const whereClauses: unknown[] = [];
  const repo = new DomainEventsRepository({
    domainOutboxEvent: {
      async findMany(input: { where: Record<string, unknown> }) {
        whereClauses.push(input.where);
        return [];
      },
    },
  } as never, { async ensureActorContext() {} } as never);
  await repo.listOutboxByCorrelationId({
    tenantId: actor.tenantId, orgId: "org_real_owner", userId: actor.userId,
    correlationId: "corr_shared_between_orgs",
  });
  assert.deepEqual(whereClauses, [{
    tenantId: actor.tenantId, orgId: "org_real_owner", correlationId: "corr_shared_between_orgs",
  }]);
});


test("#1153: delegation update is constrained by run id, tenant and persisted owner", async () => {
  const writes: any[] = [];
  const repo = new AgentDelegationRepository({ agentDelegation: {
    async update(input: unknown) { writes.push(input); return { id: "del_qa", projectId: null }; },
  } } as never);
  await repo.updateStatus("del_qa", actor.tenantId, "org_real_owner", actor.runId, "completed");
  assert.deepEqual(writes[0].where, {
    id: "del_qa", tenantId: actor.tenantId, orgId: "org_real_owner", targetRunId: actor.runId,
  });
});

test("#1153: worker completion uses run ownership for linked delegation effects", async () => {
  const calls: any[][] = [];
  const run = {
    id: actor.runId, tenantId: actor.tenantId, orgId: "org_real_owner",
    agentType: "pricing", triggerType: "event", input: { delegationId: "del_qa" }, output: {},
  };
  const service = new AgentsService(
    { async complete() { return run; } } as never,
    { async append() {} } as never, {} as never, {} as never,
    {} as never, {} as never, {} as never,
    { async updateStatus(...args: any[]) { calls.push(args); return { projectId: null }; } } as never,
  );
  await service.complete({ ...actor, output: {} });
  assert.deepEqual(calls[0]?.slice(0,5), [
    "del_qa", actor.tenantId, "org_real_owner", actor.runId, "completed",
  ]);
});
