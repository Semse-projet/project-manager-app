import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, ConflictException, InternalServerErrorException } from "@nestjs/common";
import {
  ReleaseAlreadyActiveError,
  classifyStalePendingRelease,
  isDefinitiveProviderFailure,
  isReleaseCommandEnabled,
  releaseReservationRef,
  runEscrowRelease,
} from "../dist/modules/payments/escrow-release.command.js";

type Txn = { id: string; status: string; providerRef: string; milestoneId: string };

function harness(opts: { transfer?: () => Promise<any>; finalizeFails?: boolean } = {}) {
  const txns: Txn[] = [];
  const calls: string[] = [];
  const criticals: string[] = [];
  const ports = {
    async reserve(r: any) {
      calls.push("reserve");
      // misma garantia que el repositorio: 1 RELEASE activo por milestone
      if (txns.some((t) => t.milestoneId === r.milestoneId && ["PENDING", "SUCCEEDED"].includes(t.status))) {
        throw new ReleaseAlreadyActiveError(r.milestoneId);
      }
      if (txns.some((t) => t.providerRef === r.providerRef)) throw new Error("unique providerRef");
      const t = { id: `tx${txns.length + 1}`, status: "PENDING", providerRef: r.providerRef, milestoneId: r.milestoneId };
      txns.push(t);
      return { id: t.id };
    },
    async finalize(f: any) {
      calls.push(`finalize:${f.status ?? "pending"}`);
      if (opts.finalizeFails) throw new Error("db down");
      const t = txns.find((x) => x.id === f.transactionId)!;
      if (f.status) t.status = f.status;
      if (f.providerRef) t.providerRef = f.providerRef;
      return { id: t.id };
    },
    async findActiveRelease(milestoneId: string) {
      return txns.find((t) => t.milestoneId === milestoneId && ["PENDING", "SUCCEEDED"].includes(t.status)) ?? null;
    },
    async transfer(ref: string) {
      calls.push("transfer");
      return opts.transfer ? opts.transfer() : { status: "paid", providerRef: `po_${ref.length}` };
    },
    onCritical(m: string) { criticals.push(m); },
  };
  return { ports, txns, calls, criticals };
}
const input = { escrowId: "e1", milestoneId: "m1", amount: 100, idempotencyKey: "req1" };

test("camino feliz: released, una transferencia, milestone con 1 txn SUCCEEDED", async () => {
  const h = harness();
  const r = await runEscrowRelease(h.ports, input);
  assert.equal(r.status, "released");
  assert.equal(r.replay, false);
  assert.deepEqual(h.calls, ["reserve", "transfer", "finalize:SUCCEEDED"]);
  assert.equal(h.txns[0].status, "SUCCEEDED");
});

test("llamada repetida (misma clave u otra): una sola transferencia, devuelve el resultado de la primera", async () => {
  const h = harness();
  await runEscrowRelease(h.ports, input);
  const again = await runEscrowRelease(h.ports, input);
  const other = await runEscrowRelease(h.ports, { ...input, idempotencyKey: "req2" });
  assert.equal(again.replay, true);
  assert.equal(again.status, "released");
  assert.equal(other.replay, true);
  assert.equal(h.calls.filter((c) => c === "transfer").length, 1);
});

test("concurrencia: dos releases simultaneos => una transferencia", async () => {
  const h = harness({ transfer: () => new Promise((res) => setTimeout(() => res({ status: "paid", providerRef: "po1" }), 10)) });
  const [a, b] = await Promise.all([runEscrowRelease(h.ports, input), runEscrowRelease(h.ports, { ...input, idempotencyKey: "req2" })]);
  assert.equal(h.calls.filter((c) => c === "transfer").length, 1);
  assert.deepEqual([a.replay, b.replay].sort(), [false, true]);
});

test("proveedor en proceso: queda pending (webhook finaliza), reintento = replay pending", async () => {
  const h = harness({ transfer: async () => ({ status: "processing", providerRef: "po_p" }) });
  const r = await runEscrowRelease(h.ports, input);
  assert.equal(r.status, "pending");
  assert.equal(h.txns[0].status, "PENDING");
  const again = await runEscrowRelease(h.ports, input);
  assert.equal(again.status, "pending");
  assert.equal(again.replay, true);
});

test("rechazo definitivo 4xx => failed y la reserva se libera (permite reintento)", async () => {
  const h = harness({ transfer: async () => { throw new BadRequestException("bad payout method"); } });
  const r = await runEscrowRelease(h.ports, input);
  assert.equal(r.status, "failed");
  assert.equal(h.txns[0].status, "FAILED");
  const h2 = await runEscrowRelease({ ...h.ports, transfer: async () => ({ status: "paid", providerRef: "po2" }) }, { ...input, idempotencyKey: "req2" });
  assert.equal(h2.status, "released");
});

test("fallo AMBIGUO (timeout/5xx/red) => unknown, reserva sigue PENDING, bloquea doble pago", async () => {
  const h = harness({ transfer: async () => { throw new Error("ETIMEDOUT"); } });
  const r = await runEscrowRelease(h.ports, input);
  assert.equal(r.status, "unknown");
  assert.equal(h.txns[0].status, "PENDING");
  assert.equal(h.criticals.length, 1);
  assert.ok(!h.calls.some((c) => c.startsWith("finalize")), "no debe finalizar");
  // un reintento NO vuelve a transferir
  const again = await runEscrowRelease(h.ports, { ...input, idempotencyKey: "req2" });
  assert.equal(again.replay, true);
  assert.equal(h.calls.filter((c) => c === "transfer").length, 1);
});

test("transferencia OK + fallo al finalizar => unknown con transferConfirmed (no released:false, no silencio)", async () => {
  const h = harness({ finalizeFails: true });
  const r = await runEscrowRelease(h.ports, input);
  assert.equal(r.status, "unknown");
  assert.equal(r.transferConfirmed, true);
  assert.equal(h.criticals.length, 1);
});

test("clasificacion de errores del proveedor", () => {
  assert.equal(isDefinitiveProviderFailure(new BadRequestException("x")), true);
  assert.equal(isDefinitiveProviderFailure(new ConflictException("x")), true);
  assert.equal(isDefinitiveProviderFailure(new InternalServerErrorException("x")), false);
  assert.equal(isDefinitiveProviderFailure(new Error("socket hang up")), false);
  assert.equal(isDefinitiveProviderFailure(Object.assign(new Error("declined"), { definitive: true })), true);
});

test("flag: apagado por defecto; solo 'on' lo activa", () => {
  assert.equal(isReleaseCommandEnabled({} as never), false);
  assert.equal(isReleaseCommandEnabled({ PAYMENTS_RELEASE_COMMAND: "true" } as never), false);
  assert.equal(isReleaseCommandEnabled({ PAYMENTS_RELEASE_COMMAND: "on" } as never), true);
  assert.equal(releaseReservationRef("m", "k"), "pending_release_m_k");
});

test("reconciliacion: clasifica RELEASE PENDING antiguos", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const old = new Date("2026-10-01T10:00:00Z");
  assert.equal(classifyStalePendingRelease({ providerRef: "pending_release_m_k", createdAt: now }, now, 60_000), "fresh");
  assert.equal(classifyStalePendingRelease({ providerRef: "pending_release_m_k", createdAt: old }, now, 60_000), "stale_no_provider_ref");
  assert.equal(classifyStalePendingRelease({ providerRef: "po_123", createdAt: old }, now, 60_000), "stale_awaiting_webhook");
});
