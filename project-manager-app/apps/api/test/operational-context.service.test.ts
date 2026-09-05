import test from "node:test";
import assert from "node:assert/strict";

import { OperationalContextService } from "../dist/modules/ai-models/context/operational-context.service.js";

function makePrisma(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, number> = {};
  const count = (name: string) => {
    calls[name] = (calls[name] ?? 0) + 1;
  };

  const base = {
    job: {
      findMany: async () => {
        count("job.findMany");
        return [];
      },
      count: async () => {
        count("job.count");
        return 0;
      },
    },
    jobsBidsProjection: {
      findMany: async () => {
        count("jobsBidsProjection.findMany");
        return [];
      },
    },
    notification: { findMany: async () => [] },
    userProfile: { findUnique: async () => null },
    paymentEscrow: { findMany: async () => [], findUnique: async () => null },
    milestone: { findMany: async () => [] },
    dispute: { findMany: async () => [] },
    evidence: { findMany: async () => [] },
    project: { findUnique: async () => null },
    workspaceMemoryEntry: { findFirst: async () => null },
    operationalContextSnapshot: {
      create: async () => ({}),
      deleteMany: async () => {
        count("operationalContextSnapshot.deleteMany");
        return { count: 0 };
      },
      findFirst: async () => null,
    },
  };

  return { prisma: { ...base, ...overrides }, calls };
}

function makeSseBus() {
  const emitted: Array<{ channel: string; event: string; payload: unknown }> = [];
  return {
    emitted,
    emit(channel: string, event: string, payload: unknown) {
      emitted.push({ channel, event, payload });
    },
  };
}

const baseInput = { tenantId: "tenant_1", orgId: "org_1", userId: "user_1", role: "CLIENT" };

test("buildContext caches within the TTL and does not re-query on a second call with the same key", async () => {
  const { prisma, calls } = makePrisma();
  const service = new OperationalContextService(prisma as never);

  await service.buildContext(baseInput);
  await service.buildContext(baseInput);

  assert.equal(calls["job.findMany"], 1);
});

test("invalidateScope(tenant) clears every cached key for that tenant", async () => {
  const { prisma, calls } = makePrisma();
  const service = new OperationalContextService(prisma as never);

  await service.buildContext(baseInput);
  await service.buildContext({ ...baseInput, userId: "user_2" });
  assert.equal(calls["job.findMany"], 2);

  service.invalidateScope({ tenantId: "tenant_1", source: "test" });

  await service.buildContext(baseInput);
  await service.buildContext({ ...baseInput, userId: "user_2" });
  assert.equal(calls["job.findMany"], 4);
});

test("invalidateScope(user) only clears that user's cached keys, leaving other users cached", async () => {
  const { prisma, calls } = makePrisma();
  const service = new OperationalContextService(prisma as never);

  await service.buildContext(baseInput);
  await service.buildContext({ ...baseInput, userId: "user_2" });
  assert.equal(calls["job.findMany"], 2);

  service.invalidateScope({ tenantId: "tenant_1", userId: "user_1", source: "test" });

  await service.buildContext(baseInput); // re-queries, was invalidated
  await service.buildContext({ ...baseInput, userId: "user_2" }); // still cached
  assert.equal(calls["job.findMany"], 3);
});

test("invalidateScope emits an SSE context-update on the tenant channel, and additionally on the project channel when scoped to a project", async () => {
  const { prisma } = makePrisma();
  const sseBus = makeSseBus();
  const service = new OperationalContextService(prisma as never, undefined, sseBus as never);

  service.invalidateScope({ tenantId: "tenant_1", source: "test" });
  assert.deepEqual(
    sseBus.emitted.map((e) => e.channel),
    ["context:tenant_1:tenant"],
  );

  sseBus.emitted.length = 0;
  service.invalidateScope({ tenantId: "tenant_1", projectId: "project_1", source: "test" });
  assert.deepEqual(
    sseBus.emitted.map((e) => e.channel),
    ["context:tenant_1:tenant", "context:tenant_1:project:project_1"],
  );
});

test("jobs read-through uses the projection once it has caught up with the direct row count, scoped by clientOrgId for a CLIENT actor", async () => {
  const { prisma } = makePrisma({
    job: {
      findMany: async () => {
        throw new Error("direct query must not run once the projection is trusted");
      },
      count: async () => 1,
    },
    jobsBidsProjection: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        assert.equal(args.where.tenantId, "tenant_1");
        assert.equal(args.where.clientOrgId, "org_1");
        return [
          { snapshotJson: { job: { id: "job_1", title: "From projection", status: "ACCEPTED" } } },
        ];
      },
    },
  });
  process.env.SEMSE_JOBS_PROJECTION_ENABLED = "true";
  process.env.SEMSE_JOBS_PROJECTION_CANARY_TENANT_IDS = "tenant_1";
  process.env.SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED = "true";
  try {
    const service = new OperationalContextService(prisma as never);
    const ctx = await service.buildContext(baseInput);
    assert.deepEqual(ctx.jobs.recent, [{ id: "job_1", title: "From projection", status: "ACCEPTED" }]);
  } finally {
    delete process.env.SEMSE_JOBS_PROJECTION_ENABLED;
    delete process.env.SEMSE_JOBS_PROJECTION_CANARY_TENANT_IDS;
    delete process.env.SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED;
  }
});

test("jobs read-through falls back to the direct query when the projection query throws", async () => {
  const { prisma } = makePrisma({
    job: {
      findMany: async () => [{ id: "job_1", title: "From direct query", status: "POSTED" }],
      count: async () => 1,
    },
    jobsBidsProjection: {
      findMany: async () => {
        throw new Error("simulated projection read failure");
      },
    },
  });
  process.env.SEMSE_JOBS_PROJECTION_ENABLED = "true";
  process.env.SEMSE_JOBS_PROJECTION_CANARY_TENANT_IDS = "tenant_1";
  process.env.SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED = "true";
  try {
    const service = new OperationalContextService(prisma as never);
    const ctx = await service.buildContext(baseInput);
    assert.deepEqual(ctx.jobs.recent, [{ id: "job_1", title: "From direct query", status: "POSTED" }]);
  } finally {
    delete process.env.SEMSE_JOBS_PROJECTION_ENABLED;
    delete process.env.SEMSE_JOBS_PROJECTION_CANARY_TENANT_IDS;
    delete process.env.SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED;
  }
});

test("jobs read-through falls back to the direct query while the projection is still backfilling (fewer rows than the tenant's real job count)", async () => {
  const { prisma } = makePrisma({
    job: {
      findMany: async () => [{ id: "job_1", title: "From direct query", status: "POSTED" }],
      count: async () => 5, // tenant has 5 jobs
    },
    jobsBidsProjection: {
      findMany: async () => [
        { snapshotJson: { job: { id: "job_1", title: "Stale/partial", status: "POSTED" } } },
      ], // only 1 job has been touched by an event so far
    },
  });
  process.env.SEMSE_JOBS_PROJECTION_ENABLED = "true";
  process.env.SEMSE_JOBS_PROJECTION_CANARY_TENANT_IDS = "tenant_1";
  process.env.SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED = "true";
  try {
    const service = new OperationalContextService(prisma as never);
    const ctx = await service.buildContext(baseInput);
    assert.deepEqual(ctx.jobs.recent, [{ id: "job_1", title: "From direct query", status: "POSTED" }]);
  } finally {
    delete process.env.SEMSE_JOBS_PROJECTION_ENABLED;
    delete process.env.SEMSE_JOBS_PROJECTION_CANARY_TENANT_IDS;
    delete process.env.SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED;
  }
});

test("jobs read-through never touches the projection table when the flags are off — the /prometeo/chat hard-fail path stays on the always-safe direct query", async () => {
  const { prisma, calls } = makePrisma();
  const service = new OperationalContextService(prisma as never);

  await assert.doesNotReject(() => service.buildContext(baseInput));
  assert.equal(calls["job.findMany"], 1);
  assert.equal(calls["jobsBidsProjection.findMany"], undefined);
});
