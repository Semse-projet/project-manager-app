import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("field ops tracker uses one canonical BFF route family", () => {
  const source = read("apps/web/app/(app)/worker/field-ops/page.tsx");

  assert.doesNotMatch(source, /\/api\/semse\/tracker\/\$\{active\.id\}/);
  for (const action of ["pause", "resume", "stop"]) {
    assert.equal(
      source.includes(`/api/semse/time-tracker/sessions/\${active.id}/${action}`),
      true,
      `${action} should use the canonical time-tracker route`,
    );
  }
});

test("travel surfaces describe missing required lodging unambiguously", () => {
  const paths = [
    "apps/web/app/(app)/worker/travel/page.tsx",
    "apps/web/app/(app)/worker/travel/[travelId]/page.tsx",
    "apps/web/app/(app)/admin/travel/page.tsx",
    "apps/web/app/(app)/admin/travel/[travelId]/page.tsx",
  ];

  for (const relativePath of paths) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /sin hospedaje requerido/);
    assert.match(source, /falta hospedaje requerido/);
  }
});
