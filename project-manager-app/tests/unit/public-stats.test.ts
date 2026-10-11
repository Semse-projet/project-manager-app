import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { toPublicStats } from "../../apps/web/lib/public-stats.ts";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../..");
const routeSource = fs.readFileSync(path.join(repoRoot, "apps/web/app/api/semse/stats/public/route.ts"), "utf8");

test("toPublicStats reports exactly what the API returned, including zeros", () => {
  assert.deepEqual(
    toPublicStats({ stats: { activeJobs: 15, verifiedProfessionals: 0, completedProjects: 0, averageRating: 0 } }),
    { activeJobs: 15, verifiedProfessionals: 0, completedProjects: 0, averageRating: 0 },
  );
});

test("toPublicStats never invents a value: missing or invalid fields become null", () => {
  assert.deepEqual(toPublicStats({ stats: {} }), {
    activeJobs: null,
    verifiedProfessionals: null,
    completedProjects: null,
    averageRating: null,
  });
  assert.deepEqual(
    toPublicStats({ stats: { activeJobs: -1, verifiedProfessionals: "12", completedProjects: Number.NaN, averageRating: 9 } }),
    { activeJobs: null, verifiedProfessionals: null, completedProjects: null, averageRating: null },
  );
});

test("toPublicStats rounds counts down and ratings to one decimal", () => {
  assert.deepEqual(
    toPublicStats({ stats: { activeJobs: 7.9, verifiedProfessionals: 3, completedProjects: 2, averageRating: 4.678 } }),
    { activeJobs: 7, verifiedProfessionals: 3, completedProjects: 2, averageRating: 4.7 },
  );
});

test("toPublicStats returns null when there is no usable stats object", () => {
  for (const payload of [undefined, null, "x", 5, [], {}, { stats: null }, { stats: "x" }]) {
    // arrays and {} have no `stats` object, so the route must answer with an error.
    assert.equal(toPublicStats(payload), null, JSON.stringify(payload));
  }
});

test("the stats/public route has no hard-coded metrics and no static server identity", () => {
  assert.doesNotMatch(routeSource, /\b(47|98\.7|48|16)\b/, "no invented marketing numbers");
  assert.doesNotMatch(routeSource, /_fallback/, "no silent fallback payload");
  assert.doesNotMatch(routeSource, /\bfetchSemseData/, "must not use the static server identity helpers");
  assert.doesNotMatch(routeSource, /authorization/i, "public route must not send a bearer token");
  assert.match(routeSource, /\/v1\/intelligence\/public\/overview/);
  assert.match(routeSource, /"x-tenant-id"/);
  assert.match(routeSource, /\btoPublicStats\b/);
});
