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

test("travel list pages load one aggregate summary instead of per-travel requests", () => {
  for (const source of [workerList, adminList]) {
    assert.match(source, /\bfetchTravelAssignmentsSummary\b/);
    assert.doesNotMatch(source, /\bfetchTravelSettlement\b/);
    assert.doesNotMatch(source, /\bfetchTravelExpenses\b/);
    assert.doesNotMatch(source, /\bfetchTravelLodging\b/);
    assert.doesNotMatch(source, /\bfetchTravelAdvances\b/);
  }
});

test("admin travel list reads the per-travel totals from the summary rows", () => {
  for (const field of [
    "totalSpent",
    "expectedBalance",
    "missingReceipts",
    "missingExpenseReceipts",
    "missingLodgingReceipts",
    "receiptCount",
    "expenseCount",
    "lodgingCount",
    "advanceCount",
  ]) {
    assert.match(adminList, new RegExp(`item\\.${field}\\b`), `${field} must come from the row`);
  }
});

test("the summary is computed with a fixed batch query set", () => {
  assert.match(service, /travelId: \{ in: travelIds \}/);
  assert.doesNotMatch(service, /assignments\.map\(async/);
});
