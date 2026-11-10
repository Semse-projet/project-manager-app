/**
 * POST /v1/jobs/:jobId/transition required `jobs:update`, which no role held:
 * every job transition answered 403 (the professional could not start a job or
 * ask for review, and no job ever reached COMPLETED, so ratings were impossible).
 * The route now requires `jobs:transition`; who may take each step is still
 * decided by assertTransitionAuthorized in the jobs service.
 * Run: node --experimental-strip-types --test tests/unit/job-transition-permission.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { hasPermission, rolePermissions } from "../../packages/auth/src/index.ts";

test("client, professional and ops can call the job transition route", () => {
  for (const role of ["CLIENT", "PRO", "OPS_ADMIN"]) {
    assert.ok(hasPermission([role], "jobs:transition"), `${role} needs jobs:transition`);
  }
  for (const alias of ["PROFESSIONAL", "ADMIN"]) {
    assert.ok(hasPermission([alias], "jobs:transition"), `${alias} resolves to a role with jobs:transition`);
  }
});

test("field workers, event consumers and the agro demo role cannot transition jobs", () => {
  for (const role of ["WORKER", "EVENT_CONSUMER", "DEMO_AGRO"]) {
    assert.equal(hasPermission([role], "jobs:transition"), false, role);
  }
});

test("jobs:update stays ungranted here: the transition route no longer depends on it", () => {
  // Editing a job (PATCH /v1/jobs/:jobId) and task status still use jobs:update.
  // Granting it is a separate decision: JobsService.update gained an owner check in
  // #1122, but nothing in this change grants or needs it.
  const holders = Object.entries(rolePermissions).filter(([, perms]) => perms.includes("jobs:update")).map(([role]) => role);
  assert.deepEqual(holders, [], "granting jobs:update is a separate, reviewed change");
});

test("the transition route is gated by jobs:transition, not jobs:update", () => {
  const controller = readFileSync("apps/api/src/modules/jobs/jobs.controller.ts", "utf8");
  assert.match(controller, /@Post\(":jobId\/transition"\)\s*\n\s*@RequirePermissions\("jobs:transition"\)/);
});
