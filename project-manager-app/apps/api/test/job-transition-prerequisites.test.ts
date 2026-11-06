/**
 * Once jobs:transition opened the generic transition route (Codex review on #1111):
 * - reserving, accepting or releasing a reservation must go through the reservation
 *   flow (client approval, expiry, project creation), not POST /v1/jobs/:id/transition;
 * - ACCEPTED -> IN_PROGRESS needs an active contractual basis (STATE_MACHINES.md):
 *   a contract signed by both parties.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ConflictException, UnprocessableEntityException } from "@nestjs/common";
import { JobsService, assertNotReservationFlowTransition } from "../dist/modules/jobs/jobs.service.js";

function service(from: string, contract: { signedClientAt: Date | null; signedProAt: Date | null } | null) {
  const updates: string[] = [];
  const job = (status: string) => ({ id: "job_1", tenantId: "tenant_1", status, title: "Trabajo", scope: "Alcance", category: "general" });
  const repository = {
    async findById() { return job(from); },
    async getTransitionAccess() { return { clientOrgId: "org_client_1", professionalOrgId: "org_pro_1" }; },
    async updateStatus(input: { status: string }) { updates.push(input.status); return job(input.status); },
  };
  const prisma = {
    contract: { async findFirst() { return contract; } },
    workspaceMemoryEntry: { async findMany() { return []; } },
  };
  const noop = { async append() { return undefined; }, async emit() { return undefined; } };
  const svc = new JobsService(repository as never, noop as never, noop as never, noop as never, prisma as never, undefined);
  const transition = (targetStatus: string, roles: string[], orgId: string) =>
    svc.transitionJob({ tenantId: "tenant_1", orgId, userId: "usr_1", roles, jobId: "job_1", targetStatus: targetStatus as never, requestId: "req_1" });
  return { transition, updates };
}

const signed = { signedClientAt: new Date(), signedProAt: new Date() };

test("reservation steps are refused on the generic route for clients and professionals", () => {
  for (const roles of [["CLIENT"], ["PRO"]]) {
    assert.throws(() => assertNotReservationFlowTransition("posted", "reserved", roles), UnprocessableEntityException);
    assert.throws(() => assertNotReservationFlowTransition("reserved", "accepted", roles), UnprocessableEntityException);
    assert.throws(() => assertNotReservationFlowTransition("reserved", "posted", roles), UnprocessableEntityException);
  }
  // Publishing a draft is not a reservation step.
  assert.doesNotThrow(() => assertNotReservationFlowTransition("draft", "posted", ["CLIENT"]));
  // Ops may override (audited like any other transition).
  assert.doesNotThrow(() => assertNotReservationFlowTransition("reserved", "accepted", ["OPS_ADMIN"]));
});

test("a professional cannot self-accept a reserved job through the transition route", async () => {
  const { transition, updates } = service("reserved", null);
  await assert.rejects(transition("accepted", ["PRO"], "org_pro_1"), /reservation flow/);
  assert.deepEqual(updates, []);
});

test("work cannot start without a contract signed by both parties", async () => {
  for (const contract of [null, { signedClientAt: new Date(), signedProAt: null }, { signedClientAt: null, signedProAt: new Date() }]) {
    const { transition, updates } = service("accepted", contract);
    await assert.rejects(transition("in_progress", ["PRO"], "org_pro_1"), ConflictException);
    assert.deepEqual(updates, []);
  }
  // Ops are held to it too.
  await assert.rejects(service("awarded", null).transition("in_progress", ["OPS_ADMIN"], "org_ops_1"), /contract signed by both parties/);
});

test("work starts once both parties signed, and rework from review needs no new check", async () => {
  const started = service("accepted", signed);
  assert.equal((await started.transition("in_progress", ["PRO"], "org_pro_1")).status, "in_progress");
  const rework = service("review", null);
  assert.equal((await rework.transition("in_progress", ["CLIENT"], "org_client_1")).status, "in_progress");
});
