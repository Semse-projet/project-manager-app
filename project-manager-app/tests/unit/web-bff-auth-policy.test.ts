import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSemseApiUnauthorizedBody,
  isPublicSemseApiPath,
  isSemseApiPath,
} from "../../apps/web/lib/semse-api-auth.ts";

test("recognizes SEMSE API paths", () => {
  assert.equal(isSemseApiPath("/api/semse"), true);
  assert.equal(isSemseApiPath("/api/semse/jobs"), true);
  assert.equal(isSemseApiPath("/api/semse/public/intake/analyze"), true);
  assert.equal(isSemseApiPath("/api/pro/example"), false);
  assert.equal(isSemseApiPath("/client/dashboard"), false);
});

test("keeps only explicit SEMSE API allowlist public", () => {
  assert.equal(isPublicSemseApiPath("/api/semse/auth/token"), true);
  assert.equal(isPublicSemseApiPath("/api/semse/auth/login"), true);
  assert.equal(isPublicSemseApiPath("/api/semse/auth/register"), true);
  assert.equal(isPublicSemseApiPath("/api/semse/auth/forgot-password"), true);
  assert.equal(isPublicSemseApiPath("/api/semse/auth/reset-password"), true);
  assert.equal(isPublicSemseApiPath("/api/semse/healthz"), true);
  assert.equal(isPublicSemseApiPath("/api/semse/stats/public"), true);
  assert.equal(isPublicSemseApiPath("/api/semse/public/intake/analyze"), true);
});

test("classifies sensitive SEMSE BFF routes as private", () => {
  assert.equal(isPublicSemseApiPath("/api/semse/jobs"), false);
  assert.equal(isPublicSemseApiPath("/api/semse/buildops/projects"), false);
  assert.equal(isPublicSemseApiPath("/api/semse/agro/farms"), false);
  assert.equal(isPublicSemseApiPath("/api/semse/ops/ecosystem-metrics"), false);
  assert.equal(isPublicSemseApiPath("/api/semse/sse/mission-control"), false);
});

test("returns stable unauthorized response body", () => {
  assert.deepEqual(buildSemseApiUnauthorizedBody(), {
    error: {
      status: 401,
      message: "Authentication required for SEMSE API route",
    },
  });
});
