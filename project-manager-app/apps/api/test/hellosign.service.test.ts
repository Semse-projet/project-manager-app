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
