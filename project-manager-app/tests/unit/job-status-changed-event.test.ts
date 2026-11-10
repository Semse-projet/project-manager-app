/**
 * jobs.service.ts emits `job.status_changed` through DomainEventBus on every
 * job transition and on the system auto-complete, and EVENT_CATALOG.md lists it,
 * but semseEventSchema did not include it: emit() threw a ZodError after the
 * status and audit row were written, so every transition answered 500.
 * Run: node --experimental-strip-types --test tests/unit/job-status-changed-event.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { EVENT_AGENT_MAP, SEMSE_EVENT_TYPES, semseEventSchema } from "../../packages/schemas/src/domain-events.schema.ts";

const meta = {
  tenantId: "tenant_1",
  correlationId: "job:job_1:accepted:in_progress",
  actorId: "usr_pro_1",
  actorType: "user",
  occurredAt: new Date().toISOString(),
  version: 1,
};

test("the bus accepts job.status_changed as transitionJob emits it", () => {
  const parsed = semseEventSchema.parse({
    type: "job.status_changed",
    meta,
    payload: { jobId: "job_1", fromStatus: "ACCEPTED", toStatus: "in_progress" },
    triggers: ["risk", "audit"],
  });
  assert.equal(parsed.type, "job.status_changed");
});

test("the bus accepts job.status_changed as systemCompleteJob emits it", () => {
  const parsed = semseEventSchema.parse({
    type: "job.status_changed",
    meta: { ...meta, actorId: "SYSTEM", actorType: "system", correlationId: "job:job_1:auto_complete" },
    payload: { jobId: "job_1", fromStatus: "REVIEW", toStatus: "completed" },
    triggers: ["audit"],
  });
  assert.deepEqual(parsed.triggers, ["audit"]);
});

test("job.status_changed still requires its payload", () => {
  assert.throws(() => semseEventSchema.parse({ type: "job.status_changed", meta, payload: { jobId: "job_1" } }));
});

test("it is registered in the type list, the agent map and the event catalog", () => {
  assert.ok((SEMSE_EVENT_TYPES as readonly string[]).includes("job.status_changed"));
  assert.deepEqual(EVENT_AGENT_MAP["job.status_changed"], ["risk", "audit"]);
  assert.match(readFileSync("docs/foundation/EVENT_CATALOG.md", "utf8"), /^- `job\.status_changed`$/m);
});

test("every event type jobs.service.ts emits through the bus is in the schema", () => {
  const service = readFileSync("apps/api/src/modules/jobs/jobs.service.ts", "utf8");
  const emitted = [...new Set([...service.matchAll(/type:\s*"(job\.[a-z_.]+)"/g)].map((m) => m[1]))];
  assert.ok(emitted.length > 0);
  for (const type of emitted) assert.ok((SEMSE_EVENT_TYPES as readonly string[]).includes(type), type);
});
