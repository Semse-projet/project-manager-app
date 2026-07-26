import assert from "node:assert/strict";
import test from "node:test";

import {
  captureComplianceSource,
  deriveComplianceChecks,
  type ComplianceSnapshot,
} from "../../apps/web/lib/admin/compliance-checks.ts";

function available<T>(data: T) {
  return { available: true, data };
}

function emptySnapshot(): ComplianceSnapshot {
  return {
    jobs: available([]),
    disputes: available([]),
    members: available([]),
    ratings: available({ items: [] }),
    travels: available([]),
  };
}

test("captureComplianceSource preserves whether a source was actually available", async () => {
  const loaded = await captureComplianceSource(Promise.resolve(["real"]), []);
  const failed = await captureComplianceSource(
    Promise.reject(new Error("offline")),
    [] as string[],
  );

  assert.deepEqual(loaded, { available: true, data: ["real"] });
  assert.deepEqual(failed, { available: false, data: [] });
});

test("an unavailable source produces pending, never compliant", () => {
  const snapshot = emptySnapshot();
  snapshot.jobs = { available: false, data: [] };

  const result = deriveComplianceChecks(snapshot);
  const contracts = result.items.find((item) => item.id === "c1");

  assert.equal(contracts?.status, "pending");
  assert.match(contracts?.detail ?? "", /No se asume cumplimiento/);
  assert.deepEqual(result.unavailableSources, ["trabajos"]);
});

test("partial organization membership data cannot produce a green identity check", () => {
  const snapshot = emptySnapshot();
  snapshot.members = { available: false, data: [] };

  const result = deriveComplianceChecks(snapshot);
  const identity = result.items.find((item) => item.id === "c3");

  assert.equal(identity?.status, "pending");
  assert.equal(identity?.affectedCount, undefined);
});

test("available empty sources remain distinguishable from failed sources", () => {
  const result = deriveComplianceChecks(emptySnapshot());

  assert.deepEqual(
    result.items.slice(0, 5).map((item) => item.status),
    ["compliant", "compliant", "compliant", "compliant", "compliant"],
  );
  assert.deepEqual(result.unavailableSources, []);
});

test("manual legal and fiscal checks do not fabricate deadlines or integrations", () => {
  const result = deriveComplianceChecks(emptySnapshot());
  const manualChecks = result.items.filter((item) => item.id === "c6" || item.id === "c7");

  assert.equal(manualChecks.length, 2);
  assert.equal(manualChecks.every((item) => item.status === "pending"), true);
  assert.equal(manualChecks.every((item) => item.deadline === undefined), true);
  assert.match(manualChecks[0]?.title ?? "", /revisión manual/i);
  assert.match(manualChecks[1]?.detail ?? "", /fuente fiscal/i);
});
