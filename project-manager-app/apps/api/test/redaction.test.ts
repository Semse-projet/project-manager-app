import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { redactSensitiveLog, extractSafeDiagnostic, containsSecrets } from "../src/infrastructure/logs/redaction.util.js";

describe("redactSensitiveLog", () => {
  it("redacts Bearer tokens", () => {
    const input = "Authorization: Bearer sk_test_abc123xyz789";
    const output = redactSensitiveLog(input);
    assert.ok(output.includes("[REDACTED]"));
    assert.ok(!output.includes("Bearer"));
    assert.ok(!output.includes("sk_test"));
  });

  it("redacts OpenAI API keys", () => {
    const input = "Using API key sk-proj-abc123xyz789";
    const output = redactSensitiveLog(input);
    assert.ok(output.includes("[REDACTED]"));
    assert.ok(!output.includes("sk-proj"));
  });

  it("redacts database URLs", () => {
    const input = "postgres://user:password@localhost:5432/db";
    const output = redactSensitiveLog(input);
    assert.ok(output.includes("[REDACTED]"));
    assert.ok(!output.includes("password"));
    assert.ok(!output.includes("localhost:5432"));
  });

  it("redacts environment variables", () => {
    const input = "DATABASE_URL=postgresql://user:pass@host/db";
    const output = redactSensitiveLog(input);
    assert.ok(output.includes("[REDACTED]"));
  });

  it("redacts Cookie headers", () => {
    const input = "Cookie: session=abc123xyz; token=secret456";
    const output = redactSensitiveLog(input);
    assert.ok(output.includes("[REDACTED]"));
    assert.ok(!output.includes("session="));
  });

  it("preserves safe diagnostic text", () => {
    const input = "Worker Verification failed: missing evidence photos";
    const output = redactSensitiveLog(input);
    assert.strictEqual(output, input);
  });

  it("handles multiple secrets in one message", () => {
    const input = `
      Authorization: Bearer token123
      Database: postgres://user:pass@host/db
      API: sk-test-key456
    `;
    const output = redactSensitiveLog(input);
    assert.strictEqual(output.split("[REDACTED]").length - 1, 3);
  });

  it("is case-insensitive for header names", () => {
    const input1 = "authorization: Bearer token";
    const input2 = "AUTHORIZATION: Bearer token";
    assert.ok(redactSensitiveLog(input1).includes("[REDACTED]"));
    assert.ok(redactSensitiveLog(input2).includes("[REDACTED]"));
  });
});

describe("extractSafeDiagnostic", () => {
  it("truncates long messages", () => {
    const longMessage = "x".repeat(600);
    const output = extractSafeDiagnostic(longMessage, 500);
    assert.ok(output.length <= 503); // 500 + "..."
  });

  it("redacts before truncating", () => {
    const input = "Safe message " + "Bearer token123" + " more safe text";
    const output = extractSafeDiagnostic(input, 100);
    assert.ok(!output.includes("token123"));
    assert.ok(output.includes("[REDACTED]"));
  });

  it("preserves full message if under limit", () => {
    const input = "Short safe message";
    const output = extractSafeDiagnostic(input, 500);
    assert.strictEqual(output, input);
  });
});

describe("containsSecrets", () => {
  it("detects Bearer tokens", () => {
    assert.ok(containsSecrets("Authorization: Bearer abc123"));
  });

  it("detects API keys", () => {
    assert.ok(containsSecrets("key: sk-test-xyz"));
  });

  it("detects database URLs", () => {
    assert.ok(containsSecrets("postgres://user:pass@host/db"));
  });

  it("returns false for safe text", () => {
    assert.ok(!containsSecrets("This is a safe message"));
  });

  it("detects multiple secret types", () => {
    assert.ok(containsSecrets("Bearer token and sk-api-key"));
  });
});
