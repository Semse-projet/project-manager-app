import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import { MilestonesRepository } from "../dist/modules/milestones/milestones.repository.js";
import { assertMilestoneRejectable } from "../dist/modules/milestones/milestones.policy.js";

// C18 — las transiciones de hito son compare-and-set y un hito con payout activo
// no se puede rechazar. Antes: snapshot -> politica -> `update where id` sin
// condicion de estado (aprobar y rechazar concurrentes pasaban ambos), y
// rechazar un hito APPROVED con el auto-release en vuelo dejaba pagar un hito
// rechazado (finalizeRelease lo pone PAID igualmente).

type M = { id: string; projectId: string; title: string; sequence: number; status: string; amount: { toNumber(): number } };

function build(initialStatus: string, opts: { activeRelease?: boolean } = {}) {
  const row: M = { id: "m1", projectId: "p1", title: "Fase 1", sequence: 1, status: initialStatus, amount: { toNumber: () => 100 } };
  const withProject = () => ({ ...row, project: { jobId: "j1", assignedProOrgId: "org_pro", job: { clientOrgId: "org_client" } } });
  const prisma = {
    milestone: {
      async findFirst() { return withProject(); },
      async findUniqueOrThrow() { return { ...row }; },
      // `update where id` INCONDICIONAL: lo que usaba el codigo anterior (sin comparar estado).
      async update({ data }: { where: { id: string }; data: { status: string } }) {
        await Promise.resolve();
        row.status = data.status;
        return { ...row };
      },
      // updateMany condicional, como Postgres: solo cambia si el estado coincide.
      async updateMany({ where, data }: { where: { id: string; status: string }; data: { status: string } }) {
        await Promise.resolve(); // cede el turno: permite intercalar peticiones concurrentes
        if (row.id === where.id && row.status === where.status) { row.status = data.status; return { count: 1 }; }
        return { count: 0 };
      },
    },
    evidence: { async count() { return 3; } },
    milestoneEvidenceItem: { async findMany() { return []; } },
    paymentTxn: { async findFirst() { return opts.activeRelease ? { id: "txn_1" } : null; } },
  };
  const repo = new MilestonesRepository(prisma as never, { async ensureActorContext() {} } as never);
  return { repo, row };
}
const client = { tenantId: "t1", milestoneId: "m1", userId: "u_c", orgId: "org_client", roles: ["CLIENT"] };
const pro = { tenantId: "t1", milestoneId: "m1", userId: "u_p", orgId: "org_pro", roles: ["PRO"] };

async function withDb<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://unused";
  try { return await fn(); } finally { if (prev === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = prev; }
}

test("aprobar y rechazar CONCURRENTES: solo una gana, la otra recibe 409 y el estado final es el de la ganadora", () =>
  withDb(async () => {
    const { repo, row } = build("SUBMITTED");
    const results = await Promise.allSettled([
      repo.approve(client),
      repo.reject({ ...client, reason: "no cumple" }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const bad = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    assert.equal(ok.length, 1);
    assert.equal(bad.length, 1);
    assert.ok(bad[0].reason instanceof ConflictException);
    assert.match(String(bad[0].reason.message), /concurrently|cannot/);
    assert.ok(["APPROVED", "REJECTED"].includes(row.status));
  }));

test("doble aprobacion concurrente: una sola transicion (la segunda 409), sin eventos duplicados posibles", () =>
  withDb(async () => {
    const { repo, row } = build("SUBMITTED");
    const results = await Promise.allSettled([repo.approve(client), repo.approve(client)]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    assert.equal(row.status, "APPROVED");
  }));

test("aprobar desde SUBMITTED funciona y devuelve el hito aprobado", () =>
  withDb(async () => {
    const { repo } = build("SUBMITTED");
    const m = await repo.approve(client);
    assert.equal(m.status, "approved");
  }));

test("rechazar / pedir cambios un hito APPROVED con payout activo => 409 y el estado no cambia", () =>
  withDb(async () => {
    const { repo, row } = build("APPROVED", { activeRelease: true });
    await assert.rejects(repo.reject({ ...client, reason: "x" }), (e: Error) => e instanceof ConflictException && /escrow release/.test(e.message));
    await assert.rejects(repo.requestChanges({ ...client, reason: "x" }), ConflictException);
    assert.equal(row.status, "APPROVED");
  }));

test("rechazar un hito APPROVED SIN payout activo sigue permitido", () =>
  withDb(async () => {
    const { repo } = build("APPROVED", { activeRelease: false });
    const m = await repo.reject({ ...client, reason: "x" });
    assert.equal(m.status, "rejected");
  }));

test("politica: hasActiveRelease bloquea reject incluso para OPS_ADMIN", () => {
  const snapshot = {
    milestoneId: "m1", currentStatus: "approved" as const, evidenceCount: 1, hasActiveRelease: true,
    ownership: { clientOrgId: "org_client", assignedProOrgId: "org_pro" },
  };
  assert.throws(() => assertMilestoneRejectable({ tenantId: "t", orgId: "ops", userId: "u", roles: ["OPS_ADMIN"] }, snapshot), ConflictException);
  assert.doesNotThrow(() => assertMilestoneRejectable({ tenantId: "t", orgId: "org_client", userId: "u", roles: [] }, { ...snapshot, hasActiveRelease: false }));
});

test("el profesional sigue pudiendo entregar (submit) desde DRAFT con la transicion atomica", () =>
  withDb(async () => {
    const { repo, row } = build("DRAFT");
    const m = await repo.submit(pro);
    assert.equal(m.status, "submitted");
    assert.equal(row.status, "SUBMITTED");
  }));
