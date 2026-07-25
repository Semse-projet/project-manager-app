import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const workerList = read("apps/web/app/(app)/worker/travel/page.tsx");
const adminList = read("apps/web/app/(app)/admin/travel/page.tsx");
const service = read("apps/api/src/modules/travel/travel.service.ts");

test("travel list pages consume aggregate rows without per-travel requests", () => {
  for (const source of [workerList, adminList]) {
    assert.doesNotMatch(source, /\bfetchTravelSettlement\b/);
    assert.doesNotMatch(source, /\bfetchTravelExpenses\b/);
    assert.doesNotMatch(source, /\bfetchTravelLodging\b/);
    assert.match(source, /typeof (?:r|row)\.totalSpent === "number"/);
    assert.match(source, /typeof (?:r|row)\.missingReceipts === "number"/);
  }
});

test("worker travel load is stable when the default form job is initialized", () => {
  assert.match(workerList, /setFormJobId\(\(current\) => current \|\| rawJobs\[0\]\?\.id \|\| ""\);/);
  assert.doesNotMatch(workerList, /\}, \[formJobId\]\);/);
  assert.match(workerList, /\}, \[\]\);\s*\n\s*useEffect\(\(\) => \{ void load\(\); \}, \[load\]\);/);
});

test("travel summary is loaded in a fixed batch query set", () => {
  assert.match(service, /travelId: \{ in: travelIds \}/);
  assert.match(service, /const \[expenses, lodgings, advances\] = await Promise\.all/);
  assert.doesNotMatch(service, /assignments\.map\(async/);
});
