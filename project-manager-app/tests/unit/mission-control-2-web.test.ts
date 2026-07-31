import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../", import.meta.url);

function read(path: string): string {
  return readFileSync(new URL(path, root), "utf8");
}

test("F4 web: all BFF contracts derive identity from the incoming session", () => {
  for (const route of [
    "apps/web/app/api/semse/ops/mission-control/exceptions/route.ts",
    "apps/web/app/api/semse/ops/mission-control/runbooks/route.ts",
    "apps/web/app/api/semse/ops/mission-control/actions/route.ts",
  ]) {
    const source = read(route);
    assert.match(source, /fetchSemseDataForRequest/);
    assert.doesNotMatch(source, /\bfetchSemseData\(/);
  }
});

test("F4 web: exception UI uses only the governed action endpoint", () => {
  const source = read("apps/web/app/(app)/admin/mission-control/page.tsx");
  assert.match(source, /\/api\/semse\/ops\/mission-control\/actions/);
  assert.match(source, /runbookId/);
  assert.match(source, /idempotencyKey/);
  assert.match(source, /Operator reason \(10–500 characters\)/);
  assert.match(source, /Dry-run/);
  assert.doesNotMatch(source, /operational-signals\/\$\{id\}\/(acknowledge|resolve|dismiss)/);
  assert.doesNotMatch(source, /ops\/loops\/\$\{.*\}\/(pause|resume)/);
});

test("F4 web: loading, empty, forbidden, inactive, degraded and error states are visible", () => {
  const source = read("apps/web/app/(app)/admin/mission-control/page.tsx");
  for (const marker of [
    "Loading canonical exceptions",
    "No exceptions match this view",
    "Access denied",
    "Mission Control 2.0 is not active",
    "Partial data",
    "Mission Control unavailable",
  ]) {
    assert.ok(source.includes(marker), `missing UI state marker: ${marker}`);
  }
});
