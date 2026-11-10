/** PR #987 / #973 convergence guard: safe private-by-default Prometeo upload. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const page = readFileSync(resolve(projectRoot, "apps/web/app/(app)/admin/prometeo/page.tsx"), "utf8");

test("Prometeo large-file uploads avoid spreading byte arrays as function arguments", () => {
  assert.match(page, /function readFileAsBase64\(file: File\)/);
  assert.match(page, /reader\.readAsDataURL\(file\)/);
  assert.match(page, /const fileBase64 = await readFileAsBase64\(ingestFile\)/);
  assert.doesNotMatch(page, /btoa\(String\.fromCharCode\(/,
    "large uploads must not use per-byte spread arguments");
});

test("Prometeo security branch only offers private ingestion before sharing approval", () => {
  assert.match(page, /\[ingestVisibility, setIngestVisibility\] = useState\("tenant_private"\)/);
  assert.match(page, /<option value="tenant_private">/);
  assert.doesNotMatch(page, /<option value="public_training">/);
  assert.doesNotMatch(page, /<option value="project_private">/);
});
