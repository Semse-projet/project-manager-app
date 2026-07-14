import assert from "node:assert/strict";
import test from "node:test";

import { searchRepo } from "../../scripts/spec-lib.mjs";

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
