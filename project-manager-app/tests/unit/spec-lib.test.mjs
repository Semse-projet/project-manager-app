import assert from "node:assert/strict";
import test from "node:test";

import {
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
