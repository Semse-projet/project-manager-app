import test from "node:test";
import assert from "node:assert/strict";

import { OperationalContextService } from "../dist/modules/ai-models/context/operational-context.service.js";

// Hallazgo 0.39: el bloque de trabajos del contexto operativo de Prometeo seguía el tenant completo para PRO/WORKER
// y para cualquier rol distinto de CLIENT. Ahora usa la misma regla de visibilidad que la API de trabajos (2.27).

type Where = Record<string, unknown>;

function makeService() {
  const jobWheres: Where[] = [];
  const projectionWheres: Where[] = [];
  const prisma = {
    job: {
      findMany: async ({ where }: { where: Where }) => {
        jobWheres.push(where);
        return [];
      },
      count: async () => 0,
    },
    jobsBidsProjection: {
      findMany: async ({ where }: { where: Where }) => {
        projectionWheres.push(where);
        return [];
      },
    },
    notification: { findMany: async () => [] },
    userProfile: { findUnique: async () => null },
    paymentEscrow: { findMany: async () => [], findUnique: async () => null },
    milestone: { findMany: async () => [] },
    dispute: { findMany: async () => [] },
    evidence: { findMany: async () => [] },
    workspaceMemoryEntry: { findFirst: async () => null },
    project: { findUnique: async () => null, findFirst: async () => null, findMany: async () => [] },
    operationalContextSnapshot: { create: async () => ({}), deleteMany: async () => ({ count: 0 }), findFirst: async () => null },
  };
  const service = new OperationalContextService(prisma as never);
  return { service, jobWheres, projectionWheres };
}

const T = "tenant_1";
const base = { tenantId: T, orgId: "org_1", userId: "u_1" };

async function jobsWhereFor(role: string, roles: string[]): Promise<Where> {
  const { service, jobWheres } = makeService();
  await service.buildContext({ ...base, role, roles });
  assert.equal(jobWheres.length, 1, "una sola consulta de trabajos");
  return jobWheres[0]!;
}

test("CLIENT: solo los trabajos de su organización cliente", async () => {
  const where = await jobsWhereFor("CLIENT", ["CLIENT"]);
  assert.equal(where.tenantId, T);
  assert.equal(where.clientOrgId, "org_1");
  assert.equal(where.deletedAt, null);
  assert.equal("OR" in where, false);
});

test("PRO y WORKER: publicados + aquellos en los que participan; nunca el tenant completo", async () => {
  for (const role of ["PRO", "WORKER"]) {
    const where = await jobsWhereFor(role, [role]);
    assert.equal(where.tenantId, T);
    assert.equal(where.deletedAt, null);
    assert.equal("clientOrgId" in where, false);
    const or = where.OR as Where[];
    assert.ok(Array.isArray(or) && or.length >= 5, `${role}: debe acotar con OR`);
    assert.deepEqual(or[0], { status: { in: ["POSTED", "PUBLISHED"] } });
    const text = JSON.stringify(or);
    assert.match(text, /"bids":\{"some":\{"professionalUserId":"u_1"\}\}/);
    assert.match(text, /assignedProOrgId":"org_1"/);
  }
});

test("OPS_ADMIN: todo el tenant (visibilidad operativa intencional) y respeta deletedAt", async () => {
  const where = await jobsWhereFor("OPS_ADMIN", ["OPS_ADMIN"]);
  assert.deepEqual(where, { tenantId: T, deletedAt: null });
});

test("OPS_ADMIN se reconoce por la lista completa de roles, no solo por el primero", async () => {
  const where = await jobsWhereFor("PRO", ["PRO", "OPS_ADMIN"]);
  assert.deepEqual(where, { tenantId: T, deletedAt: null });
});

test("un rol desconocido cae en el alcance de su organización (denegar por defecto), no en el tenant", async () => {
  const where = await jobsWhereFor("GUEST", ["GUEST"]);
  assert.equal(where.clientOrgId, "org_1");
  assert.equal("OR" in where, false);
});

async function withProjection<T>(run: () => Promise<T>): Promise<T> {
  const previous = { ...process.env };
  process.env.SEMSE_JOBS_PROJECTION_ENABLED = "true";
  process.env.SEMSE_JOBS_PROJECTION_CANARY_TENANT_IDS = "*";
  process.env.SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED = "true";
  try {
    return await run();
  } finally {
    for (const key of ["SEMSE_JOBS_PROJECTION_ENABLED", "SEMSE_JOBS_PROJECTION_CANARY_TENANT_IDS", "SEMSE_JOBS_PROJECTION_READTHROUGH_ENABLED"]) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test("proyección: PRO no la usa (solo guarda clientOrgId); CLIENT la filtra por su organización; OPS_ADMIN, por tenant", async () => {
  await withProjection(async () => {
    const pro = makeService();
    await pro.service.buildContext({ ...base, role: "PRO", roles: ["PRO"] });
    assert.deepEqual(pro.projectionWheres, [], "PRO no debe leer la proyección tenant-wide");
    assert.equal(pro.jobWheres.length, 1);

    const client = makeService();
    await client.service.buildContext({ ...base, role: "CLIENT", roles: ["CLIENT"] });
    assert.deepEqual(client.projectionWheres, [{ tenantId: T, clientOrgId: "org_1" }]);

    const admin = makeService();
    await admin.service.buildContext({ ...base, role: "OPS_ADMIN", roles: ["OPS_ADMIN"] });
    assert.deepEqual(admin.projectionWheres, [{ tenantId: T }]);

    const guest = makeService();
    await guest.service.buildContext({ ...base, role: "GUEST", roles: ["GUEST"] });
    assert.deepEqual(guest.projectionWheres, [{ tenantId: T, clientOrgId: "org_1" }]);
  });
});
