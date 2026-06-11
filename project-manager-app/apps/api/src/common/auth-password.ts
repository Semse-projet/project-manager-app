import crypto from "node:crypto";

const PASSWORD_HASH_VERSION = "s1";
const SCRYPT_KEYLEN = 64;

function asBase64(value: Buffer): string {
  return value.toString("base64url");
}

function decodeBase64(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${PASSWORD_HASH_VERSION}$${asBase64(salt)}$${asBase64(derived)}`;
}

export function verifyPassword(password: string, hashedPassword: string): boolean {
  const [version, saltEncoded, derivedEncoded] = hashedPassword.split("$");
  if (version !== PASSWORD_HASH_VERSION || !saltEncoded || !derivedEncoded) {
    return false;
  }

  const salt = decodeBase64(saltEncoded);
  const expected = decodeBase64(derivedEncoded);
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}
