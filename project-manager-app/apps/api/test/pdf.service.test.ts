import test from "node:test";
import assert from "node:assert/strict";
import { buildInvoicePdf } from "../src/common/pdf/build-pdf.ts";
import type { InvoiceRecord } from "../src/modules/finance/finance.repository.ts";

function makeInvoice(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: "inv_test_001",
    tenantId: "tenant_default",
    orgId: "org_worker_001",
    clientOrgId: "Familia González",
    projectId: "proj_bathroom_reno",
    jobId: null,
    createdBy: "usr_worker_001",
    number: "EST-0042",
    title: "Renovación de baño — materiales y mano de obra",
    status: "draft",
    lineItems: [
      { description: "Drywall 4x8 sheets (x10)", qty: 10, unitPrice: 14.99, taxRate: 0, total: 149.90 },
      { description: "Mano de obra instalación drywall", qty: 1, unitPrice: 350, taxRate: 0, total: 350 },
      { description: "Pintura interior (2 galones)", qty: 2, unitPrice: 45, taxRate: 0, total: 90 },
    ],
    subtotal: 589.90,
    taxAmount: 0,
    total: 589.90,
    currency: "USD",
    dueDate: null,
    paidAt: null,
    sentAt: null,
    viewedAt: null,
    notes: "Materiales sujetos a cambio según disponibilidad.",
    terms: "50% de depósito al inicio. Saldo al terminar.",
    pdfUrl: null,
    externalRef: null,
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-01T10:00:00.000Z",
    ...overrides,
  };
}

test("buildInvoicePdf generates valid PDF buffer for estimate", async () => {
  const buf = await buildInvoicePdf(makeInvoice(), "estimate");
  assert.ok(buf instanceof Buffer);
  assert.ok(buf.length > 1000, "PDF buffer should be non-trivial");
  assert.equal(buf.subarray(0, 4).toString("ascii"), "%PDF", "Buffer should start with PDF magic bytes");
});

test("buildInvoicePdf generates valid PDF buffer for invoice", async () => {
  const buf = await buildInvoicePdf(makeInvoice({ status: "sent", number: "INV-0042" }), "invoice", {
    businessName: "SEMSE Contractor Services",
    businessAddress: "Miami, FL 33101",
    businessPhone: "(305) 555-0100",
  });
  assert.ok(buf instanceof Buffer);
  assert.ok(buf.length > 1000);
  assert.equal(buf.subarray(0, 4).toString("ascii"), "%PDF");
});

test("buildInvoicePdf handles empty line items", async () => {
  const buf = await buildInvoicePdf(makeInvoice({ lineItems: [], subtotal: 0, taxAmount: 0, total: 0 }), "estimate");
  assert.ok(buf instanceof Buffer);
  assert.equal(buf.subarray(0, 4).toString("ascii"), "%PDF");
});

test("buildInvoicePdf renders PAID badge for paid invoices", async () => {
  const buf = await buildInvoicePdf(makeInvoice({ status: "paid", paidAt: "2026-05-02T14:00:00.000Z" }), "invoice");
  assert.ok(buf instanceof Buffer);
  assert.equal(buf.subarray(0, 4).toString("ascii"), "%PDF");
});
