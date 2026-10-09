import test from "node:test";
import assert from "node:assert/strict";
import { DocumensoProvider } from "../dist/modules/contracts/documenso-provider.js";

const base = {
  tenantId: "tenant_a",
  contractId: "contract_a",
  idempotencyKey: "request_a",
  title: "Agreement",
  documentText: "",
  documentPdf: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]),
  signers: [{
    name: "Customer",
    email: "customer@example.com",
    role: "client" as const,
    fields: [{ page: 1, positionX: 10, positionY: 10, width: 100, height: 30 }],
  }],
};

test("Documenso adapter does not claim unimplemented capabilities", () => {
  const provider = new DocumensoProvider();
  assert.equal(provider.id, "documenso");
  assert.equal(provider.capabilities.verifiedWebhooks, false);
  assert.equal(provider.capabilities.embeddedSigning, false);
});

test("Documenso adapter rejects missing tenant scope", async () => {
  await assert.rejects(new DocumensoProvider().createRequest({ ...base, tenantId: "" }), /tenant/);
});

test("Documenso adapter rejects missing PDF", async () => {
  await assert.rejects(new DocumensoProvider().createRequest({ ...base, documentPdf: undefined }), /PDF/);
});

test("Documenso adapter rejects missing signature fields", async () => {
  await assert.rejects(new DocumensoProvider().createRequest({ ...base, signers: [{ name: "Customer", email: "customer@example.com", role: "client" }] }), /fields/);
});

test("Documenso adapter fails closed instead of creating fake signatures", async () => {
  await assert.rejects(new DocumensoProvider().createRequest(base), /not configured/);
  await assert.rejects(new DocumensoProvider().getRequestStatus("request_a", { tenantId: "tenant_a", contractId: "contract_a" }), /not configured/);
});

test("Documenso adapter rejects a non-PDF payload", async () => {
  await assert.rejects(new DocumensoProvider().createRequest({ ...base, documentPdf: new Uint8Array([1, 2, 3, 4, 5]) }), /PDF/);
});

test("Documenso adapter rejects invalid field geometry", async () => {
  await assert.rejects(new DocumensoProvider().createRequest({ ...base, signers: [{ ...base.signers[0], fields: [{ page: 0, positionX: 10, positionY: 10, width: 100, height: 30 }] }] }), /coordinates/);
});

test("Documenso adapter rejects empty request ID for status checks", async () => {
  await assert.rejects(new DocumensoProvider().getRequestStatus("", { tenantId: "tenant_a", contractId: "contract_a" }), /scope/);
});
