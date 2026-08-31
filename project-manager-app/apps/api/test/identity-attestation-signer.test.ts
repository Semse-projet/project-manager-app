import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import {
  _resetAttestationKeyPairCacheForTests,
  buildAttestationMessage,
  getAttestationPublicKey,
  signAttestationMessage,
  verifyAttestationSignature,
} from "../dist/modules/users/identity-attestation-signer.js";

test.beforeEach(() => {
  _resetAttestationKeyPairCacheForTests();
  delete process.env.RAILWAY_ENVIRONMENT;
  delete process.env.RAILWAY_ENVIRONMENT_NAME;
  delete process.env.SEMSE_ATTESTATION_PRIVATE_KEY;
  delete process.env.SEMSE_ATTESTATION_KEY_ID;
});

test("signs a message and verifies it against the matching public key", () => {
  const message = buildAttestationMessage({
    tenantId: "tnt_1",
    userId: "usr_pro",
    verifiedByUserId: "usr_admin",
    verificationType: "id_document",
    timestamp: "2026-08-29T00:00:00.000Z",
  });

  const { signature } = signAttestationMessage(message);

  assert.equal(verifyAttestationSignature(message, signature), true);
});

test("rejects a signature checked against a tampered message", () => {
  const message = buildAttestationMessage({
    tenantId: "tnt_1",
    userId: "usr_pro",
    verifiedByUserId: "usr_admin",
    verificationType: "id_document",
    timestamp: "2026-08-29T00:00:00.000Z",
  });

  const { signature } = signAttestationMessage(message);
  const tampered = message.replace("usr_pro", "usr_someone_else");

  assert.equal(verifyAttestationSignature(tampered, signature), false);
});

test("rejects a garbage signature instead of throwing", () => {
  const message = buildAttestationMessage({
    tenantId: "tnt_1",
    userId: "usr_pro",
    verifiedByUserId: "usr_admin",
    verificationType: "id_document",
    timestamp: "2026-08-29T00:00:00.000Z",
  });

  assert.equal(verifyAttestationSignature(message, "not-a-real-signature"), false);
});

test("the exposed public key matches the key actually used to sign", () => {
  const message = buildAttestationMessage({
    tenantId: "tnt_1",
    userId: "usr_pro",
    verifiedByUserId: "usr_admin",
    verificationType: "id_document",
    timestamp: "2026-08-29T00:00:00.000Z",
  });

  const { keyId, signature } = signAttestationMessage(message);
  const publicKey = getAttestationPublicKey();

  assert.equal(publicKey.keyId, keyId);
  assert.ok(publicKey.publicKeyPem.includes("BEGIN PUBLIC KEY"));
});

test("fails closed in a Railway-like environment when no real key is configured", () => {
  process.env.RAILWAY_ENVIRONMENT = "production";

  assert.throws(() => signAttestationMessage("irrelevant"), /must be configured in production/);
});

test("uses the configured real key when SEMSE_ATTESTATION_PRIVATE_KEY is set, even outside dev", () => {
  // Generate a real Ed25519 key the same way the module would, to configure
  // it via env exactly like a real deployment would.
  const { privateKey } = generateKeyPairSync("ed25519");
  process.env.SEMSE_ATTESTATION_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.SEMSE_ATTESTATION_KEY_ID = "test-key-2026";
  process.env.RAILWAY_ENVIRONMENT = "production";

  const message = buildAttestationMessage({
    tenantId: "tnt_1",
    userId: "usr_pro",
    verifiedByUserId: "usr_admin",
    verificationType: "id_document",
    timestamp: "2026-08-29T00:00:00.000Z",
  });

  const { keyId, signature } = signAttestationMessage(message);
  assert.equal(keyId, "test-key-2026");
  assert.equal(verifyAttestationSignature(message, signature), true);
});
