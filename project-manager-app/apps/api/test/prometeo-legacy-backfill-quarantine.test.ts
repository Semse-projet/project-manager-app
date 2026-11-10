import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const legacyScript = fileURLToPath(
  new URL("../../../scripts/prometeo-backfill-embeddings.mjs", import.meta.url),
);

const cases = [
  { name: "no flags", args: [] },
  { name: "dry-run cannot bypass", args: ["--dry-run"] },
  { name: "explicit tenant and batch cannot bypass", args: ["--tenant", "synthetic_tenant", "--batch-size", "1"] },
];

for (const { name, args } of cases) {
  test(`L14 legacy cloud backfill fails closed: ${name}`, () => {
    // This is not a real endpoint or credential. The test never opens a DB.
    const env = {
      ...process.env,
      OPENAI_API_KEY: "synthetic_not_a_secret",
      DATABASE_URL: "postgresql://no_network_access:1/not_a_database",
      NODE_ENV: "production",
      SEMSE_CURATED_KNOWLEDGE_ENABLED: "true",
      SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED: "true",
    };
    const result = spawnSync(process.execPath, [legacyScript, ...args], {
      encoding: "utf8",
      timeout: 5000,
      env,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1, "unapproved backfill must never run");
    assert.match(result.stderr, /PROMETEO_L14_BACKFILL_DISABLED/);
    assert.match(result.stderr, /No documents were read or changed/);
    assert.ok(!result.stderr.includes(env.OPENAI_API_KEY),
      "do not echo credentials in guard logs");
    assert.equal(result.stdout, "");
  });
}

test("L14 retired script has no runtime network or database execution path", () => {
  const source = readFileSync(legacyScript, "utf8");
  assert.doesNotMatch(source, /\b(?:fetch|PrismaClient|https\.request|http\.request|net\.connect|createConnection)\s*\(/);
  assert.doesNotMatch(source, /\bimport\s*\(/);
  assert.match(source, /process\.exitCode\s*=\s*1/);
});
