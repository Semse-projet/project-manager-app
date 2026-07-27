import test from "node:test";
import assert from "node:assert/strict";
import { MarketplaceService } from "../dist/modules/marketplace/marketplace.service.js";

// A CLIENT browsing the marketplace as a would-be contractor should never see
// (or be able to bid on) a job posted by their own org. See
// AUDIT_REMEDIATION_PLAN.md 1.5.

function createPrismaStub(jobs: Array<{ id: string; clientOrgId: string; category: string | null }>) {
  const calls: Array<{ method: string; where: unknown }> = [];
  return {
    calls,
    job: {
      async findMany({ where }: { where: Record<string, unknown> }) {
        calls.push({ method: "findMany", where });
        return jobs
          .filter((j) => !where.clientOrgId || j.clientOrgId !== (where.clientOrgId as { not: string }).not)
          .map((j) => ({
            id: j.id, title: `Job ${j.id}`, category: j.category, location: null,
            budgetType: null, budgetMin: null, budgetMax: null,
            status: "PUBLISHED", urgency: null, scope: "scope",
            createdAt: new Date(), clientOrg: { name: "Org" }, bids: [],
          }));
      },
      async count({ where }: { where: Record<string, unknown> }) {
        calls.push({ method: "count", where });
        return jobs.filter((j) => !where.clientOrgId || j.clientOrgId !== (where.clientOrgId as { not: string }).not).length;
      },
    },
  };
}

void test("listOpenJobs excludes the caller's own org's jobs when excludeOrgId is given", async () => {
  const prisma = createPrismaStub([
    { id: "j1", clientOrgId: "org_mine", category: "painting" },
    { id: "j2", clientOrgId: "org_other", category: "painting" },
  ]);
  const service = new MarketplaceService(prisma as never);

  const result = await service.listOpenJobs({ tenantId: "tnt", excludeOrgId: "org_mine" });

  assert.equal(result.total, 1);
  assert.deepEqual(result.listings.map((l) => l.id), ["j2"]);
});

void test("listOpenJobs includes every job when excludeOrgId is omitted (backward compatible)", async () => {
  const prisma = createPrismaStub([
    { id: "j1", clientOrgId: "org_mine", category: "painting" },
    { id: "j2", clientOrgId: "org_other", category: "painting" },
  ]);
  const service = new MarketplaceService(prisma as never);

  const result = await service.listOpenJobs({ tenantId: "tnt" });

  assert.equal(result.total, 2);
});

void test("getStats excludes the caller's own org's jobs when excludeOrgId is given", async () => {
  const prisma = createPrismaStub([
    { id: "j1", clientOrgId: "org_mine", category: "painting" },
    { id: "j2", clientOrgId: "org_other", category: "plumbing" },
  ]);
  const service = new MarketplaceService(prisma as never);

  const stats = await service.getStats("tnt", "org_mine");

  assert.equal(stats.totalListings, 1);
  assert.deepEqual(stats.byCategory, { plumbing: 1 });
});
