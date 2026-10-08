import test from "node:test";
import assert from "node:assert/strict";
import {
  SignatureProviderRegistry,
  type SignatureProvider,
} from "../dist/modules/contracts/signature-provider.js";

const provider: SignatureProvider = {
  id: "hellosign",
  capabilities: {
    embeddedSigning: false,
    cancellation: false,
    signedDocumentRetrieval: false,
    verifiedWebhooks: false,
  },
  async createRequest(input) {
    assert.equal(input.tenantId, "tenant_a");
    return {
      provider: "hellosign",
      externalRequestId: "test_req",
      status: "pending",
      completedDocumentRef: null,
    };
  },
  async getRequestStatus() {
    return { status: "pending", verifiedAt: null, completedDocumentRef: null };
  },
};

test("signature registry fails closed for missing provider", () => {
  const registry = new SignatureProviderRegistry();
  assert.throws(() => registry.resolve("docusign"), /not registered/);
});

test("signature registry rejects duplicate provider IDs", () => {
  const registry = new SignatureProviderRegistry();
  registry.register(provider);
  assert.throws(() => registry.register(provider), /Duplicate/);
});

test("signature registry exposes capabilities without claiming completion", async () => {
  const registry = new SignatureProviderRegistry();
  registry.register(provider);
  assert.equal(registry.resolve("hellosign"), provider);
  assert.equal(registry.list()[0]?.capabilities.verifiedWebhooks, false);
  const receipt = await registry.resolve("hellosign").createRequest({
    tenantId: "tenant_a",
    connectionId: "connection_a",
    contractId: "ctr_1",
    idempotencyKey: "req_1",
    title: "Test",
    documentText: "Document",
    signers: [{ name: "Client", email: "client@example.com", role: "client" }],
  });
  assert.equal(receipt.completedDocumentRef, null);
});
