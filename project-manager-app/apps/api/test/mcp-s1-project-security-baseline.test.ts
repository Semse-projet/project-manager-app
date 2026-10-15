import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ProjectsRepository } from "../dist/modules/projects/projects.repository.js";

/**
 * Security regression baseline for future S1 MCP integration.
 *
 * These tests exercise EXISTING SEMSE domain rules. No MCP transport, OAuth
 * bridge or production connector is implemented or claimed by this file.
 *
 * SDD: docs/specs/platform/semse-mcp-project-read.spec.md (REVIEW).
 * The existing GET/read path invokes ensureActorContext, whose upsert behavior
 * remains an explicit release blocker for the future MCP surface (D4).
 */

const project = {
  id: "project_a",
  tenantId: "tenant_one",
  jobId: "job_a",
  assignedProOrgId: "pro_a",
  status: "OPEN",
  job: { clientOrgId: "client_a" }
};

const actor = (orgId: string, roles: string[] = ["CLIENT"], tenantId = "tenant_one") => ({
  tenantId,
  orgId,
  userId: "user_a",
  roles,
  projectId: "project_a"
});

function fixture(result: unknown = project) {
  const reads: Array<Record<string, unknown>> = [];
  const bootstraps: unknown[] = [];
  const prisma = {
    project: {
      async findFirst(query: Record<string, unknown>) {
        reads.push(query);
        return result;
      }
    }
  };
  const actorContext = {
    async ensureActorContext(input: unknown) {
      bootstraps.push(input);
    }
  };
  return {
    repository: new ProjectsRepository(prisma as never, actorContext as never),
    reads,
    bootstraps
  };
}

test("MCP S1 prerequisite: read delegates to tenant-scoped project lookup, excludes soft-deleted jobs and returns canonical fields", async () => {
  const f = fixture();
  const got = await f.repository.findById(actor("client_a"));
  assert.deepEqual(got, {
    id: "project_a",
    tenantId: "tenant_one",
    jobId: "job_a",
    assignedProOrgId: "pro_a",
    status: "open"
  });
  assert.equal(f.reads.length, 1);
  assert.deepEqual(f.reads[0].where, {
    id: "project_a",
    tenantId: "tenant_one",
    job: { deletedAt: null }
  });
  assert.deepEqual(f.bootstraps, [actor("client_a")]);
  // Important: ProjectRecord is NOT an MCP public allowlist.
  // A future adapter MUST remove tenantId, assignedProOrgId and possibly jobId.
});

test("MCP S1 prerequisite: existing policy allows assigned PRO organization, not an arbitrary same-tenant organization", async () => {
  const authorized = fixture();
  assert.equal((await authorized.repository.findById(actor("pro_a", ["PRO"]))).status, "open");

  const foreignOrg = fixture();
  await assert.rejects(
    foreignOrg.repository.findById(actor("other_org", ["PRO"])),
    ForbiddenException
  );
  assert.equal(foreignOrg.reads.length, 1);
  // HTTP 403 is current domain behavior; MCP must map it to a non-enumerating tool error.
});

test("MCP S1 prerequisite: cross-tenant and deleted-job queries produce not found without returning data", async () => {
  const crossTenant = fixture(null); // DB enforces the WHERE clause; foreign resource is invisible.
  await assert.rejects(
    crossTenant.repository.findById(actor("client_a", ["CLIENT"], "tenant_two")),
    NotFoundException
  );
  assert.deepEqual(crossTenant.reads[0].where, {
    id: "project_a",
    tenantId: "tenant_two",
    job: { deletedAt: null }
  });

  const deletedJob = fixture(null); // Job has deletedAt != null, so the query returns null.
  await assert.rejects(
    deletedJob.repository.findById(actor("client_a")),
    NotFoundException
  );
  assert.deepEqual(deletedJob.reads[0].where, {
    id: "project_a",
    tenantId: "tenant_one",
    job: { deletedAt: null }
  });
});

test("MCP S1 prerequisite: OPS_ADMIN scope is confined by DB tenant filter", async () => {
  const sameTenant = fixture();
  assert.equal(
    (await sameTenant.repository.findById(actor("ops", ["OPS_ADMIN"]))).id,
    "project_a"
  );
  const otherTenant = fixture(null);
  await assert.rejects(
    otherTenant.repository.findById(actor("ops", ["OPS_ADMIN"], "tenant_two")),
    NotFoundException
  );
  assert.equal((otherTenant.reads[0].where as { tenantId: string }).tenantId, "tenant_two");
});

test("MCP S1 P0 baseline: current read invokes actor-context bootstrap BEFORE project lookup", async () => {
  let attempted = 0;
  let reads = 0;
  const repository = new ProjectsRepository(
    { project: { async findFirst() { reads += 1; return project; } } } as never,
    { async ensureActorContext() { attempted += 1; throw new Error("bootstrap unavailable"); } } as never
  );
  await assert.rejects(repository.findById(actor("client_a")), /bootstrap unavailable/);
  assert.equal(attempted, 1);
  assert.equal(reads, 0);
  // This is an AS-IS dependency, NOT proof of a side-effect-free GET.
  // Do not expose an OAuth-backed MCP route until D4 is resolved and
  // tests prove no unauthorized tenant/org/user upserts.
});

test("S1 prerequisite: PRO has general RBAC financial-read but domain policy denies unrelated client balances before payment query", async () => {
  let paymentReads = 0;
  const prisma = {
    project: {
      async findFirst() { return project; }
    },
    paymentTxn: {
      async findMany() { paymentReads += 1; return []; }
    }
  };
  const repository = new ProjectsRepository(prisma as never, {
    async ensureActorContext() {}
  } as never);

  await assert.rejects(
    repository.listPayments(actor("pro_a", ["PRO"])),
    ForbiddenException
  );
  assert.equal(paymentReads, 0, "financial rows cannot be queried before ownership policy");

  assert.deepEqual(await repository.listPayments(actor("client_a", ["CLIENT"])), []);
  assert.equal(paymentReads, 1);
});
