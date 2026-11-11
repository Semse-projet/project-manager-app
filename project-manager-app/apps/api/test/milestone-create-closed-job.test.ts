import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import { MilestonesRepository } from "../dist/modules/milestones/milestones.repository.js";

const actor = {
  tenantId: "tenant_1", projectId: "project_1", title: "Hito seguro",
  amount: 500, sequence: 1, userId: "user_client",
  orgId: "org_client", roles: ["CLIENT"],
};

function makeHarness(currentJobStatus: "CANCELLED" | "COMPLETED" | "POSTED") {
  let creates = 0;
  let locks = 0;
  let txDuplicateChecks = 0;
  const project = {
    id: "project_1", jobId: "job_1", assignedProOrgId: "org_pro",
    job: { clientOrgId: "org_client" },
  };
  const prisma = {
    project: { async findFirst() { return project; } },
    milestone: { async findFirst() { return null; } },
    async $transaction(fn: (tx: unknown) => Promise<unknown>) {
      return fn({
        async $queryRaw() {
          locks++;
          return [{ status: currentJobStatus }];
        },
        milestone: {
          async findFirst() { txDuplicateChecks++; return null; },
          async create({ data }: { data: Record<string, unknown> }) {
            creates++;
            return { id: "milestone_1", ...data, amount: { toNumber: () => 500 } };
          },
        },
      });
    },
  };
  return {
    repository: new MilestonesRepository(
      prisma as never,
      { async ensureActorContext() { /* permitted client */ } } as never,
    ),
    calls: () => ({ creates, locks, txDuplicateChecks }),
  };
}

async function withDatabase<T>(fn: () => Promise<T>): Promise<T> {
  const saved = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://mock:mock@localhost:5432/mock";
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
  }
}

test("cannot create milestone after job cancellation or completion", async () => withDatabase(async () => {
  for (const status of ["CANCELLED", "COMPLETED"] as const) {
    const h = makeHarness(status);
    await assert.rejects(
      h.repository.create(actor),
      (error: unknown) => error instanceof ConflictException && error.getStatus() === 409,
    );
    assert.deepEqual(h.calls(), {
      creates: 0, locks: 1, txDuplicateChecks: 0,
    }, "must reject while holding the job row before any milestone INSERT");
  }
}));

test("milestone creation on open job locks and checks sequence in same transaction", async () => withDatabase(async () => {
  const h = makeHarness("POSTED");
  const result = await h.repository.create(actor);
  assert.equal(result.id, "milestone_1");
  assert.equal(result.status, "draft");
  assert.deepEqual(h.calls(), { creates: 1, locks: 1, txDuplicateChecks: 1 });
}));
