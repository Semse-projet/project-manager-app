import test from "node:test";
import assert from "node:assert/strict";
import { HelloSignService } from "../dist/modules/contracts/hellosign.service.js";

test("HelloSignService falls back to mock signing flow when API key is missing", async () => {
  const previousKey = process.env.HELLOSIGN_API_KEY;
  delete process.env.HELLOSIGN_API_KEY;

  try {
    const service = new HelloSignService();
    const result = await service.createSignatureRequest({
      title: "Contrato SEMSE",
      subject: "Firma requerida",
      message: "Firma el contrato",
      contractId: "ctr_1",
      documentText: "contract text",
      signers: [
        { name: "Client", email: "client@example.com", role: "client" },
        { name: "Pro", email: "pro@example.com", role: "professional" },
      ],
    });

    const status = await service.getStatus(result.requestId);

    assert.ok(result.requestId.startsWith("mock_sr_ctr_1_"));
    assert.equal(result.embeddedEnabled, false);
    assert.ok(result.signingUrlClient?.includes("/contracts/sign?id=ctr_1&role=client&mock=1"));
    assert.ok(result.signingUrlPro?.includes("/contracts/sign?id=ctr_1&role=pro&mock=1"));
    assert.equal(status.requestId, result.requestId);
    assert.equal(status.isComplete, false);
    assert.equal(status.clientSigned, false);
    assert.equal(status.proSigned, false);
    assert.equal(status.pdfUrl, null);
  } finally {
    if (previousKey === undefined) {
      delete process.env.HELLOSIGN_API_KEY;
    } else {
      process.env.HELLOSIGN_API_KEY = previousKey;
    }
  }
});


test("HelloSignService does not fabricate a request when provider rejects it", async () => {
  const priorKey = process.env.HELLOSIGN_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.HELLOSIGN_API_KEY = "test-only-key";
  globalThis.fetch = async () => new Response("denied", { status: 401 });
  try {
    const service = new HelloSignService();
    await assert.rejects(
      service.createSignatureRequest({
        title: "Test contract",
        subject: "Signature",
        message: "Sign",
        contractId: "ctr_failure",
        documentText: "test",
        signers: [{ name: "Client", email: "client@example.com", role: "client" }],
      }),
      /HTTP 401/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (priorKey === undefined) delete process.env.HELLOSIGN_API_KEY;
    else process.env.HELLOSIGN_API_KEY = priorKey;
  }
});


test("HelloSignService refuses implicit mock signing in production", async () => {
  const oldKey = process.env.HELLOSIGN_API_KEY;
  const oldEnv = process.env.NODE_ENV;
  delete process.env.HELLOSIGN_API_KEY;
  process.env.NODE_ENV = "production";
  try {
    const service = new HelloSignService();
    await assert.rejects(service.createSignatureRequest({
      title: "Contract",
      subject: "Signature",
      message: "Sign",
      contractId: "ctr_prod",
      documentText: "test",
      signers: [{ name: "Client", email: "client@example.com", role: "client" }],
    }), /not configured/);
  } finally {
    if (oldKey === undefined) delete process.env.HELLOSIGN_API_KEY;
    else process.env.HELLOSIGN_API_KEY = oldKey;
    if (oldEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldEnv;
  }
});

test("HelloSignService rejects failed provider status instead of returning unsigned", async () => {
  const oldKey = process.env.HELLOSIGN_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.HELLOSIGN_API_KEY = "test-only-key";
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  try {
    const service = new HelloSignService();
    await assert.rejects(service.getStatus("request_1"), /HTTP 503/);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.HELLOSIGN_API_KEY;
    else process.env.HELLOSIGN_API_KEY = oldKey;
  }
});

test("HelloSignService rejects malformed status response", async () => {
  const oldKey = process.env.HELLOSIGN_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.HELLOSIGN_API_KEY = "test-only-key";
  globalThis.fetch = async () => Response.json({ signature_request: { is_complete: true } });
  try {
    const service = new HelloSignService();
    await assert.rejects(service.getStatus("request_2"), /invalid/);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.HELLOSIGN_API_KEY;
    else process.env.HELLOSIGN_API_KEY = oldKey;
  }
});
