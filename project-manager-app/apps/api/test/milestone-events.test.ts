import assert from "node:assert/strict";
import test from "node:test";
import { semseEventSchema } from "@semse/schemas";
import {
  buildMilestoneApprovedEvent,
  buildMilestoneCreatedEvent,
  buildMilestoneRejectedEvent,
  buildMilestoneRevisionRequestedEvent,
} from "../src/modules/milestones/milestones.events.ts";

const base = {
  tenantId: "tenant_1",
  milestoneId: "milestone_1",
  projectId: "project_1",
  jobId: "job_1",
  actorId: "user_1",
  occurredAt: "2026-07-17T12:00:00.000Z",
};

test("cada transición durable de milestone construye un evento canónico válido", () => {
  const events = [
    buildMilestoneCreatedEvent({ ...base, title: "Cimentación", amount: 1500, sequence: 1 }),
    buildMilestoneApprovedEvent({ ...base, amount: 1500 }),
    buildMilestoneRejectedEvent({ ...base, reason: "Falta evidencia final" }),
    buildMilestoneRevisionRequestedEvent({ ...base, reason: "Adjuntar foto panorámica" }),
  ];

  assert.deepEqual(events.map((event) => event.type), [
    "milestone.created",
    "milestone.approved",
    "milestone.rejected",
    "milestone.revision_requested",
  ]);
  for (const event of events) {
    assert.equal(semseEventSchema.safeParse(event).success, true, event.type);
  }
});
