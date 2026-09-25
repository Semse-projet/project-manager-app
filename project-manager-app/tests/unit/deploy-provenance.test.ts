/**
 * Unit tests for @semse/shared deploy provenance (ADR-030).
 * Run: node --experimental-strip-types --test tests/unit/deploy-provenance.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

import { getDeployProvenance } from "../../packages/shared/src/deploy-provenance.ts";

test("falls back to 'unknown' when RAILWAY_GIT_COMMIT_SHA/RAILWAY_DEPLOYMENT_CREATED_AT are absent", () => {
  const result = getDeployProvenance({});
  assert.equal(result.gitSha, "unknown");
  assert.equal(result.buildTime, "unknown");
});

test("reads RAILWAY_GIT_COMMIT_SHA and RAILWAY_DEPLOYMENT_CREATED_AT when present", () => {
  const result = getDeployProvenance({
    RAILWAY_GIT_COMMIT_SHA: "68f27f8aac2a8c7f73e4a38e12da7e3e3db506a9",
    RAILWAY_DEPLOYMENT_CREATED_AT: "2026-09-13T02:31:58.000Z",
  });
  assert.equal(result.gitSha, "68f27f8aac2a8c7f73e4a38e12da7e3e3db506a9");
  assert.equal(result.buildTime, "2026-09-13T02:31:58.000Z");
});

test("never fabricates a value — an empty string env var still falls back to 'unknown'", () => {
  const result = getDeployProvenance({ RAILWAY_GIT_COMMIT_SHA: "" });
  assert.equal(result.gitSha, "unknown");
});
