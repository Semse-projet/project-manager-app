import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  compareBidToBudget,
  selectJobBids,
  readBudgetJobs,
  readJobBids,
  formatBudgetAmount,
  formatBudgetRange,
  budgetBidStatusLabel,
  getBudgetLinks,
} from "../../apps/web/app/workspace/lib/budget-model.ts";

const job = { id: "job-a", title: "Trabajo sintético A", budgetMin: 100, budgetMax: 200, currency: "EUR" };
const bid = { id: "bid-a", jobId: "job-a", amount: 150, etaDays: 5, status: "submitted", currency: "EUR" };

test("compara solo propuestas recibidas del mismo Job y moneda explícita", () => {
  assert.deepEqual(compareBidToBudget(job, bid, "job-bids"), { available: true, position: "within", difference: 0, currency: "EUR" });
  assert.deepEqual(compareBidToBudget(job, { ...bid, amount: 80 }, "job-bids"), { available: true, position: "below", difference: -20, currency: "EUR" });
  assert.deepEqual(compareBidToBudget(job, { ...bid, amount: 230 }, "job-bids"), { available: true, position: "above", difference: 30, currency: "EUR" });
  assert.equal(compareBidToBudget(job, { ...bid, jobId: "job-b" }, "job-bids").reason, "different-job");
  assert.equal(compareBidToBudget(job, bid, "my-bids").reason, "wrong-source");
  assert.equal(compareBidToBudget(job, bid, "estimate").reason, "wrong-source");
});

test("no compara monedas diferentes, ausentes o inválidas ni las inventa", () => {
  assert.equal(compareBidToBudget(job, { ...bid, currency: "USD" }, "job-bids").reason, "different-currency");
  assert.equal(compareBidToBudget({ ...job, currency: undefined }, bid, "job-bids").reason, "missing-currency");
  assert.equal(compareBidToBudget(job, { ...bid, currency: undefined }, "job-bids").reason, "missing-currency");
  assert.equal(compareBidToBudget(job, { ...bid, currency: "$" }, "job-bids").reason, "missing-currency");
  assert.deepEqual(compareBidToBudget({ ...job, currency: "eur" }, { ...bid, currency: " eur " }, "job-bids"), { available: true, position: "within", difference: 0, currency: "EUR" });
  assert.equal(formatBudgetAmount(0), "0 · moneda no informada");
  assert.equal(formatBudgetAmount(150, "EUR"), "150 EUR");
  assert.equal(formatBudgetAmount(undefined), "Importe no informado");
});

test("sin rango completo no calcula diferencias y no sustituye estimados por presupuesto", () => {
  for (const range of [
    { budgetMin: undefined, budgetMax: undefined },
    { budgetMin: 100, budgetMax: undefined },
    { budgetMin: undefined, budgetMax: 200 },
    { budgetMin: 200, budgetMax: 100 },
    { budgetMin: Number.NaN, budgetMax: 200 },
    { budgetMin: -1, budgetMax: 200 },
  ]) assert.equal(compareBidToBudget({ ...job, ...range }, bid, "job-bids").reason, "missing-range");
  assert.equal(formatBudgetRange({ id: "j", title: "Trabajo" }), "Rango no informado");
  assert.match(formatBudgetRange({ ...job, budgetMax: undefined }), /Desde/);
  assert.match(formatBudgetRange({ ...job, budgetMin: undefined }), /Hasta/);
  assert.match(formatBudgetRange({ ...job, budgetMin: 200, budgetMax: 100 }), /Rango no válido/);
  assert.deepEqual(compareBidToBudget({ ...job, budgetMin: 0, budgetMax: 0 }, { ...bid, amount: 0 }, "job-bids"), { available: true, position: "within", difference: 0, currency: "EUR" });
});

test("rechaza importes no finitos sin convertirlos en dinero cero", () => {
  for (const amount of [undefined, Number.NaN, Infinity, -1]) {
    assert.equal(compareBidToBudget(job, { ...bid, amount }, "job-bids").reason, "missing-amount");
  }
});

test("el filtro de comparación no mezcla Job ni propuestas propias", () => {
  const other = { ...bid, id: "bid-b", jobId: "job-b" };
  assert.deepEqual(selectJobBids("job-a", [bid, other], "job-bids"), [bid]);
  assert.deepEqual(selectJobBids("job-a", [bid, other], "my-bids"), []);
  assert.deepEqual(selectJobBids("", [bid], "job-bids"), []);
});

test("consume arrays ya desempaquetados, sin aplanar contratos anidados desconocidos", () => {
  assert.deepEqual(readBudgetJobs([job]), [job]);
  assert.deepEqual(readJobBids([bid], "job-a"), [bid]);
  assert.throws(() => readBudgetJobs({ data: [job] }), /contrato/i);
  assert.throws(() => readBudgetJobs([{ job }]), /contrato/i);
  assert.throws(() => readJobBids({ bids: [bid] }, "job-a"), /contrato/i);
  assert.throws(() => readJobBids([{ ...bid, jobId: "job-b" }], "job-a"), /trabajo/i);
  assert.throws(() => readJobBids([{ bidId: "old-shape" }], "job-a"), /contrato/i);
});

test("estado desconocido no se presenta como enviada o aceptada", () => {
  assert.equal(budgetBidStatusLabel("accepted"), "Aceptada");
  assert.equal(budgetBidStatusLabel("submitted"), "Recibida · pendiente");
  assert.equal(budgetBidStatusLabel("unexpected"), "Estado no reconocido (unexpected)");
});

test("enlaces por rol: desconocido cerrado y profesional solo propias", () => {
  assert.deepEqual(getBudgetLinks(null), []);
  assert.deepEqual(getBudgetLinks("unknown" as never), []);
  const workerLinks = getBudgetLinks("worker");
  assert.ok(workerLinks.some((link) => link.href === "/worker/bids"));
  assert.ok(!workerLinks.some((link) => link.href.startsWith("/client") || link.href.startsWith("/admin")));
  assert.ok(getBudgetLinks("client").some((link) => link.href === "/client/protools"));
  assert.ok(getBudgetLinks("admin").some((link) => link.href === "/admin/jobs"));
});

test("panel usa hooks estables, rol cerrado, Job codificado y ninguna adjudicación", () => {
  const source = readFileSync(new URL("../../apps/web/app/workspace/components/BudgetPanel.tsx", import.meta.url), "utf8");
  assert.match(source, /export function BudgetPanel/);
  assert.match(source, /role: WorkspaceRole \| null/);
  assert.match(source, /role === "client" \|\| role === "admin"/);
  assert.match(source, /useCallback/);
  assert.match(source, /useWorkspaceQuery/);
  assert.match(source, /fetchJobBids\(encodeURIComponent\(jobId\)\)/);
  assert.match(source, /if \(!role\)/);
  assert.match(source, /UNVERIFIED/);
  assert.match(source, /confianza heurística/);
  assert.match(source, /min-h-11/);
  assert.doesNotMatch(source, /acceptBid|fetchMyBids|my-bids|localStorage|sessionStorage|fetch\(/);
});

test("consumidor cliente muestra propuestas recibidas y conserva destinos permitidos", () => {
  const source = readFileSync(new URL("../../apps/web/app/(app)/client/bids/page.tsx", import.meta.url), "utf8");
  assert.match(source, /Propuestas recibidas/);
  assert.match(source, /BudgetPanel role="client"/);
  assert.match(source, /\/client\/marketplace/);
  assert.match(source, /\/client\/jobs/);
  assert.doesNotMatch(source, /my-bids|acceptBid|bidId|currency: "USD"/);
});
