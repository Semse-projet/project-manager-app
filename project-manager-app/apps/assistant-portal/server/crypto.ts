/**
 * Crypto Service — AES-256-GCM Encryption/Decryption
 *
 * Provides authenticated encryption at rest for sensitive data.
 * Uses AES-256-GCM which provides both confidentiality and integrity.
 *
 * Key derivation: PBKDF2 with SHA-512 (100,000 iterations) from the
 * ENCRYPTION_KEY env variable, producing a 256-bit key per unique salt.
 *
 * Encrypted payload format (base64-encoded JSON):
 * {
 *   "v": 1,              // version for future algorithm upgrades
 *   "alg": "aes-256-gcm",
 *   "salt": "<hex>",     // 16 bytes, unique per encryption
 *   "iv": "<hex>",       // 12 bytes, unique per encryption
 *   "tag": "<hex>",      // 16 bytes, GCM auth tag
 *   "data": "<hex>"      // ciphertext
 * }
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync, createHash } from "crypto";
import { ENV } from "./_core/env";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits (recommended for GCM)
const SALT_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_DIGEST = "sha512";
const PAYLOAD_VERSION = 1;

export interface EncryptedPayload {
  v: number;
  alg: string;
  salt: string;
  iv: string;
  tag: string;
  data: string;
}

/**
 * Derives a 256-bit key from the master secret + a unique salt using PBKDF2.
 * Each encryption operation uses a fresh salt, so even identical plaintext
 * produces different ciphertext (semantic security).
 */
function deriveKey(masterSecret: string, salt: Buffer): Buffer {
  return pbkdf2Sync(masterSecret, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST);
}

/**
 * Returns the master encryption key from environment.
 * Falls back to a deterministic key derived from JWT_SECRET for development.
 * Throws in production if ENCRYPTION_KEY is not set.
 */
function getMasterKey(): string {
  if (ENV.encryptionKey) {
    return ENV.encryptionKey;
  }

  if (ENV.isProduction) {
    throw new Error(
      "[Crypto] ENCRYPTION_KEY must be set in production. " +
      "Generate one with: openssl rand -base64 32"
    );
  }

  // Development fallback: derive from cookie secret or use a fixed dev key
  if (ENV.cookieSecret) {
    return createHash("sha256").update(ENV.cookieSecret).digest("hex");
  }

  return "dev-only-insecure-key-do-not-use-in-production";
}

/**
 * Encrypts plaintext using AES-256-GCM with a fresh salt and IV.
 * Returns a base64-encoded JSON payload containing all parameters
 * needed for decryption.
 */
export function encrypt(plaintext: string): string {
  const masterKey = getMasterKey();
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(masterKey, salt);

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    v: PAYLOAD_VERSION,
    alg: ALGORITHM,
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    data: encrypted.toString("hex"),
  };

  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Decrypts a base64-encoded encrypted payload back to plaintext.
 * Verifies the GCM authentication tag to ensure data integrity.
 * Throws if the payload is tampered with or the key is incorrect.
 */
export function decrypt(encryptedBase64: string): string {
  const masterKey = getMasterKey();

  let payload: EncryptedPayload;
  try {
    const json = Buffer.from(encryptedBase64, "base64").toString("utf8");
    payload = JSON.parse(json);
  } catch {
    throw new Error("[Crypto] Invalid encrypted payload format");
  }

  if (payload.v !== PAYLOAD_VERSION) {
    throw new Error(`[Crypto] Unsupported payload version: ${payload.v}`);
  }

  if (payload.alg !== ALGORITHM) {
    throw new Error(`[Crypto] Unsupported algorithm: ${payload.alg}`);
  }

  const salt = Buffer.from(payload.salt, "hex");
  const iv = Buffer.from(payload.iv, "hex");
  const tag = Buffer.from(payload.tag, "hex");
  const data = Buffer.from(payload.data, "hex");
  const key = deriveKey(masterKey, salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    throw new Error(
      "[Crypto] Decryption failed — data may be tampered with or the encryption key has changed"
    );
  }
}

/**
 * Validates that the crypto system is operational.
 * Performs a round-trip encrypt/decrypt test.
 */
export function validateCryptoSystem(): { ok: boolean; error?: string } {
  try {
    const testData = "crypto-system-validation-test";
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    if (decrypted !== testData) {
      return { ok: false, error: "Round-trip validation failed" };
    }
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

/**
 * Encrypts a JSON-serializable object.
 */
export function encryptObject(obj: unknown): string {
  return encrypt(JSON.stringify(obj));
}

/**
 * Decrypts and parses a JSON object from an encrypted payload.
 */
export function decryptObject<T = unknown>(encryptedBase64: string): T {
  const json = decrypt(encryptedBase64);
  return JSON.parse(json) as T;
}
