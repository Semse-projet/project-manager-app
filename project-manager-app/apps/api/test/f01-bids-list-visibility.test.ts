import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { BidsRepository } from "../dist/modules/bids/bids.repository.js";
import { OutboxRepository } from "../dist/modules/domain-events/outbox.repository.js";

// F01: only the owning CLIENT organization or tenant OPS_ADMIN may read all
// bids for a job. A PRO can see their own bids via /v1/my-bids.
// These are repository authorization tests, not JWT or production E2E.
const owner = {
  tenantId: "test_f01_tenantA",
  jobId: "test_f01_jobA",
  orgId: "test_f01_clientA",
  userId: "test_f01_client_user",
  roles: ["CLIENT"],
};

function harness(job: { clientOrgId: string } | null) {
  let bidReads = 0;
  let contextCalls = 0;
  const bid = {
    id: "test_f01_bidA", jobId: owner.jobId,
    proOrgId: "test_f01_professionalB", professionalUserId: "test_f01_pro_user",
    amount: { toNumber: () => 1200 }, etaDays: 5, status: "SUBMITTED",
    job: { id: owner.jobId, tenantId: owner.tenantId, status: "POSTED", clientOrgId: owner.orgId },
  };
  const prisma = {
    job: {
      async findFirst(args: { where: Record<string, unknown> }) {
        assert.equal(args.where.id, owner.jobId);
        assert.ok(args.where.tenantId);
        assert.equal(args.where.deletedAt, null);
        return job;
      },
    },
    bid: {
      async findMany(args: { where: { jobId: string; job: { tenantId: string; deletedAt: null } } }) {
        bidReads++;
        assert.equal(args.where.jobId, owner.jobId);
        assert.equal(args.where.job.tenantId, owner.tenantId);
        assert.equal(args.where.job.deletedAt, null);
        return [bid];
      },
    },
  };
  const actorContext = {
    async ensureActorContext() { contextCalls++; },
  };
  return {
    repo: new BidsRepository(prisma as never, actorContext as never, new OutboxRepository()),
    metrics: () => ({ bidReads, contextCalls }),
  };
}

test("F01-BID-L01 owning CLIENT can read competing offers for their own job", async () => {
  const { repo, metrics } = harness({ clientOrgId: owner.orgId });
  const bids = await repo.listByJob(owner);
  assert.equal(bids.length, 1);
  assert.equal(bids[0]?.id, "test_f01_bidA");
  assert.equal(metrics().bidReads, 1);
});

test("F01-BID-L02 another CLIENT organization cannot view a job's bids", async () => {
  const { repo, metrics } = harness({ clientOrgId: owner.orgId });
  await assert.rejects(() => repo.listByJob({ ...owner, orgId: "test_f01_otherClient" }), ForbiddenException);
  assert.equal(metrics().bidReads, 0);
});

test("F01-BID-L03 PRO role cannot view competitor bids on the all-bids route", async () => {
  const { repo, metrics } = harness({ clientOrgId: owner.orgId });
  await assert.rejects(() => repo.listByJob({ ...owner, roles: ["PRO"] }), ForbiddenException);
  assert.equal(metrics().bidReads, 0);
});

test("F01-BID-L04 WORKER role cannot view competitor bids", async () => {
  const { repo, metrics } = harness({ clientOrgId: owner.orgId });
  await assert.rejects(() => repo.listByJob({ ...owner, roles: ["WORKER"] }), ForbiddenException);
  assert.equal(metrics().bidReads, 0);
});

test("F01-BID-L05 tenant OPS_ADMIN can inspect bids for operations", async () => {
  const { repo, metrics } = harness({ clientOrgId: "test_f01_clientElsewhere" });
  const bids = await repo.listByJob({ ...owner, orgId: "test_f01_ops", roles: ["OPS_ADMIN"] });
  assert.equal(bids.length, 1);
  assert.equal(metrics().bidReads, 1);
});

test("F01-BID-L06 unknown, archived or foreign-tenant job cannot enumerate bids", async () => {
  const { repo, metrics } = harness(null);
  await assert.rejects(() => repo.listByJob(owner), NotFoundException);
  assert.equal(metrics().bidReads, 0);
});
