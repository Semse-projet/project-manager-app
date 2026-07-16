import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export class SessionManager {
  private static readonly ALGORITHM = "aes-256-gcm";

  /**
   * Encrypts a string of cookies using AES-256-GCM.
   * @param cookies - The plaintext cookie string.
   * @param keyHex - A 64-character hex key (32 bytes).
   */
  static encryptCookies(cookies: string, keyHex: string): { encrypted: string; iv: string; tag: string } {
    const key = Buffer.from(keyHex, "hex");
    if (key.length !== 32) {
      throw new Error("Invalid key length. Key must be exactly 32 bytes (64 hex characters).");
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv(SessionManager.ALGORITHM, key, iv);
    
    let encrypted = cipher.update(cookies, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");

    return {
      encrypted,
      iv: iv.toString("hex"),
      tag
    };
  }

  /**
   * Decrypts a string of cookies using AES-256-GCM.
   */
  static decryptCookies(encrypted: string, ivHex: string, tagHex: string, keyHex: string): string {
    const key = Buffer.from(keyHex, "hex");
    if (key.length !== 32) {
      throw new Error("Invalid key length. Key must be exactly 32 bytes (64 hex characters).");
    }

    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = createDecipheriv(SessionManager.ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }
}
