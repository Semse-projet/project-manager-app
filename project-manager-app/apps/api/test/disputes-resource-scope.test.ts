import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { DisputesRepository } from "../dist/modules/disputes/disputes.repository.js";
import { ResourceScopeResolver } from "../dist/common/resource-scope.resolver.js";

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://stub:stub@127.0.0.1:1/stub";

// C51 etapa 3 (migración gradual): disputes resuelve el alcance con ResourceScopeResolver en lugar de su propio
// `toOwnership` sobre la consulta del proyecto. Además cierra un hueco: `submit-evidence` no comprobaba la
// participación en el proyecto (cualquier usuario del tenant con disputes:create podía adjuntar evidencia).

const PROJECTS = [
  { id: "p1", tenantId: "t1", clientOrgId: "org_client", assignedProOrgId: "org_pro" },
  { id: "p2", tenantId: "t1", clientOrgId: "org_client", assignedProOrgId: "org_pro" },
  { id: "p_t2", tenantId: "t2", clientOrgId: "org_client_t2", assignedProOrgId: "org_pro_t2" },
];
const DISPUTES = [
  { id: "d1", tenantId: "t1", projectId: "p1", status: "OPEN" },
  { id: "d_t2", tenantId: "t2", projectId: "p_t2", status: "OPEN" },
];

function build() {
  const writes: string[] = [];
  const wheres: unknown[] = [];
  const projectOf = (id: string) => PROJECTS.find((p) => p.id === id)!;
  const withProject = (d: (typeof DISPUTES)[number]) => {
    const p = projectOf(d.projectId);
    return { ...d, reason: "r", assigneeUserId: null, resolvedById: null, resolution: null, evidenceBundleIds: [], project: { jobId: "j", assignedProOrgId: p.assignedProOrgId, job: { clientOrgId: p.clientOrgId } } };
  };
  const prisma = {
    project: {
      findFirst: async ({ where }: { where: { id: string; tenantId: string } }) => {
        const p = PROJECTS.find((x) => x.id === where.id && x.tenantId === where.tenantId);
        return p ? { tenantId: p.tenantId, jobId: "j_" + p.id, assignedProOrgId: p.assignedProOrgId, job: { clientOrgId: p.clientOrgId } } : null;
      },
    },
    dispute: {
      findFirst: async ({ where }: { where: { id?: string; tenantId: string; status?: unknown } }) => {
        if (where.status) return null; // sin disputa abierta previa
        const d = DISPUTES.find((x) => x.id === where.id && x.tenantId === where.tenantId);
        return d ? withProject(d) : null;
      },
      findMany: async ({ where }: { where: unknown }) => (wheres.push(where), []),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        writes.push(`update:${where.id}`);
        return { ...withProject(DISPUTES.find((d) => d.id === where.id)!), ...data };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => (writes.push("create"), { id: "d_new", ...data }),
    },
    // create() opens the dispute in a transaction under the job row lock (#1111): open job.
    $queryRaw: async () => [{ status: "IN_PROGRESS" }],
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  const actorContext = { ensureActorContext: async () => {} };
  const repo = new DisputesRepository(prisma as never, actorContext as never, new ResourceScopeResolver(prisma as never));
  return { repo, writes, wheres };
}

const actor = (over: Record<string, unknown> = {}) => ({ tenantId: "t1", orgId: "org_client", userId: "u1", roles: ["CLIENT"], ...over });

test("submit-evidence: org cliente, profesional asignada y OPS_ADMIN del tenant pueden adjuntar", async () => {
  for (const a of [actor(), actor({ orgId: "org_pro", roles: ["PRO"] }), actor({ orgId: "org_ops", roles: ["OPS_ADMIN"] })]) {
    const { repo, writes } = build();
    const out = await repo.submitEvidence({ ...a, disputeId: "d1", evidenceIds: ["e1"] });
    assert.deepEqual(out.evidenceBundleIds, ["e1"]);
    assert.deepEqual(writes, ["update:d1"]);
  }
});

test("submit-evidence: otra org del mismo tenant u org vacía ⇒ 403 y sin escritura", async () => {
  for (const orgId of ["org_other", ""]) {
    const { repo, writes } = build();
    await assert.rejects(repo.submitEvidence({ ...actor({ orgId }), disputeId: "d1", evidenceIds: ["e1"] }), ForbiddenException);
    assert.deepEqual(writes, []);
  }
});

test("submit-evidence: disputa de otro tenant ⇒ 404 (también para OPS_ADMIN) y sin escritura", async () => {
  for (const a of [actor(), actor({ orgId: "org_client_t2" }), actor({ roles: ["OPS_ADMIN"] })]) {
    const { repo, writes } = build();
    await assert.rejects(repo.submitEvidence({ ...a, disputeId: "d_t2", evidenceIds: ["e1"] }), NotFoundException);
    assert.deepEqual(writes, []);
  }
});

test("create: participante crea; otra org u org vacía ⇒ 403; proyecto de otro tenant ⇒ 404", async () => {
  {
    const { repo, writes } = build();
    await repo.create({ ...actor({ orgId: "org_pro", roles: ["PRO"] }), projectId: "p2", reason: "x" });
    assert.deepEqual(writes, ["create"]);
  }
  for (const orgId of ["org_other", ""]) {
    const { repo, writes } = build();
    await assert.rejects(repo.create({ ...actor({ orgId }), projectId: "p2", reason: "x" }), ForbiddenException);
    assert.deepEqual(writes, []);
  }
  {
    const { repo, writes } = build();
    await assert.rejects(repo.create({ ...actor({ orgId: "org_client_t2" }), projectId: "p_t2", reason: "x" }), NotFoundException);
    assert.deepEqual(writes, []);
  }
});

test("resolve: cliente dueño cierra a favor del PRO; otra org u org vacía ⇒ 403; OPS_ADMIN resuelve; otro tenant ⇒ 404", async () => {
  {
    const { repo, writes } = build();
    await repo.resolve({ ...actor(), disputeId: "d1", resolution: "ok", resolutionType: "pro_favor" });
    assert.deepEqual(writes, ["update:d1"]);
  }
  for (const orgId of ["org_other", ""]) {
    const { repo, writes } = build();
    await assert.rejects(repo.resolve({ ...actor({ orgId }), disputeId: "d1", resolution: "x", resolutionType: "pro_favor" }), ForbiddenException);
    assert.deepEqual(writes, []);
  }
  {
    const { repo, writes } = build();
    await repo.resolve({ ...actor({ orgId: "org_ops", roles: ["OPS_ADMIN"] }), disputeId: "d1", resolution: "x", resolutionType: "split" });
    assert.deepEqual(writes, ["update:d1"]);
  }
  {
    const { repo } = build();
    await assert.rejects(repo.resolve({ ...actor({ roles: ["OPS_ADMIN"] }), disputeId: "d_t2", resolution: "x", resolutionType: "split" }), NotFoundException);
  }
});

test("list: org vacía no concede (filtro imposible), una org normal filtra por cliente o profesional", async () => {
  const { repo, wheres } = build();
  await repo.list(actor({ orgId: "" }));
  await repo.list(actor());
  assert.deepEqual((wheres[0] as { id: unknown }).id, { in: [] });
  assert.ok(Array.isArray((wheres[1] as { OR: unknown[] }).OR));
});
