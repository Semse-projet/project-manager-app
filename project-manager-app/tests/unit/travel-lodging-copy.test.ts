import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");

test("travel surfaces describe missing required lodging with the same wording", () => {
  const paths = [
    "apps/web/app/(app)/worker/travel/page.tsx",
    "apps/web/app/(app)/worker/travel/[travelId]/page.tsx",
    "apps/web/app/(app)/admin/travel/page.tsx",
    "apps/web/app/(app)/admin/travel/[travelId]/page.tsx",
  ];

  for (const relativePath of paths) {
    const source = readFileSync(path.join(repoRoot, relativePath), "utf8");
    assert.doesNotMatch(source, /sin hospedaje requerido/, relativePath);
    assert.match(source, /falta el hospedaje requerido/, relativePath);
  }
});

test("worker field ops does not call the retired legacy tracker routes", () => {
  const source = readFileSync(path.join(repoRoot, "apps/web/app/(app)/worker/field-ops/page.tsx"), "utf8");
  assert.doesNotMatch(source, /\/api\/semse\/tracker\//);
});
