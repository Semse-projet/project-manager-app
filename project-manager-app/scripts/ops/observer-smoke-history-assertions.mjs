/**
 * Fail-closed assertions for the production Observer A/B synthetic smoke.
 * The history HTTP projection deliberately omits tenantId; freshness and
 * ownership are checked with per-tenant observedAt from the signed /latest
 * response, together with exact cardinality and interleaved reads.
 * Do not print history response objects: they may contain operational metadata.
 */
import assert from "node:assert/strict";

export function assertEmptyObserverHistory(response) {
  assert.equal(response?.status, 200, "Signed history request must succeed");
  assert.equal(response?.data?.count, 0,
    "Foreign observation leaked into a tenant with no own observations");
  assert.ok(Array.isArray(response?.data?.snapshots),
    "History response must contain a snapshot array");
  assert.equal(response.data.snapshots.length, 0,
    "Tenant without observations received unexpected history entries");
}

export function assertOwnObserverHistory(response, expectedObservedAt) {
  assert.equal(response?.status, 200, "Signed history request must succeed");
  assert.ok(typeof expectedObservedAt === "string" && !Number.isNaN(Date.parse(expectedObservedAt)),
    "Expected signed latest observation timestamp is invalid");
  assert.equal(response?.data?.count, 1,
    "Each fresh synthetic tenant must retain exactly its own observation");
  assert.ok(Array.isArray(response?.data?.snapshots),
    "History response must contain a snapshot array");
  assert.equal(response.data.snapshots.length, 1,
    "Foreign or duplicate observation in tenant-local history");
  assert.equal(response.data.snapshots[0]?.observedAt, expectedObservedAt,
    "History entry does not match this tenant's signed latest observation");
}
