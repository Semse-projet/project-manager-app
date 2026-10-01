import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildReconciliationReport } from "../dist/modules/payments/escrow-release.reconcile.js";
import { classifyStalePendingRelease } from "../dist/modules/payments/escrow-release.command.js";

const now = new Date("2026-10-01T12:00:00Z");
const mins = (m: number) => new Date(now.getTime() - m * 60_000);
const STALE = 30 * 60_000;

test("frontera de antiguedad: justo por debajo es fresh, a partir del limite es stale", () => {
  assert.equal(classifyStalePendingRelease({ providerRef: "pending_release_m_10000_a0", createdAt: mins(29) }, now, STALE), "fresh");
  assert.equal(classifyStalePendingRelease({ providerRef: "pending_release_m_10000_a0", createdAt: mins(30) }, now, STALE), "stale_no_provider_ref");
});

test("informe: separa 'sin providerRef' (resultado desconocido) de 'esperando webhook'", () => {
  const r = buildReconciliationReport(
    [
      { id: "t1", milestoneId: "m1", providerRef: "pending_release_m1_10000_a0", amount: 100, createdAt: mins(120) },
      { id: "t2", milestoneId: "m2", providerRef: "po_abc", amount: 50, createdAt: mins(45) },
      { id: "t3", milestoneId: "m3", providerRef: "pending_release_m3_500_k_x", amount: 5, createdAt: mins(5) }, // fresh
    ],
    now,
    STALE,
  );
  assert.equal(r.total, 2);
  assert.deepEqual(r.counts, { stale_no_provider_ref: 1, stale_awaiting_webhook: 1 });
  assert.deepEqual(r.items.map((i) => i.transactionId), ["t1", "t2"], "mas antiguo primero");
  const unknown = r.items[0];
  assert.equal(unknown.providerSearchKey, "pending_release_m1_10000_a0");
  assert.equal(unknown.providerRef, null);
  assert.match(unknown.action, /No reintentar el milestone/);
  const waiting = r.items[1];
  assert.equal(waiting.providerRef, "po_abc");
  assert.equal(waiting.providerSearchKey, null);
  assert.equal(waiting.ageMinutes, 45);
});

test("informe vacio cuando no hay PENDING estancados", () => {
  const r = buildReconciliationReport([{ id: "t", milestoneId: "m", providerRef: "po_1", amount: 1, createdAt: mins(1) }], now, STALE);
  assert.equal(r.total, 0);
  assert.deepEqual(r.items, []);
});

test("el script del informe es SOLO LECTURA (sin create/update/delete/upsert ni llamadas al proveedor)", () => {
  const src = readFileSync(new URL("../../../scripts/maintenance/release-reconcile-report.mjs", import.meta.url), "utf8");
  assert.ok(!/\.(create|update|updateMany|delete|deleteMany|upsert|createMany)\s*\(/.test(src));
  assert.ok(!/\$executeRaw|\$queryRaw|stripe|paypal|adyen/i.test(src));
  assert.match(src, /findMany/);
});
