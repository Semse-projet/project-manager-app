import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyObject,
} from "node:crypto";

/**
 * Ed25519 signing for identity attestations — see
 * docs/specs/core/identity-attestation.spec.md. This is the piece the old
 * worker-verification DID stub never had: an actual keypair, held by
 * SEMSE (not the user being verified), producing a signature that anyone
 * holding the public key can check against the exact message that was
 * signed. It answers "who signs it" with "SEMSE, after an OPS_ADMIN
 * reviewed real credentials" — not "whoever POSTs two non-empty strings".
 */

export type AttestationKeyPair = {
  keyId: string;
  privateKey: KeyObject;
  publicKey: KeyObject;
};

let cachedKeyPair: AttestationKeyPair | null = null;

function isProductionLike(): boolean {
  return Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME);
}

/** Exposed for tests only, to reset the module-level cache between cases. */
export function _resetAttestationKeyPairCacheForTests(): void {
  cachedKeyPair = null;
}

export function loadAttestationKeyPair(): AttestationKeyPair {
  if (cachedKeyPair) return cachedKeyPair;

  const privateKeyPem = process.env.SEMSE_ATTESTATION_PRIVATE_KEY;
  const keyId = process.env.SEMSE_ATTESTATION_KEY_ID;

  if (privateKeyPem && keyId) {
    const privateKey = createPrivateKey(privateKeyPem);
    const publicKey = createPublicKey(privateKey);
    cachedKeyPair = { keyId, privateKey, publicKey };
    return cachedKeyPair;
  }

  if (isProductionLike()) {
    throw new Error(
      "SEMSE_ATTESTATION_PRIVATE_KEY and SEMSE_ATTESTATION_KEY_ID must be configured in production — " +
        "identity attestation cannot sign with a real SEMSE key otherwise.",
    );
  }

  // Dev/test fallback only: an ephemeral key generated fresh per process
  // start. Never persisted, never valid across a restart, and refused
  // above in any Railway environment — mirrors the fail-closed-in-prod /
  // mock-in-dev pattern already used for LIENGRID_API_KEY, LOB_API_KEY,
  // VISION_SERVICE_API_KEY elsewhere in this codebase.
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  cachedKeyPair = { keyId: "dev-ephemeral", privateKey, publicKey };
  return cachedKeyPair;
}

export function buildAttestationMessage(params: {
  tenantId: string;
  userId: string;
  verifiedByUserId: string;
  verificationType: string;
  timestamp: string;
}): string {
  return [
    "semse-identity-attestation:v1",
    params.tenantId,
    params.userId,
    params.verificationType,
    params.verifiedByUserId,
    params.timestamp,
  ].join(":");
}

export function signAttestationMessage(message: string): { keyId: string; signature: string } {
  const { keyId, privateKey } = loadAttestationKeyPair();
  const signature = cryptoSign(null, Buffer.from(message, "utf8"), privateKey).toString("base64");
  return { keyId, signature };
}

export function verifyAttestationSignature(message: string, signature: string): boolean {
  const { publicKey } = loadAttestationKeyPair();
  try {
    return cryptoVerify(null, Buffer.from(message, "utf8"), publicKey, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

export function getAttestationPublicKey(): { keyId: string; publicKeyPem: string } {
  const { keyId, publicKey } = loadAttestationKeyPair();
  return { keyId, publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString() };
}
