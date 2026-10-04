import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("client job detail reserves mobile clearance below its final content", () => {
  const source = read("apps/web/app/(app)/client/jobs/[jobId]/page.tsx");

  assert.match(source, /<div className="pb-24 md:pb-0"/);
});

test("client professional matching uses product language instead of algorithm internals", () => {
  const source = read("apps/web/app/(app)/client/professionals/page.tsx");

  assert.doesNotMatch(source, /Jaccard/i);
  assert.match(source, /Encuentra profesionales compatibles con tu trabajo/);
  assert.match(source, /Matching SEMSE/);
  assert.match(source, /Ordenados por confianza/);
  assert.match(source, /rankeados por compatibilidad/);
});
