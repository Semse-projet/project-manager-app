import test from "node:test";
import assert from "node:assert/strict";
import { ProjectsRepository } from "../dist/modules/projects/projects.repository.js";
import { buildProjectLifecycleProjection } from "../dist/modules/projects/project-lifecycle-projection.js";

const sourceUpdatedAt = new Date("2026-07-28T12:00:00.000Z");
const projection = buildProjectLifecycleProjection({
  project: {
    id: "proj_1",
    tenantId: "tenant_1",
    jobId: "job_1",
    title: "Kitchen remodel",
    jobStatus: "IN_PROGRESS",
    status: "in_progress",
    ownerOrgId: "org_pro_1",
    startAt: null,
    dueAt: null,
    deadline: null,
    acceptedBidCount: 1,
    contract: null,
    jobUpdatedAt: sourceUpdatedAt,
    createdAt: new Date("2026-07-20T00:00:00.000Z"),
    updatedAt: sourceUpdatedAt,
  },
  milestones: [],
  evidence: [],
  disputes: [],
  escrow: null,
  expenses: [],
  risk: null,
  now: new Date("2026-07-28T12:01:00.000Z"),
});

type PersistenceRepository = {
  persistLifecycleProjection(
    input: { tenantId: string; projectId: string },
    value: typeof projection,
  ): Promise<void>;
};

test("projection persistence uses revision and source timestamp compare-and-swap guards", async () => {
  const writes: Array<Record<string, unknown>> = [];
  const currentSourceUpdatedAt = new Date("2026-07-27T12:00:00.000Z");
  const prisma = {
    projectLifecycleProjection: {
      async findUnique() {
        return {
          id: "snapshot_1",
          revision: `project-lifecycle.v1:${"b".repeat(64)}`,
          sourceUpdatedAt: currentSourceUpdatedAt,
        };
      },
      async updateMany(input: Record<string, unknown>) {
        writes.push(input);
        return { count: 1 };
      },
      async create() {
        throw new Error("create must not be called when a snapshot exists");
      },
    },
  };
  const repository = new ProjectsRepository(prisma as never, {} as never) as unknown as PersistenceRepository;

  await repository.persistLifecycleProjection(
    { tenantId: "tenant_1", projectId: "proj_1" },
    projection,
  );

  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0]?.where, {
    id: "snapshot_1",
    projectId: "proj_1",
    revision: `project-lifecycle.v1:${"b".repeat(64)}`,
    sourceUpdatedAt: { lte: sourceUpdatedAt },
  });
  assert.equal((writes[0]?.data as { revision: string }).revision, projection.revision);
});

test("projection persistence is idempotent when the durable revision is current", async () => {
  let updateCount = 0;
  const prisma = {
    projectLifecycleProjection: {
      async findUnique() {
        return {
          id: "snapshot_1",
          revision: projection.revision,
          sourceUpdatedAt,
        };
      },
      async updateMany() {
        updateCount += 1;
        return { count: 1 };
      },
      async create() {
        throw new Error("create must not be called for a current snapshot");
      },
    },
  };
  const repository = new ProjectsRepository(prisma as never, {} as never) as unknown as PersistenceRepository;

  await repository.persistLifecycleProjection(
    { tenantId: "tenant_1", projectId: "proj_1" },
    projection,
  );

  assert.equal(updateCount, 0);
});

test("projection persistence never overwrites a snapshot from newer source data", async () => {
  let updateCount = 0;
  const prisma = {
    projectLifecycleProjection: {
      async findUnique() {
        return {
          id: "snapshot_1",
          revision: `project-lifecycle.v1:${"c".repeat(64)}`,
          sourceUpdatedAt: new Date("2026-07-29T12:00:00.000Z"),
        };
      },
      async updateMany() {
        updateCount += 1;
        return { count: 1 };
      },
      async create() {
        throw new Error("create must not be called when a snapshot exists");
      },
    },
  };
  const repository = new ProjectsRepository(prisma as never, {} as never) as unknown as PersistenceRepository;

  await repository.persistLifecycleProjection(
    { tenantId: "tenant_1", projectId: "proj_1" },
    projection,
  );

  assert.equal(updateCount, 0);
});

test("unauthorized organizations are rejected before financial sources or snapshots are touched", async () => {
  let financialReadCount = 0;
  let persistenceReadCount = 0;
  const forbiddenSource = {
    async findMany() {
      financialReadCount += 1;
      return [];
    },
    async findFirst() {
      financialReadCount += 1;
      return null;
    },
  };
  const transaction = {
    project: {
      async findFirst() {
        return {
          id: "proj_1",
          tenantId: "tenant_1",
          jobId: "job_1",
          assignedProOrgId: "org_pro_1",
          status: "IN_PROGRESS",
          startAt: null,
          dueAt: null,
          createdAt: sourceUpdatedAt,
          updatedAt: sourceUpdatedAt,
          job: {
            title: "Kitchen remodel",
            status: "IN_PROGRESS",
            deadline: null,
            clientOrgId: "org_client_1",
            updatedAt: sourceUpdatedAt,
            contract: null,
            bids: [],
          },
        };
      },
    },
    milestone: forbiddenSource,
    evidence: forbiddenSource,
    dispute: forbiddenSource,
    paymentEscrow: forbiddenSource,
    projectExpense: forbiddenSource,
    projectRiskScore: forbiddenSource,
  };
  const prisma = {
    async $transaction(callback: (client: typeof transaction) => Promise<unknown>) {
      return callback(transaction);
    },
    projectLifecycleProjection: {
      async findUnique() {
        persistenceReadCount += 1;
        return null;
      },
    },
  };
  const actorContext = {
    async ensureActorContext() {},
  };
  const repository = new ProjectsRepository(prisma as never, actorContext as never);

  await assert.rejects(
    () =>
      repository.getLifecycleProjection({
        tenantId: "tenant_1",
        orgId: "org_intruder",
        userId: "usr_intruder",
        roles: ["CLIENT"],
        projectId: "proj_1",
      }),
    /does not have access to project financials/,
  );

  assert.equal(financialReadCount, 0);
  assert.equal(persistenceReadCount, 0);
});

test("project lookup is tenant scoped and missing cross-tenant ids never persist", async () => {
  let lookupWhere: Record<string, unknown> | undefined;
  let persistenceReadCount = 0;
  const transaction = {
    project: {
      async findFirst(input: { where: Record<string, unknown> }) {
        lookupWhere = input.where;
        return null;
      },
    },
  };
  const prisma = {
    async $transaction(callback: (client: typeof transaction) => Promise<unknown>) {
      return callback(transaction);
    },
    projectLifecycleProjection: {
      async findUnique() {
        persistenceReadCount += 1;
        return null;
      },
    },
  };
  const actorContext = {
    async ensureActorContext() {},
  };
  const repository = new ProjectsRepository(prisma as never, actorContext as never);

  await assert.rejects(
    () =>
      repository.getLifecycleProjection({
        tenantId: "tenant_request",
        orgId: "org_client_1",
        userId: "usr_client_1",
        roles: ["CLIENT"],
        projectId: "proj_other_tenant",
      }),
    /not found/,
  );

  assert.equal(lookupWhere?.tenantId, "tenant_request");
  assert.equal(persistenceReadCount, 0);
});
