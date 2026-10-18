import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { ResourceScopeResolver } from "../dist/common/resource-scope.resolver.js";
import { PrometeoAccessPolicy } from "../dist/modules/prometeo/prometeo-access.policy.js";
import { PrometeoDocumentGrantService } from "../dist/modules/prometeo/prometeo-document-grant.service.js";
import { PrometeoRepository } from "../dist/modules/prometeo/prometeo.repository.js";
import { ProjectAccessService } from "../dist/modules/agents/project-access.service.js";

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

test("simultaneous duplicate document grants retry and remain idempotent without duplicate audit", async () => {
  let attempts = 0;
  let auditWrites = 0;
  const granted = { id: "grant-A", tenantId: "tenant-A", documentId: "doc-A", projectId: "project-A",
    recipientOrgId: "org-B", revokedAt: null };
  const tx = {
    prometeoDocument: { async findFirst() { return { id: "doc-A" }; } },
    prometeoDocumentGrant: {
      async findUnique() { return attempts === 1 ? null : granted; },
      async create() { throw Object.assign(new Error("unique constraint race"), { code: "P2002" }); },
    },
    auditLog: { async create() { auditWrites++; } },
  };
  const prisma = {
    prometeoDocument: { async findFirst() { return {
      id: "doc-A", tenantId: "tenant-A", orgId: "org-A", projectId: "project-A",
    }; } },
    async $transaction(fn: (client: typeof tx) => Promise<unknown>) {
      attempts++;
      return fn(tx);
    },
  };
  const resolver = { async resolveProjectScope() { return {
    clientOrgId: "org-A", assignedProOrgId: "org-B",
  }; } };
  const service = new PrometeoDocumentGrantService(prisma as never, resolver as never);
  const result = await service.grant(actor as never, "doc-A", "org-B", "req-duplicate");
  assert.equal(result.id, "grant-A");
  assert.equal(attempts, 2);
  assert.equal(auditWrites, 0, "retry must not duplicate the grant audit event");
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


test("project copilot can demand an active job without changing default project access", async () => {
  const calls: boolean[] = [];
  const resolver = {
    async resolveProjectScope(_tenant: string, _projectId: string, requireLiveJob = false) {
      calls.push(requireLiveJob);
      return requireLiveJob
        ? null
        : { tenantId: "tenant-A", clientOrgId: "org-A", assignedProOrgId: "org-B" };
    },
  };
  const access = new ProjectAccessService(resolver as never);
  await access.assertProjectAccess(actor as never, "project-archive");
  await assert.rejects(
    () => access.assertProjectAccess(actor as never, "project-archive", true),
    (e: any) => e.getStatus?.() === 404,
  );
  assert.deepEqual(calls, [false, true]);
});

test("active sharing grant for project A cannot be reported as active on reassigned project B", async () => {
  let auditWrites = 0;
  const doc = { id: "doc-A", tenantId: "tenant-A", orgId: "org-A", projectId: "project-B" };
  const tx = {
    prometeoDocument: { async findFirst() { return { id: doc.id }; } },
    prometeoDocumentGrant: {
      async findUnique() {
        return { id: "grant-old", tenantId: "tenant-A", documentId: doc.id,
          projectId: "project-A", recipientOrgId: "org-B", revokedAt: null };
      },
    },
    auditLog: { async create() { auditWrites++; } },
  };
  const prisma = {
    prometeoDocument: { async findFirst() { return doc; } },
    async $transaction(fn: (tx: unknown) => Promise<unknown>) { return fn(tx); },
  };
  const resolver = {
    async resolveProjectScope() {
      return { tenantId: "tenant-A", clientOrgId: "org-A", assignedProOrgId: "org-B" };
    },
  };
  const svc = new PrometeoDocumentGrantService(prisma as never, resolver as never);
  await assert.rejects(
    () => svc.grant(actor as never, doc.id, "org-B", "request-A"),
    (e: any) => e.getStatus?.() === 409,
  );
  assert.equal(auditWrites, 0, "a rejected stale grant must not claim a new authorization");
});
