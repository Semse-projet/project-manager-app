import test from "node:test";
import assert from "node:assert/strict";
import { NotFoundException } from "@nestjs/common";
import { EvidenceRepository } from "../dist/modules/evidence/evidence.repository.js";

const project = {
  id: "projectA",
  jobId: "jobA",
  assignedProOrgId: "orgPro",
  job: { clientOrgId: "orgClient" },
};
const milestone = { id: "milestoneA", projectId: "projectA", project };

function harness() {
  let writes = 0;
  const prisma = {
    project: { findFirst: async () => project },
    milestone: { findFirst: async ({ where }: { where: Record<string, any> }) => {
      assert.equal(where.project.tenantId, "tenantA");
      assert.equal(where.project.job.deletedAt, null, "soft-deleted job must be filtered by DB query");
      return milestone;
    } },
    domainOutboxEvent: { findUnique: async () => null },
    $transaction: async () => { writes++; throw new Error("MISMATCH MUST NOT WRITE"); },
  };
  const actors = { ensureActorContext: async () => undefined };
  const repo = new EvidenceRepository(prisma as never, actors as never, {} as never);
  return { repo, get writes() { return writes; } };
}

const base = {
  tenantId: "tenantA",
  orgId: "orgPro",
  userId: "userA",
  roles: ["PRO"],
  requestId: "capture-consistency-1",
  key: "tenants/tenantA/public-intake/evidence/capture.jpg",
  kind: "PHOTO" as const,
};

async function assertScopeRejected(command: Record<string, unknown>) {
  const h = harness();
  await assert.rejects(
    () => h.repo.create({ ...base, ...command }),
    (e: unknown) => e instanceof NotFoundException && e.getStatus() === 404,
  );
  assert.equal(h.writes, 0, "scope contradiction must fail before Evidence or outbox insert");
}

test("Evidence forbids jobId A paired with an existing milestone from job B", async () => {
  await assertScopeRejected({ jobId: "jobB", milestoneId: "milestoneA" });
});

test("Evidence forbids projectId A paired with a milestone from project B", async () => {
  await assertScopeRejected({ projectId: "projectB", milestoneId: "milestoneA" });
});

test("Evidence forbids jobId A paired with projectId B", async () => {
  await assertScopeRejected({ projectId: "projectA", jobId: "jobB" });
});

test("matching explicit IDs still resolve to the canonical project and job", async () => {
  const h = harness();
  const scopeResolver = h.repo as unknown as {
    resolveScope(input: Record<string, unknown>): Promise<{ projectId: string; jobId: string; milestoneId?: string }>;
  };
  const p = await scopeResolver.resolveScope({ ...base, projectId: "projectA", jobId: "jobA" });
  assert.equal(p.projectId, "projectA");
  assert.equal(p.jobId, "jobA");
  const m = await scopeResolver.resolveScope({ ...base, projectId: "projectA", jobId: "jobA", milestoneId: "milestoneA" });
  assert.equal(m.milestoneId, "milestoneA");
  assert.equal(h.writes, 0);
});
