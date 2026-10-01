import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import {
  evaluateRequiredEvidence,
  resolveEvidenceRevalidationMode,
  selfApprovalAllowedInSandbox,
} from "../dist/modules/milestones/evidence-readiness.js";
import { assertMilestoneApprovable } from "../dist/modules/milestones/milestones.policy.js";
import { PaymentsRepository } from "../dist/modules/payments/payments.repository.js";

// C18 — invariantes restantes: evidencia requerida validada (aprobar y reservar fondos),
// hito APPROVED revalidado dentro de la reserva, y sin auto-aprobacion en produccion.

const it = (status: string, required = true) => ({ required, status });

test("predicado unico: todo requisito `required` debe estar approved; submitted/archived/desconocido tambien bloquean", () => {
  assert.equal(evaluateRequiredEvidence([]).complete, true, "sin checklist no bloquea");
  assert.equal(evaluateRequiredEvidence([it("approved"), it("approved"), it("missing", false)]).complete, true, "los no requeridos no cuentan");
  assert.match(evaluateRequiredEvidence([it("missing")]).blockers[0], /missing/);
  assert.match(evaluateRequiredEvidence([it("rejected")]).blockers[0], /rejected/);
  assert.match(evaluateRequiredEvidence([it("submitted")]).blockers[0], /pending review/, "antes NO bloqueaba");
  assert.match(evaluateRequiredEvidence([it("archived")]).blockers[0], /archived/, "antes NO bloqueaba");
  assert.match(evaluateRequiredEvidence([it("weird")]).blockers.join(), /unknown state/);
  const mixed = evaluateRequiredEvidence([it("approved"), it("submitted"), it("missing")]);
  assert.equal(mixed.complete, false);
  assert.equal(mixed.blockers.length, 2);
  assert.deepEqual(mixed.counts, { required: 3, approved: 1, missing: 1, archived: 0, rejected: 0, submitted: 1 });
});

test("modos: enforce por defecto; shadow/off explicitos", () => {
  assert.equal(resolveEvidenceRevalidationMode({} as never), "enforce");
  assert.equal(resolveEvidenceRevalidationMode({ MILESTONE_EVIDENCE_REVALIDATION: "SHADOW" } as never), "shadow");
  assert.equal(resolveEvidenceRevalidationMode({ MILESTONE_EVIDENCE_REVALIDATION: "off" } as never), "off");
  assert.equal(resolveEvidenceRevalidationMode({ MILESTONE_EVIDENCE_REVALIDATION: "x" } as never), "enforce");
});

const baseSnapshot = {
  milestoneId: "m1", currentStatus: "submitted" as const, evidenceCount: 2,
  ownership: { clientOrgId: "org_client", assignedProOrgId: "org_pro" },
};
const client = { tenantId: "t", orgId: "org_client", userId: "u", roles: ["CLIENT"] };

test("aprobar con evidencia requerida sin validar => 409 con los blockers; con evidencia validada pasa", () => {
  const blocked = { ...baseSnapshot, evidenceBlockers: ["1 required evidence item(s) submitted — pending review"] };
  assert.throws(() => assertMilestoneApprovable(client, blocked), (e: Error) => e instanceof ConflictException && /not validated/.test(e.message));
  assert.doesNotThrow(() => assertMilestoneApprovable(client, { ...baseSnapshot, evidenceBlockers: [] }));
  assert.doesNotThrow(() => assertMilestoneApprovable(client, baseSnapshot), "snapshot sin dato de evidencia: no bloquea (compat)");
  // shadow / off no bloquean
  assert.doesNotThrow(() => assertMilestoneApprovable(client, blocked, { evidenceMode: "shadow" }));
  assert.doesNotThrow(() => assertMilestoneApprovable(client, blocked, { evidenceMode: "off" }));
});

test("auto-aprobacion: mismo org cliente==profesional => 403; OPS_ADMIN si; sandbox no-prod con flag explicito si; produccion nunca", () => {
  const same = { ...baseSnapshot, ownership: { clientOrgId: "org_x", assignedProOrgId: "org_x" } };
  const actor = { ...client, orgId: "org_x" };
  assert.throws(() => assertMilestoneApprovable(actor, same, { env: {} as never }), (e: Error) => e instanceof ForbiddenException && /self-approval/.test(e.message));
  assert.doesNotThrow(() => assertMilestoneApprovable({ ...actor, roles: ["OPS_ADMIN"] }, same, { env: {} as never }));
  assert.doesNotThrow(() => assertMilestoneApprovable(actor, same, { env: { MILESTONE_ALLOW_SELF_APPROVAL: "sandbox", NODE_ENV: "development" } as never }));
  assert.throws(() => assertMilestoneApprovable(actor, same, { env: { MILESTONE_ALLOW_SELF_APPROVAL: "sandbox", NODE_ENV: "production" } as never }), ForbiddenException);
  assert.equal(selfApprovalAllowedInSandbox({ MILESTONE_ALLOW_SELF_APPROVAL: "true", NODE_ENV: "development" } as never), false, "solo el valor 'sandbox'");
  // org distintos: aprobar normal
  assert.doesNotThrow(() => assertMilestoneApprovable(client, baseSnapshot, { env: {} as never }));
  // org vacia en ambos lados no cuenta como "mismo org" (no bloquea por esta regla; el acceso lo decide el rol)
  const emptyBoth = { ...baseSnapshot, ownership: { clientOrgId: "", assignedProOrgId: "" } };
  assert.throws(() => assertMilestoneApprovable({ ...client, orgId: "x" }, emptyBoth), ForbiddenException); // no es el cliente => 403 de acceso
});

// ── releaseFunds: revalida APPROVED + evidencia dentro de la misma transaccion ──
function reserveHarness(milestone: { status: string; evidenceItems: Array<{ required: boolean; status: string }> } | null) {
  const created: unknown[] = [];
  const tx = {
    milestone: { async findUnique() { return milestone; } },
    paymentEscrow: { async findUnique() { return { id: "e1", deletedAt: null }; } },
    paymentTxn: {
      async aggregate({ where }: any) {
        if (where.type === "DEPOSIT") return { _sum: { amount: { toNumber: () => 1000 } } };
        return { _sum: { amount: null } };
      },
      async findFirst() { return null; },
      async create({ data }: any) {
        created.push(data);
        return { id: "txn1", escrowId: "e1", milestoneId: data.milestoneId, type: "RELEASE", amount: { toNumber: () => data.amount }, status: "PENDING", createdAt: new Date(), escrow: { projectId: "p1", jobId: "j1", contractId: null, project: { tenantId: "t1" } } };
      },
    },
  };
  const prisma = { async $transaction(fn: (t: unknown) => Promise<unknown>) { return fn(tx); } };
  const repo = new PaymentsRepository(prisma as never, {} as never);
  return { repo, created };
}
const reserve = (repo: PaymentsRepository) => repo.releaseFunds({ escrowId: "e1", milestoneId: "m1", amount: 100, providerRef: "pending_release_m1_10000_a0" });

test("reservar fondos: hito no APPROVED (rechazado/enviado/inexistente) => 409 y no se crea la reserva", async () => {
  for (const status of ["REJECTED", "SUBMITTED", "DRAFT", "PAID"]) {
    const h = reserveHarness({ status, evidenceItems: [] });
    await assert.rejects(reserve(h.repo), (e: Error) => e instanceof ConflictException && /must be APPROVED/.test(e.message), status);
    assert.equal(h.created.length, 0);
  }
  const none = reserveHarness(null);
  await assert.rejects(reserve(none.repo), /not found/);
});

test("reservar fondos: evidencia requerida sin validar => 409 con blockers; validada => reserva; shadow/off no bloquean", async () => {
  const bad = reserveHarness({ status: "APPROVED", evidenceItems: [it("approved"), it("submitted")] });
  await assert.rejects(reserve(bad.repo), (e: Error) => e instanceof ConflictException && /not validated/.test(JSON.stringify((e as ConflictException).getResponse())));
  assert.equal(bad.created.length, 0);

  const good = reserveHarness({ status: "APPROVED", evidenceItems: [it("approved"), it("missing", false)] });
  const txn = await reserve(good.repo);
  assert.equal(txn.id, "txn1");
  assert.equal(good.created.length, 1);

  const prev = process.env.MILESTONE_EVIDENCE_REVALIDATION;
  try {
    for (const mode of ["shadow", "off"]) {
      process.env.MILESTONE_EVIDENCE_REVALIDATION = mode;
      const h = reserveHarness({ status: "APPROVED", evidenceItems: [it("submitted")] });
      assert.equal((await reserve(h.repo)).id, "txn1", mode);
    }
  } finally {
    if (prev === undefined) delete process.env.MILESTONE_EVIDENCE_REVALIDATION; else process.env.MILESTONE_EVIDENCE_REVALIDATION = prev;
  }
});
