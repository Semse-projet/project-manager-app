import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const laborClientPath = path.join(
  repoRoot,
  "apps",
  "web",
  "app",
  "(app)",
  "tools",
  "labor",
  "labor-tool-client.tsx",
);

test("web Labor tool uses the declared BASE_RATES map", async () => {
  const source = await readFile(laborClientPath, "utf8");

  assert.match(source, /const BASE_RATES\s*:/);
  assert.match(source, /BASE_RATES\[input\.laborType\]/);
  assert.doesNotMatch(source, /\bbaseRate\[input\.laborType\]/);
});
