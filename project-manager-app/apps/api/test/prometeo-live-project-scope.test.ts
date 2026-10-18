import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { ResourceScopeResolver } from "../dist/common/resource-scope.resolver.js";
import { PrometeoAccessPolicy } from "../dist/modules/prometeo/prometeo-access.policy.js";
import { PrometeoDocumentGrantService } from "../dist/modules/prometeo/prometeo-document-grant.service.js";
import { PrometeoRepository } from "../dist/modules/prometeo/prometeo.repository.js";

const actor = { tenantId: "tenant-A", orgId: "org-A", userId: "user-A", roles: ["CLIENT"] };

test("Prometeo project listing demands a live job before accepting a project association", async () => {
  let projectFilter: Record<string, unknown> | undefined;
  const prisma = {
    project: {
      async findMany(args: { where: Record<string, unknown> }) {
        projectFilter = args.where;
        return []; // No live project: previously authorized ids are no longer returned.
      },
    },
    job: { async findMany() { return []; } },
  };
  const policy = new PrometeoAccessPolicy(new ResourceScopeResolver(prisma as never));
  const scope = await policy.listScope(actor as never);
  assert.deepEqual(projectFilter?.job, { deletedAt: null });
  assert.deepEqual(scope?.projectIds, []);
  assert.equal(scope?.orgId, "org-A");

  let where: Record<string, unknown> | undefined;
  const repo = new PrometeoRepository({
    prometeoDocument: { async findMany(args: { where: Record<string, unknown> }) {
      where = args.where; return [];
    } },
  } as never);
  await repo.listDocuments({ tenantId: actor.tenantId, scope });
  assert.deepEqual(where?.OR, [{ projectId: null, orgId: "org-A" }],
    "own unassociated documents remain readable; deleted-job projects grant no shared reads");
});

test("Prometeo project lookup requires a nondeleted linked job", async () => {
  const predicates: Array<Record<string, unknown>> = [];
  const prisma = {
    project: {
      async findFirst(args: { where: Record<string, unknown> }) {
        predicates.push(args.where);
        return null;
      },
    },
  };
  const policy = new PrometeoAccessPolicy(new ResourceScopeResolver(prisma as never));
  await assert.rejects(
    () => policy.assertProjectFilter(actor as never, "project-deleted"),
    (e: any) => e.getStatus?.() === 404,
  );
  assert.deepEqual(predicates, [{
    id: "project-deleted", tenantId: "tenant-A", job: { deletedAt: null },
  }]);
});

test("a grant cannot be created for a document whose project job is deleted", async () => {
  let transactionStarted = false;
  const prisma = {
    prometeoDocument: {
      async findFirst() {
        return { id: "doc-A", tenantId: "tenant-A", orgId: "org-A", projectId: "project-deleted" };
      },
    },
    async $transaction() { transactionStarted = true; },
  };
  const resolver = {
    async resolveProjectScope(_tenantId: string, _projectId: string, requireLiveJob: boolean) {
      assert.equal(requireLiveJob, true);
      return null;
    },
  };
  const service = new PrometeoDocumentGrantService(prisma as never, resolver as never);
  await assert.rejects(
    () => service.grant(actor as never, "doc-A", "org-B", "req-A"),
    (e: any) => e.getStatus?.() === 404,
  );
  assert.equal(transactionStarted, false);
});

test("default shared resolver behavior is unchanged for non-Prometeo callers", async () => {
  const predicates: Array<Record<string, unknown>> = [];
  const prisma = {
    project: {
      async findFirst(args: { where: Record<string, unknown> }) {
        predicates.push(args.where);
        return { tenantId: "tenant-A", assignedProOrgId: "org-B", job: { clientOrgId: "org-A" } };
      },
    },
  };
  const resolver = new ResourceScopeResolver(prisma as never);
  await resolver.resolveProjectScope("tenant-A", "project-A");
  await resolver.resolveProjectScope("tenant-A", "project-A", true);
  assert.deepEqual(predicates, [
    { id: "project-A", tenantId: "tenant-A" },
    { id: "project-A", tenantId: "tenant-A", job: { deletedAt: null } },
  ]);
});
