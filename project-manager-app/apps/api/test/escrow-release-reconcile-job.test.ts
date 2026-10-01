import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { EscrowReleaseReconcileService } from "../dist/modules/payments/escrow-release-reconcile.service.js";
import { EscrowReleaseReconcileController } from "../dist/modules/payments/escrow-release-reconcile.controller.js";

// ADR-041 2b — job del worker: detecta PENDING estancados, alerta y audita (append-only);
// NUNCA cambia estado ni reintenta dinero. La resolucion es humana.

const now = new Date("2026-10-01T12:00:00Z");
const mins = (m: number) => new Date(now.getTime() - m * 60_000);

function build(rows: Array<{ id: string; tenantId: string; milestoneId: string | null; providerRef: string; amount: number; createdAt: Date }>, alreadyAlerted: string[] = []) {
  const calls: string[] = [];
  const alerts: Array<{ tenantId: string; transactionId: string; payload: Record<string, unknown> }> = [];
  // El repositorio simulado SOLO expone lectura + auditoria: cualquier intento de
  // mutar PaymentTxn/Milestone/Escrow (finalize/releaseFunds/...) lanzaria TypeError.
  const repo = {
    async findStalePendingReleases(before: Date) {
      calls.push(`find:${before.toISOString()}`);
      return rows.filter((r) => r.createdAt < before);
    },
    async hasRecentReleaseReconcileAlert(id: string) { return alreadyAlerted.includes(id); },
    async recordReleaseReconcileAlert(input: { tenantId: string; transactionId: string; payload: Record<string, unknown> }) {
      calls.push(`audit:${input.transactionId}`);
      alerts.push(input);
    },
  };
  return { service: new EscrowReleaseReconcileService(repo as never), calls, alerts };
}

test("alerta y audita cada PENDING estancado, con tenant correcto; ignora los frescos", async () => {
  const { service, alerts } = build([
    { id: "t1", tenantId: "tenA", milestoneId: "m1", providerRef: "pending_release_m1_10000_a0", amount: 100, createdAt: mins(120) },
    { id: "t2", tenantId: "tenB", milestoneId: "m2", providerRef: "po_abc", amount: 50, createdAt: mins(45) },
    { id: "t3", tenantId: "tenA", milestoneId: "m3", providerRef: "pending_release_m3_500_a0", amount: 5, createdAt: mins(5) },
  ]);
  const r = await service.runCheck({ now });
  assert.equal(r.total, 2);
  assert.equal(r.alerted, 2);
  assert.equal(r.suppressed, 0);
  assert.deepEqual(alerts.map((a) => [a.transactionId, a.tenantId]), [["t1", "tenA"], ["t2", "tenB"]]);
  assert.equal(alerts[0].payload.classification, "stale_no_provider_ref");
  assert.equal(alerts[0].payload.providerSearchKey, "pending_release_m1_10000_a0");
  assert.equal(alerts[0].payload.alert, true);
});

test("no re-alerta el mismo caso dentro de la ventana (24 h): suprimido, sin nueva auditoria", async () => {
  const { service, alerts } = build(
    [{ id: "t1", tenantId: "tenA", milestoneId: "m1", providerRef: "pending_release_m1_10000_a0", amount: 100, createdAt: mins(120) }],
    ["t1"],
  );
  const r = await service.runCheck({ now });
  assert.equal(r.alerted, 0);
  assert.equal(r.suppressed, 1);
  assert.equal(alerts.length, 0);
});

test("sin estancados: informe vacio, sin alertas ni auditoria", async () => {
  const { service, alerts } = build([{ id: "t", tenantId: "tenA", milestoneId: "m", providerRef: "po_1", amount: 1, createdAt: mins(1) }]);
  const r = await service.runCheck({ now });
  assert.equal(r.total, 0);
  assert.equal(r.alerted, 0);
  assert.equal(alerts.length, 0);
});

test("SOLO LECTURA sobre dinero: el servicio solo usa find/has/record (el repo simulado no tiene mutadores)", async () => {
  const { service, calls } = build([{ id: "t1", tenantId: "tenA", milestoneId: "m1", providerRef: "pending_release_m1_10000_a0", amount: 100, createdAt: mins(120) }]);
  await service.runCheck({ now });
  assert.ok(calls.every((c) => c.startsWith("find:") || c.startsWith("audit:")));
  const src = readFileSync(new URL("../src/modules/payments/escrow-release-reconcile.service.ts", import.meta.url), "utf8");
  assert.ok(!/finalizeRelease|releaseFunds|refundFunds|\.release\(|createPayoutIntent|\.update\(|\.delete\(/.test(src), "el servicio no puede mutar ni reintentar pagos");
});

test("endpoint interno: exige permiso de operaciones (no publico) y devuelve el informe", async () => {
  assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, EscrowReleaseReconcileController.prototype.check), ["ops:dashboard:write"]);
  const { service } = build([]);
  const controller = new EscrowReleaseReconcileController(service);
  const res = await controller.check({ staleMinutes: 10 });
  assert.equal(res.data.total, 0);
});

test("worker: el timer esta detras de PAYMENTS_RECONCILE_ENABLED (off por defecto), cada 15 min, y solo llama al endpoint de comprobacion", () => {
  const src = readFileSync(new URL("../../worker/src/main.mjs", import.meta.url), "utf8");
  assert.match(src, /PAYMENTS_RECONCILE_ENABLED === "true"/);
  assert.match(src, /PAYMENTS_RECONCILE_INTERVAL_MS = 15 \* 60 \* 1_000/);
  const fn = src.slice(src.indexOf("async function runPaymentsReconcileSafe"), src.indexOf("async function runWeatherCheckSafe"));
  assert.match(fn, /\/v1\/admin\/payments\/release-reconcile\/check/);
  assert.ok(!/\/escrow\/release|\/refund|retry|createPayout/i.test(fn), "el job nunca reintenta ni libera dinero");
  assert.match(src, /clearInterval\(paymentsReconcileTimer\)/);
});
