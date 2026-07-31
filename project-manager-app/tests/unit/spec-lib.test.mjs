import assert from "node:assert/strict";
import test from "node:test";

import {
  deliveryStateErrors,
  isSddV2,
  missingDeliveryMetadata,
  searchRepo,
} from "../../scripts/spec-lib.mjs";

test("searchRepo recognizes NestJS routes composed by controller and handler decorators", () => {
  assert.equal(
    searchRepo(["apps/api/src/modules/satellites"], ["v1/satellites/tokens"]),
    true,
  );
  assert.equal(
    searchRepo(["apps/api/src/modules/repo-knowledge"], ["v1/repo-knowledge/graphify/status"]),
    true,
  );
});

test("searchRepo rejects an endpoint whose handler is not implemented", () => {
  assert.equal(
    searchRepo(["apps/api/src/modules/satellites"], ["v1/satellites/webhooks"]),
    false,
  );
});

test("SDD 2.0 delivery metadata treats explicit empty lists as present", () => {
  const rawFrontmatter = {
    sdd_version: "2.0",
    code_status: "NOT_STARTED",
    ci_status: "NOT_RUN",
    merge_status: "UNMERGED",
    deploy_status: "NOT_DEPLOYED",
    activation_status: "INACTIVE",
    migration_status: "NOT_APPLICABLE",
    feature_flags: [],
    production_evidence: [],
  };
  const spec = {
    rawFrontmatter,
    metadata: { ...rawFrontmatter },
  };

  assert.equal(isSddV2(spec), true);
  assert.deepEqual(missingDeliveryMetadata(spec), []);
});

test("VERIFIED accepts an evidenced production canary without claiming global activation", () => {
  assert.deepEqual(
    deliveryStateErrors("f3", {
      status: "VERIFIED",
      code_status: "COMPLETE",
      ci_status: "PASS",
      merge_status: "MERGED",
      deploy_status: "DEPLOYED",
      activation_status: "CANARY",
      production_evidence: ["railway:f3:tenant_default:verified"],
      last_verified: "2026-07-31",
    }),
    [],
  );
});

test("CANARY requires production evidence and a verification date", () => {
  assert.deepEqual(
    deliveryStateErrors("feature", {
      status: "IMPLEMENTED",
      code_status: "COMPLETE",
      ci_status: "PASS",
      merge_status: "MERGED",
      deploy_status: "DEPLOYED",
      activation_status: "CANARY",
      production_evidence: [],
      last_verified: "",
    }),
    [
      "feature: CANARY requires at least one production_evidence entry",
      "feature: CANARY requires last_verified in YYYY-MM-DD format",
    ],
  );
});
