import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const SECRET_MIN_LENGTH = 32;

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  tag: string;
};

function loadMasterKey(): Buffer {
  const keyHex = process.env.SATELLITE_WEBHOOK_SECRET_KEY;
  if (!keyHex) {
    throw new Error("SATELLITE_WEBHOOK_SECRET_KEY is not configured");
  }
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error("SATELLITE_WEBHOOK_SECRET_KEY must be 32 bytes (64 hex characters)");
  }
  return key;
}

/** A fresh random webhook secret — never derived from the URL/tenant/anything guessable. */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * AES-256-GCM, same construction as
 * packages/autonomy/src/browser/session-manager.ts (encryptCookies) —
 * adapted, not reinvented (SAT-007 spec §8). Unlike SatelliteToken.tokenHash,
 * this must be reversible: the webhook secret has to be read back in the
 * clear to sign each outgoing HMAC, so it's encrypted, not hashed.
 */
export function encryptWebhookSecret(secret: string, keyHex?: string): EncryptedSecret {
  const key = keyHex ? Buffer.from(keyHex, "hex") : loadMasterKey();
  if (key.length !== 32) {
    throw new Error("Encryption key must be 32 bytes (64 hex characters)");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let ciphertext = cipher.update(secret, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return { ciphertext, iv: iv.toString("hex"), tag };
}

export function decryptWebhookSecret(encrypted: EncryptedSecret, keyHex?: string): string {
  const key = keyHex ? Buffer.from(keyHex, "hex") : loadMasterKey();
  if (key.length !== 32) {
    throw new Error("Decryption key must be 32 bytes (64 hex characters)");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(encrypted.iv, "hex"));
  decipher.setAuthTag(Buffer.from(encrypted.tag, "hex"));
  let plaintext = decipher.update(encrypted.ciphertext, "hex", "utf8");
  plaintext += decipher.final("utf8");
  return plaintext;
}

/**
 * HMAC-SHA256 over the exact body bytes sent, same construction as
 * whatsapp-cloud.adapter.ts:verifyWhatsAppWebhookSignature — inverted,
 * SEMSE signs here instead of verifying an inbound signature.
 */
export function signWebhookPayload(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

/** Constant-time comparison — only used by tests/local verification; the
 * satellite side does the real verification, outside this monorepo. */
export function verifyWebhookSignature(body: string, secret: string, signatureHeader: string): boolean {
  const expected = signWebhookPayload(body, secret);
  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(signatureHeader, "utf8");
  return expectedBuf.length === receivedBuf.length && timingSafeEqual(expectedBuf, receivedBuf);
}

export function isSecretStrengthValid(secret: string): boolean {
  return secret.length >= SECRET_MIN_LENGTH;
}
