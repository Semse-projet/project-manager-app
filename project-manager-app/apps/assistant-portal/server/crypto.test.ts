import { describe, it, expect } from "vitest";
import { encrypt, decrypt, encryptObject, decryptObject, validateCryptoSystem } from "./crypto";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    stripeCustomerId: null,
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: { origin: "http://localhost:3000" } } as unknown as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
  return { ctx };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// ─── Crypto Module Unit Tests ───────────────────────────────────────────────

describe("crypto module", () => {
  it("encrypts and decrypts a simple string", () => {
    const plaintext = "Hello, World!";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext (semantic security)", () => {
    const plaintext = "same data twice";
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
    // But both decrypt to the same value
    expect(decrypt(encrypted1)).toBe(plaintext);
    expect(decrypt(encrypted2)).toBe(plaintext);
  });

  it("handles empty strings gracefully", () => {
    const plaintext = "";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("handles unicode and special characters", () => {
    const plaintext = "Contraseña: 🔐 ñ ü ö ¿¡ 你好世界 日本語";
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("handles large data (10KB)", () => {
    const plaintext = "A".repeat(10240);
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
    expect(decrypted.length).toBe(10240);
  });

  it("handles JSON data", () => {
    const data = { user: "test", password: "secret123", tokens: [1, 2, 3] };
    const plaintext = JSON.stringify(data);
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(JSON.parse(decrypted)).toEqual(data);
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encrypt("sensitive data");
    // Tamper with the base64 payload
    const tampered = encrypted.slice(0, -5) + "XXXXX";
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws on invalid base64 input", () => {
    expect(() => decrypt("not-valid-base64!!!")).toThrow();
  });

  it("throws on empty encrypted input", () => {
    expect(() => decrypt("")).toThrow();
  });

  it("encrypted output is base64 encoded", () => {
    const encrypted = encrypt("test");
    // Base64 regex
    expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it("encrypted payload contains expected structure", () => {
    const encrypted = encrypt("test");
    const json = JSON.parse(Buffer.from(encrypted, "base64").toString("utf8"));
    expect(json.v).toBe(1);
    expect(json.alg).toBe("aes-256-gcm");
    expect(json.salt).toBeDefined();
    expect(json.iv).toBeDefined();
    expect(json.tag).toBeDefined();
    expect(json.data).toBeDefined();
  });
});

describe("encryptObject / decryptObject", () => {
  it("round-trips a complex object", () => {
    const obj = {
      apiKey: "sk_test_123456",
      credentials: { username: "admin", password: "p@ssw0rd!" },
      permissions: ["read", "write", "delete"],
      nested: { deep: { value: 42 } },
    };
    const encrypted = encryptObject(obj);
    const decrypted = decryptObject(encrypted);
    expect(decrypted).toEqual(obj);
  });

  it("handles arrays", () => {
    const arr = [1, "two", { three: 3 }, [4, 5]];
    const encrypted = encryptObject(arr);
    const decrypted = decryptObject(encrypted);
    expect(decrypted).toEqual(arr);
  });
});

describe("validateCryptoSystem", () => {
  it("returns ok: true when system is operational", () => {
    const result = validateCryptoSystem();
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

// ─── Vault Router Integration Tests ─────────────────────────────────────────

describe("vault.encrypt (route)", () => {
  it("encrypts and stores data in vault", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.vault.encrypt({
      label: "API Key de prueba",
      category: "credentials",
      data: "sk_test_abc123xyz",
    });

    expect(result.id).toBeDefined();
    expect(result.label).toBe("API Key de prueba");
    expect(result.category).toBe("credentials");
    expect(result.checksum).toBeDefined();
    expect(result.checksum.length).toBe(16);
    expect(result.message).toContain("cifrados");
  });

  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.vault.encrypt({ label: "test", data: "secret" })
    ).rejects.toThrow();
  });
});

describe("vault.encryptInline / vault.decryptInline", () => {
  it("encrypts and decrypts inline without storage", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const encResult = await caller.vault.encryptInline({
      data: "my-secret-token-12345",
    });

    expect(encResult.encrypted).toBeDefined();
    expect(encResult.checksum).toBeDefined();
    expect(encResult.encrypted).not.toContain("my-secret-token");

    const decResult = await caller.vault.decryptInline({
      encrypted: encResult.encrypted,
    });

    expect(decResult.data).toBe("my-secret-token-12345");
  });

  it("fails to decrypt tampered data", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.vault.decryptInline({ encrypted: "invalid-payload" })
    ).rejects.toThrow();
  });
});

describe("vault.status", () => {
  it("reports crypto system as operational", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const status = await caller.vault.status();
    expect(status.ok).toBe(true);
  });
});

describe("vault.list", () => {
  it("returns empty array when no entries", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const entries = await caller.vault.list();
    expect(entries).toEqual([]);
  });

  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.vault.list()).rejects.toThrow();
  });
});

describe("vault.decrypt (route)", () => {
  it("throws NOT_FOUND for non-existent entry", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.vault.decrypt({ id: 99999 })
    ).rejects.toThrow("Registro no encontrado");
  });

  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.vault.decrypt({ id: 1 })
    ).rejects.toThrow();
  });
});

describe("vault.delete", () => {
  it("throws NOT_FOUND for non-existent entry", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.vault.delete({ id: 99999 })
    ).rejects.toThrow("Registro no encontrado");
  });
});
