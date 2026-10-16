import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ProjectsRepository } from "../dist/modules/projects/projects.repository.js";
import { ProjectsService } from "../dist/modules/projects/projects.service.js";

/**
 * S1/D4 isolated read-path regression — no MCP route or OAuth connection yet.
 * Caller MUST be a server-verified actor from the future D2 OAuth bridge.
 * Existing REST /v1/projects/:id must keep using the bootstrap-capable path.
 */
const stored = {
  id: "project-a",
  tenantId: "tenant-1",
  jobId: "job-a",
  assignedProOrgId: "pro-a",
  status: "IN_PROGRESS",
  job: { clientOrgId: "client-a" }
};

function actor(orgId = "client-a", roles = ["CLIENT"], tenantId = "tenant-1") {
  return { tenantId, orgId, userId: "user-a", roles, projectId: "project-a" };
}

function setup(record = stored) {
  const lookups = [];
  let upserts = 0;
  let writes = 0;
  const forbiddenWrite = () => { writes += 1; throw new Error("write attempted during status read"); };
  const makeWriteDenied = () => ({
    upsert: () => { upserts += 1; return forbiddenWrite(); },
    create: forbiddenWrite,
    createMany: forbiddenWrite,
    update: forbiddenWrite,
    updateMany: forbiddenWrite,
    delete: forbiddenWrite,
    deleteMany: forbiddenWrite
  });
  const prisma = {
    project: {
      async findFirst(query) { lookups.push(query); return record; },
      ...makeWriteDenied()
    },
    tenant: makeWriteDenied(),
    org: makeWriteDenied(),
    user: makeWriteDenied(),
    job: makeWriteDenied(),
    evidence: makeWriteDenied(),
    paymentTxn: makeWriteDenied(),
    paymentEscrow: makeWriteDenied()
  };
  let bootstrap = 0;
  const ctx = {
    async ensureActorContext() {
      bootstrap += 1;
      // Legacy calls still reach this method; future MCP status must not.
    }
  };
  const repository = new ProjectsRepository(prisma, ctx);
  const service = new ProjectsService(repository, {}, {}, {});
  return {
    repository,
    service,
    lookups,
    get bootstraps() { return bootstrap; },
    get writeAttempts() { return writes; },
    get upserts() { return upserts; }
  };
}

test("D4: status read for trusted actor returns only id/status without bootstrap or writes", async () => {
  const f = setup();
  const value = await f.service.statusForVerifiedActor(actor());
  assert.deepEqual(value, { projectId: "project-a", status: "in_progress" });
  assert.deepEqual(Object.keys(value).sort(), ["projectId", "status"]);
  assert.equal(f.bootstraps, 0);
  assert.equal(f.upserts, 0);
  assert.equal(f.writeAttempts, 0);
  assert.equal(f.lookups.length, 1);
  assert.deepEqual(f.lookups[0].where, {
    id: "project-a",
    tenantId: "tenant-1",
    job: { deletedAt: null }
  });
});

test("D4: client org and assigned PRO org can read, unrelated org cannot", async () => {
  const f = setup();
  assert.equal((await f.service.statusForVerifiedActor(actor("client-a", ["CLIENT"]))).status, "in_progress");
  assert.equal((await f.service.statusForVerifiedActor(actor("pro-a", ["PRO"]))).status, "in_progress");
  await assert.rejects(f.service.statusForVerifiedActor(actor("unrelated", ["PRO"])), ForbiddenException);
  assert.equal(f.bootstraps, 0);
  assert.equal(f.writeAttempts, 0);
});

test("D4: cross-tenant and soft-deleted Job remain invisible, including to OPS_ADMIN", async () => {
  const foreign = setup(null);
  await assert.rejects(foreign.service.statusForVerifiedActor(actor("ops", ["OPS_ADMIN"], "tenant-2")), NotFoundException);
  assert.deepEqual(foreign.lookups[0].where, {
    id: "project-a",
    tenantId: "tenant-2",
    job: { deletedAt: null }
  });
  assert.equal(foreign.bootstraps, 0);
  assert.equal(foreign.writeAttempts, 0);

  const deleted = setup(null);
  await assert.rejects(deleted.service.statusForVerifiedActor(actor()), NotFoundException);
  assert.equal(deleted.bootstraps, 0);
  assert.equal(deleted.writeAttempts, 0);
});

test("D4: existing REST service.detail retains canonical ProjectRecord and legacy bootstrap", async () => {
  const f = setup();
  const value = await f.service.detail(actor());
  assert.deepEqual(value, {
    id: "project-a",
    tenantId: "tenant-1",
    jobId: "job-a",
    assignedProOrgId: "pro-a",
    status: "in_progress"
  });
  assert.equal(f.bootstraps, 1);
  assert.equal(f.writeAttempts, 0);
  assert.equal(f.lookups.length, 1);
});

test("D4: repository direct read and status projection use one identical ownership policy", async () => {
  const f = setup();
  const row = await f.repository.findByIdWithoutProvisioning(actor("pro-a", ["PRO"]));
  const minimal = await f.service.statusForVerifiedActor(actor("pro-a", ["PRO"]));
  assert.deepEqual(minimal, { projectId: row.id, status: row.status });
  assert.equal(f.bootstraps, 0);
  assert.equal(f.writeAttempts, 0);
});
