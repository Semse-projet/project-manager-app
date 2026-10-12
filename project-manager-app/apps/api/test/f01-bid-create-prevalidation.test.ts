import test from "node:test";
import assert from "node:assert/strict";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { BidsRepository } from "../dist/modules/bids/bids.repository.js";
import { OutboxRepository } from "../dist/modules/domain-events/outbox.repository.js";

// F01/issue #892: an unauthorized/invalid bid must be rejected before
// creating memberships or mutating organizations. Tests use deterministic
// Prisma doubles and make NO external calls.
const command = {
  tenantId: "TEST_f01_tenant",
  jobId: "TEST_f01_job",
  proOrgId: "TEST_f01_pro",
  orgId: "TEST_f01_pro",
  userId: "TEST_f01_pro_user",
  roles: ["PRO"],
  amount: 1200,
  etaDays: 5,
};

function harness(opts: {
  job?: { id: string; status: string; clientOrgId: string } | null;
  professionalOrgTenant?: string | null;
} = {}) {
  const effects: string[] = [];
  const job = opts.job === undefined
    ? { id: command.jobId, status: "POSTED", clientOrgId: "TEST_f01_client" }
    : opts.job;
  const prisma = {
    job: {
      async findFirst(query: { where: { id: string; tenantId: string; deletedAt: null } }) {
        effects.push("job.findFirst");
        assert.equal(query.where.id, command.jobId);
        assert.equal(query.where.tenantId, command.tenantId);
        assert.equal(query.where.deletedAt, null);
        return job;
      },
    },
    org: {
      async findUnique(query: { where: { id: string }; select: { tenantId: true } }) {
        effects.push("org.findUnique");
        assert.equal(query.where.id, command.proOrgId);
        assert.deepEqual(query.select, { tenantId: true });
        return opts.professionalOrgTenant === undefined || opts.professionalOrgTenant === null
          ? null : { tenantId: opts.professionalOrgTenant };
      },
      async upsert(query: { update: Record<string, unknown> }) {
        effects.push("org.upsert");
        assert.deepEqual(query.update, {}, "an existing organization cannot be reassigned or retyped");
        return { id: command.proOrgId };
      },
    },
    role: { findUnique: async () => { effects.push("role.findUnique"); return { id: "role_pro" }; } },
    membership: {
      findFirst: async () => { effects.push("membership.findFirst"); return { userId: command.userId }; },
      create: async () => { effects.push("membership.create"); return {}; },
    },
    jobReservation: { findFirst: async () => { effects.push("reservation.findFirst"); return null; } },
    contract: { findFirst: async () => { effects.push("contract.findFirst"); return null; } },
    bid: { findFirst: async () => { effects.push("bid.findFirst"); return { id: "existing_bid" }; } },
    $transaction: async () => { effects.push("transaction"); throw new Error("unexpected transaction"); },
  };
  const actorContext = {
    ensureActorContext: async () => { effects.push("actor.ensure"); },
  };
  const repository = new BidsRepository(prisma as never, actorContext as never, new OutboxRepository());
  return { repository, effects };
}

test("F01-N10 missing Job leaves actor, roles, memberships and org untouched", async () => {
  const { repository, effects } = harness({ job: null });
  await assert.rejects(() => repository.create(command), NotFoundException);
  assert.deepEqual(effects, ["job.findFirst"]);
});

test("F01-N11 own client organization cannot bid on its own Job", async () => {
  const { repository, effects } = harness({
    job: { id: command.jobId, status: "POSTED", clientOrgId: command.orgId },
  });
  await assert.rejects(() => repository.create(command), ForbiddenException);
  assert.deepEqual(effects, ["job.findFirst"]);
});

test("F01-N12 closed Job cannot provision a professional", async () => {
  const { repository, effects } = harness({
    job: { id: command.jobId, status: "ACCEPTED", clientOrgId: "TEST_f01_client" },
  });
  await assert.rejects(() => repository.create(command), BadRequestException);
  assert.deepEqual(effects, ["job.findFirst"]);
});

test("F01-N13 existing PRO org of another tenant is not reassigned", async () => {
  const { repository, effects } = harness({ professionalOrgTenant: "TEST_other_tenant" });
  await assert.rejects(() => repository.create(command), NotFoundException);
  assert.deepEqual(effects, ["job.findFirst", "org.findUnique"]);
});

test("F01-N14 valid job/existing org is not retyped or moved before duplicate check", async () => {
  const { repository, effects } = harness({ professionalOrgTenant: command.tenantId });
  await assert.rejects(() => repository.create(command));
  assert.deepEqual(effects, [
    "job.findFirst", "org.findUnique", "actor.ensure", "org.upsert",
    "role.findUnique", "membership.findFirst", "reservation.findFirst",
    "contract.findFirst", "bid.findFirst",
  ]);
});
