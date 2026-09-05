import test from "node:test";
import assert from "node:assert/strict";
import { toolResultPartSchema, toolResultSchema } from "@semse/schemas";

test("toolResultPartSchema accepts every declared discriminant with its required fields", () => {
  const validParts: unknown[] = [
    { type: "text", text: "hello" },
    { type: "json", data: { anything: true } },
    { type: "image", url: "https://example.com/a.png", mimeType: "image/png" },
    { type: "image", url: "https://example.com/a.png", mimeType: "image/png", metadata: { width: 100 } },
    { type: "pdf", url: "https://example.com/a.pdf", filename: "report.pdf" },
    { type: "csv", url: "https://example.com/a.csv", filename: "data.csv" },
    { type: "annotation", targetId: "target_1", data: { note: "x" } },
    { type: "internal_link", entityType: "Job", entityId: "job_1" },
    { type: "approval_request", approvalId: "approval_1" },
  ];

  for (const part of validParts) {
    const parsed = toolResultPartSchema.safeParse(part);
    assert.equal(parsed.success, true, `expected ${JSON.stringify(part)} to be valid`);
  }
});

test("toolResultPartSchema rejects an unknown discriminant and a part missing its required field", () => {
  assert.equal(toolResultPartSchema.safeParse({ type: "video", url: "https://example.com/a.mp4" }).success, false);
  assert.equal(toolResultPartSchema.safeParse({ type: "image", url: "https://example.com/a.png" }).success, false); // missing mimeType
  assert.equal(toolResultPartSchema.safeParse({ type: "pdf", filename: "a.pdf" }).success, false); // missing url
});

test("toolResultSchema requires parts and keeps legacyJson optional and unconstrained", () => {
  assert.equal(
    toolResultSchema.safeParse({ parts: [{ type: "text", text: "ok" }] }).success,
    true,
  );
  assert.equal(
    toolResultSchema.safeParse({
      parts: [{ type: "json", data: { a: 1 } }],
      legacyJson: { anything: "at all", nested: { works: true } },
    }).success,
    true,
  );
  assert.equal(toolResultSchema.safeParse({}).success, false); // parts is required
  assert.equal(toolResultSchema.safeParse({ parts: "not-an-array" }).success, false);
});
