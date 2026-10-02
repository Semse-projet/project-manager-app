import assert from "node:assert/strict";
import test from "node:test";

import { JobsRepository } from "../dist/modules/jobs/jobs.repository.js";

type JobWhere = Record<string, unknown> & {
  clientOrgId?: string;
  OR?: Array<Record<string, unknown>>;
  status?: unknown;
};

function createHarness(findFirstResults: unknown[] = []) {
  const wheres: JobWhere[] = [];
  const findFirstWheres: JobWhere[] = [];
  const prisma = {
    job: {
      async findMany({ where }: { where: JobWhere }) {
        wheres.push(where);
        return [];
      },
      async findFirst({ where }: { where: JobWhere }) {
        findFirstWheres.push(where);
        return findFirstResults.shift() ?? null;
      },
    },
  };
  const actorContext = {
    async ensureActorContext() {
      return undefined;
    },
  };

  return {
    repository: new JobsRepository(prisma as never, actorContext as never),
    wheres,
    findFirstWheres,
  };
}

test("jobs list scopes visibility by role and keeps PRO precedence for dual-role users (2.27)", async () => {
  const { repository, wheres } = createHarness();
  const base = {
    tenantId: "tenant_1",
    orgId: "org_1",
    userId: "user_1",
  };

  await repository.listByTenant({ ...base, roles: ["CLIENT"], status: "posted" });
  await repository.listByTenant({ ...base, roles: ["PRO"] });
  await repository.listByTenant({ ...base, roles: ["CLIENT", "PRO"] });
  await repository.listByTenant({ ...base, roles: ["OPS_ADMIN"] });
  await repository.listByTenant({ ...base, roles: ["UNKNOWN"] });

  assert.equal(wheres[0]?.tenantId, "tenant_1");
  assert.equal(wheres[0]?.clientOrgId, "org_1");
  assert.equal(wheres[0]?.status, "POSTED");

  for (const index of [1, 2]) {
    const proWhere = wheres[index];
    assert.ok(Array.isArray(proWhere?.OR), `call ${index} should use PRO visibility`);
    assert.deepEqual(proWhere.OR?.[0], { status: { in: ["POSTED", "PUBLISHED"] } });
    assert.match(JSON.stringify(proWhere.OR), /professionalUserId/);
    assert.match(JSON.stringify(proWhere.OR), /professionalOrgId/);
    assert.match(JSON.stringify(proWhere.OR), /assignedProOrgId/);
    assert.equal(proWhere.clientOrgId, undefined);
  }

  assert.equal(wheres[3]?.clientOrgId, undefined);
  assert.equal(wheres[3]?.OR, undefined);
  assert.equal(wheres[4]?.clientOrgId, "org_1");
});

test("job detail rejects an existing same-tenant job outside PRO visibility (2.27 IDOR)", async () => {
  const { repository, findFirstWheres } = createHarness([null, { id: "job_private" }]);

  await assert.rejects(
    repository.findVisibleById({
      tenantId: "tenant_1",
      orgId: "org_pro_1",
      userId: "user_pro_1",
      roles: ["PRO"],
      jobId: "job_private",
    }),
    /not visible/i,
  );

  assert.equal(findFirstWheres[0]?.tenantId, "tenant_1");
  assert.equal(findFirstWheres[0]?.id, "job_private");
  assert.deepEqual(findFirstWheres[0]?.OR?.[0], {
    status: { in: ["POSTED", "PUBLISHED"] },
  });
  assert.equal(findFirstWheres[1]?.OR, undefined);
});
