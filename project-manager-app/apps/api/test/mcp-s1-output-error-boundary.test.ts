import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, NotFoundException, InternalServerErrorException } from "@nestjs/common";
import {
  projectStatusMcpProjection,
  rethrowSafeMcpProjectReadError,
  McpProjectUnavailableError
} from "../dist/modules/projects/mcp-project-status.boundary.js";

/**
 * Internal D5/D6 boundary: NEVER called by unverified client input.
 * Authentication, authorization, consent and OAuth D2 MUST be satisfied
 * upstream in a reviewed server-side adapter before this code is connected.
 * This test file does not add a tool endpoint or authorize MCP access.
 */
test("D5: explicit output allowlist never exposes tenant, org, job, financial or secret data", () => {
  const record = {
    projectId: "project-a",
    status: "in_progress",
    tenantId: "tenant-secret",
    orgId: "org-secret",
    assignedProOrgId: "pro-secret",
    jobId: "job-secret",
    token: "secret",
    financials: { balance: 999 }
  };
  const output = projectStatusMcpProjection(record, "req-abc_123");
  assert.deepEqual(output, {
    projectId: "project-a",
    status: "in_progress",
    correlationId: "req-abc_123"
  });
  assert.deepEqual(Object.keys(output).sort(), ["correlationId", "projectId", "status"]);
  assert.equal(Object.isFrozen(output), true);
  assert.equal(JSON.stringify(output).includes("secret"), false);
  assert.equal(JSON.stringify(output).includes("balance"), false);
});

test("D5: status must match ProjectRecord and correlation ID cannot be empty", () => {
  assert.throws(
    () => projectStatusMcpProjection({ projectId: "project-a", status: "PAYMENT_RELEASED" }, "req-1"),
    /Invalid/,
  );
  assert.throws(
    () => projectStatusMcpProjection({ projectId: "project-a", status: "open" }, "   "),
    /Invalid/,
  );
  assert.throws(
    () => projectStatusMcpProjection({ projectId: "", status: "open" }, "req-1"),
    /Invalid/,
  );
});

test("D6: missing and foreign resource have precisely the same safe external error", () => {
  const outcomes = [];
  for (const exception of [
    new NotFoundException("Project 'secret-other-tenant' not found"),
    new ForbiddenException("actor not permitted: org_private"),
  ]) {
    try {
      rethrowSafeMcpProjectReadError(exception);
      assert.fail("must throw");
    } catch (error) {
      assert.equal(error instanceof McpProjectUnavailableError, true);
      assert.equal(error.message, "Project unavailable");
      assert.equal(error.code, "RESOURCE_UNAVAILABLE");
      assert.equal(error.cause, undefined);
      assert.equal(JSON.stringify(error).includes("secret"), false);
      outcomes.push({ name: error.name, message: error.message, code: error.code });
    }
  }
  assert.deepEqual(outcomes[0], outcomes[1]);
});

test("D6: infrastructure errors are not misclassified as resource-not-found", () => {
  const infrastructure = new InternalServerErrorException("database unavailable");
  assert.throws(() => rethrowSafeMcpProjectReadError(infrastructure), (actual) => actual === infrastructure);
  const unexpected = new Error("unexpected");
  assert.throws(() => rethrowSafeMcpProjectReadError(unexpected), (actual) => actual === unexpected);
});
