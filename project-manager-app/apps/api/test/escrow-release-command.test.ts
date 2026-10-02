import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import {
  ReleaseAlreadyActiveError,
  ReleaseIdempotencyConflictError,
  classifyStalePendingRelease,
  isReleaseCommandEnabled,
  releaseRefBase,
  runEscrowRelease,
} from "../dist/modules/payments/escrow-release.command.js";

type Txn = { id: string; status: string; providerRef: string; milestoneId: string; amount: number };
type Outcome = any;

function harness(opts: { transfer?: (ref: string) => Promise<Outcome>; finalizeFails?: boolean } = {}) {
  const txns: Txn[] = [];
  const calls: string[] = [];
  const criticals: string[] = [];
  const ports = {
    async reserve(r: any) {
      calls.push("reserve");
      if (txns.some((t) => t.milestoneId === r.milestoneId && ["PENDING", "SUCCEEDED"].includes(t.status))) {
        throw new ReleaseAlreadyActiveError(r.milestoneId);
      }
      // PaymentTxn.providerRef es UNIQUE
      if (txns.some((t) => t.providerRef === r.providerRef)) throw Object.assign(new Error("unique providerRef"), { code: "P2002" });
      const t = { id: `tx${txns.length + 1}`, status: "PENDING", providerRef: r.providerRef, milestoneId: r.milestoneId, amount: r.amount };
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
    async findReleaseByRef(ref: string) {
      return txns.find((t) => t.providerRef === ref) ?? null;
    },
    async countFailedAttempts(prefix: string) {
      return txns.filter((t) => t.status === "FAILED" && t.providerRef.startsWith(prefix)).length;
    },
    async transfer(ref: string) {
      calls.push("transfer");
      return opts.transfer ? opts.transfer(ref) : { kind: "paid", providerRef: `po_${txns.length}` };
    },
    onCritical(m: string) { criticals.push(m); },
  };
  return { ports, txns, calls, criticals };
}
const input = { escrowId: "e1", milestoneId: "m1", amount: 100 };
const transfers = (h: { calls: string[] }) => h.calls.filter((c) => c === "transfer").length;

test("camino feliz: released, una transferencia, 1 txn SUCCEEDED", async () => {
  const h = harness();
  const r = await runEscrowRelease(h.ports, input);
  assert.equal(r.status, "released");
  assert.equal(r.replay, false);
  assert.deepEqual(h.calls, ["reserve", "transfer", "finalize:SUCCEEDED"]);
  assert.equal(h.txns[0].status, "SUCCEEDED");
});

test("identidad independiente de la fuente: manual + agente + auto => una sola transferencia", async () => {
  const h = harness();
  const manual = await runEscrowRelease(h.ports, input);
  const agent = await runEscrowRelease(h.ports, { ...input });
  const auto = await runEscrowRelease(h.ports, { ...input });
  assert.equal(manual.replay, false);
  assert.ok(agent.replay && auto.replay);
  assert.equal(transfers(h), 1);
  assert.equal(releaseRefBase("m1", 100), "pending_release_m1_10000");
});

test("importe distinto sobre un release activo => conflicto, no replay ni 2.a transferencia", async () => {
  const h = harness();
  await runEscrowRelease(h.ports, input);
  await assert.rejects(runEscrowRelease(h.ports, { ...input, amount: 250 }), ReleaseIdempotencyConflictError);
  assert.equal(transfers(h), 1);
});

test("concurrencia: dos releases simultaneos => una transferencia", async () => {
  const h = harness({ transfer: () => new Promise((res) => setTimeout(() => res({ kind: "paid", providerRef: "po1" }), 10)) });
  const [a, b] = await Promise.all([runEscrowRelease(h.ports, input), runEscrowRelease(h.ports, { ...input, idempotencyKey: "k2" })]);
  assert.equal(transfers(h), 1);
  assert.deepEqual([a.replay, b.replay].sort(), [false, true]);
});

test("proveedor en proceso: pending; reintento = replay pending", async () => {
  const h = harness({ transfer: async () => ({ kind: "processing", providerRef: "po_p" }) });
  const r = await runEscrowRelease(h.ports, input);
  assert.equal(r.status, "pending");
  assert.equal(h.txns[0].status, "PENDING");
  const again = await runEscrowRelease(h.ports, input);
  assert.equal(again.status, "pending");
  assert.equal(again.replay, true);
});

test("rechazo definitivo: failed, la reserva CONSERVA su referencia (no la cambia por la del proveedor)", async () => {
  const h = harness({ transfer: async () => ({ kind: "definitive_failure", message: "no payout method", providerRef: "po_x" }) });
  const r = await runEscrowRelease(h.ports, input);
  assert.equal(r.status, "failed");
  assert.equal(h.txns[0].status, "FAILED");
  assert.equal(h.txns[0].providerRef, "pending_release_m1_10000_a0");
});

test("MISMA clave explicita tras un FAILED definitivo: replay de failed, sin unique violation ni 2.a transferencia", async () => {
  const h = harness({ transfer: async () => ({ kind: "definitive_failure", message: "declined" }) });
  const first = await runEscrowRelease(h.ports, { ...input, idempotencyKey: "abc" });
  assert.equal(first.status, "failed");
  assert.equal(first.replay, false);
  const again = await runEscrowRelease(h.ports, { ...input, idempotencyKey: "abc" });
  assert.equal(again.status, "failed");
  assert.equal(again.replay, true);
  assert.equal(again.transactionId, first.transactionId);
  assert.equal(transfers(h), 1, "no debe volver a transferir");
  assert.equal(h.txns.length, 1);
});

test("otra clave explicita tras FAILED => intento nuevo legitimo", async () => {
  let ok = false;
  const h = harness({ transfer: async () => (ok ? { kind: "paid", providerRef: "po_ok" } : { kind: "definitive_failure", message: "declined" }) });
  await runEscrowRelease(h.ports, { ...input, idempotencyKey: "abc" });
  ok = true;
  const retry = await runEscrowRelease(h.ports, { ...input, idempotencyKey: "def" });
  assert.equal(retry.status, "released");
  assert.equal(retry.replay, false);
  assert.equal(transfers(h), 2);
});

test("sin clave tras FAILED: el reintento es un intento nuevo (a1) y repetirlo despues es replay", async () => {
  let ok = false;
  const h = harness({ transfer: async () => (ok ? { kind: "paid", providerRef: "po_ok" } : { kind: "definitive_failure", message: "declined" }) });
  await runEscrowRelease(h.ports, input); // a0 -> FAILED
  ok = true;
  const retry = await runEscrowRelease(h.ports, input); // a1 -> released
  assert.equal(retry.status, "released");
  assert.equal(h.txns[1].providerRef, "po_ok");
  const again = await runEscrowRelease(h.ports, input);
  assert.equal(again.replay, true);
  assert.equal(transfers(h), 2);
});

test("fallo AMBIGUO => unknown, reserva PENDING, bloquea doble pago", async () => {
  const h = harness({ transfer: async () => ({ kind: "ambiguous_failure", message: "ETIMEDOUT" }) });
  const r = await runEscrowRelease(h.ports, input);
  assert.equal(r.status, "unknown");
  assert.equal(h.txns[0].status, "PENDING");
  assert.equal(h.criticals.length, 1);
  assert.ok(!h.calls.some((c) => c.startsWith("finalize")));
  const again = await runEscrowRelease(h.ports, { ...input, idempotencyKey: "otra" });
  assert.equal(again.replay, true);
  assert.equal(transfers(h), 1);
});

test("si el puerto lanza (bug), se trata como ambiguo y no como FAILED", async () => {
  const h = harness({ transfer: async () => { throw new Error("boom"); } });
  const r = await runEscrowRelease(h.ports, input);
  assert.equal(r.status, "unknown");
  assert.equal(h.txns[0].status, "PENDING");
});

test("transferencia OK + fallo al finalizar => unknown con transferConfirmed", async () => {
  const h = harness({ finalizeFails: true });
  const r = await runEscrowRelease(h.ports, input);
  assert.equal(r.status, "unknown");
  assert.equal(r.transferConfirmed, true);
  assert.equal(h.criticals.length, 1);
});

test("Idempotency-Key invalida => 400 antes de tocar nada", async () => {
  const h = harness();
  await assert.rejects(runEscrowRelease(h.ports, { ...input, idempotencyKey: "con espacios!" }), BadRequestException);
  assert.deepEqual(h.calls, []);
});

test("flag: apagado por defecto; solo 'on' lo activa", () => {
  assert.equal(isReleaseCommandEnabled({} as never), false);
  assert.equal(isReleaseCommandEnabled({ PAYMENTS_RELEASE_COMMAND: "true" } as never), false);
  assert.equal(isReleaseCommandEnabled({ PAYMENTS_RELEASE_COMMAND: "on" } as never), true);
});

test("reconciliacion: clasifica RELEASE PENDING antiguos", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const old = new Date("2026-10-01T10:00:00Z");
  assert.equal(classifyStalePendingRelease({ providerRef: "pending_release_m_k", createdAt: now }, now, 60_000), "fresh");
  assert.equal(classifyStalePendingRelease({ providerRef: "pending_release_m_k", createdAt: old }, now, 60_000), "stale_no_provider_ref");
  assert.equal(classifyStalePendingRelease({ providerRef: "po_123", createdAt: old }, now, 60_000), "stale_awaiting_webhook");
});
