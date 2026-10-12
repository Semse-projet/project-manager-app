import test from "node:test";
import assert from "node:assert/strict";
import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";

import { BidsRepository } from "../dist/modules/bids/bids.repository.js";
import { OutboxRepository } from "../dist/modules/domain-events/outbox.repository.js";

/**
 * F01 Marketplace — repository boundary regression tests.
 *
 * Deterministic in-memory Prisma doubles, no HTTP/DB/production writes.
 * The tests exercise the real BidsRepository, including the transaction and
 * OutboxRepository. They do NOT replace authenticated HTTP + PostgreSQL E2E.
 * Contract: docs/specs/api/jobs.spec.md and
 * docs/specs/operations/jobs-bids-event-projection.spec.md.
 */
const CLIENT = {
  tenantId: "tenant_A",
  bidId: "bid_A1",
  userId: "client_user_A",
  orgId: "client_org_A",
  roles: ["CLIENT"],
};

function decimal(n: number) {
  return { toNumber: () => n };
}

function bidFixture(status = "SUBMITTED") {
  return {
    id: "bid_A1",
    jobId: "job_A",
    proOrgId: "pro_org_A",
    professionalUserId: "pro_user_A",
    amount: decimal(1250),
    etaDays: 7,
    status,
    job: {
      id: "job_A",
      tenantId: "tenant_A",
      status: "POSTED",
      clientOrgId: "client_org_A",
    },
  };
}

function harness(options: {
  bid?: ReturnType<typeof bidFixture> | null;
  actorError?: Error;
} = {}) {
  const row = options.bid === undefined ? bidFixture() : options.bid;
  const calls: { lookup: Record<string, unknown>[]; tx: number } = {
    lookup: [],
    tx: 0,
  };
  const prisma = {
    bid: {
      async findFirst(query: Record<string, unknown>) {
        calls.lookup.push(query);
        return row;
      },
    },
    contract: {
      async findFirst() {
        return null;
      },
    },
    async $transaction() {
      calls.tx += 1;
      throw new Error("unexpected transaction in denial-path test");
    },
  };
  const actorContext = {
    async ensureActorContext() {
      if (options.actorError) throw options.actorError;
    },
  };
  const repository = new BidsRepository(
    prisma as never,
    actorContext as never,
    new OutboxRepository(),
  );
  return { repository, prisma, calls };
}

test("F01-N02 cross-tenant bid cannot be accepted: scoped lookup returns 404 without writes", async () => {
  const { repository, calls } = harness({ bid: null });

  await assert.rejects(
    () => repository.accept({ ...CLIENT, tenantId: "tenant_B", orgId: "client_org_B" }),
    (error: unknown) => error instanceof NotFoundException && error.getStatus() === 404,
  );
  assert.equal(calls.tx, 0);
  assert.deepEqual(calls.lookup[0], {
    where: { id: CLIENT.bidId, job: { tenantId: "tenant_B" } },
    include: { job: { select: { id: true, tenantId: true, status: true, clientOrgId: true } } },
  });
});

test("F01-N04 wrong client organization cannot accept an existing bid", async () => {
  const { repository, calls } = harness();

  await assert.rejects(
    () => repository.accept({ ...CLIENT, orgId: "other_client_org_A" }),
    (error: unknown) => error instanceof ForbiddenException && error.getStatus() === 403,
  );
  assert.equal(calls.tx, 0, "forbidden actor must not create reservation/project/outbox");
});

test("F01-N03 rejected actor context stops before querying a bid", async () => {
  const { repository, calls } = harness({ actorError: new ForbiddenException("membership inactive") });

  await assert.rejects(
    () => repository.accept(CLIENT),
    (error: unknown) => error instanceof ForbiddenException && error.getStatus() === 403,
  );
  assert.equal(calls.lookup.length, 0);
  assert.equal(calls.tx, 0);
});

test("F01-N06 repeat acceptance of already-accepted bid is read-only", async () => {
  const { repository, calls } = harness({ bid: bidFixture("ACCEPTED") });

  const result = await repository.accept(CLIENT);
  assert.equal(result.status, "accepted");
  assert.equal(result.jobId, "job_A");
  assert.equal(calls.tx, 0, "retry must not duplicate reservation, project, or outbox");
});

test("F01-N04 rejected bid cannot be accepted by the owner", async () => {
  const { repository, calls } = harness({ bid: bidFixture("REJECTED") });

  await assert.rejects(
    () => repository.accept(CLIENT),
    (error: unknown) => error instanceof ConflictException && error.getStatus() === 409,
  );
  assert.equal(calls.tx, 0);
});

test("F01-N09 professional cannot place a bid on behalf of another pro organization", async () => {
  let prismaCalls = 0;
  const prisma = new Proxy({}, {
    get() {
      prismaCalls += 1;
      throw new Error("unexpected Prisma access in denied bid");
    },
  });
  const repo = new BidsRepository(
    prisma as never,
    { ensureActorContext: async () => undefined } as never,
    new OutboxRepository(),
  );

  await assert.rejects(
    () => repo.create({
      tenantId: "tenant_A",
      jobId: "job_A",
      userId: "pro_user_A",
      orgId: "pro_org_A",
      proOrgId: "pro_org_other",
      roles: ["PRO"],
      amount: 1250,
      etaDays: 7,
    }),
    (error: unknown) => error instanceof ForbiddenException && error.getStatus() === 403,
  );
  assert.equal(prismaCalls, 0, "reject before creating membership or changing organizations");
});

test("F01-A03 accept winner rejects competitors and assigns project in one repository transaction", async () => {
  const rows = [bidFixture(), {
    ...bidFixture(),
    id: "bid_A2",
    proOrgId: "pro_org_B",
    professionalUserId: "pro_user_B",
    amount: decimal(1325),
  }];
  const events: Array<Record<string, any>> = [];
  const reservations: Array<Record<string, any>> = [];
  const projects: Array<Record<string, any>> = [];
  let txCount = 0;
  let jobStatus = "POSTED";

  const prisma = {
    bid: {
      async findFirst(query: { where: { id: string; job: { tenantId: string } } }) {
        assert.equal(query.where.job.tenantId, "tenant_A");
        return rows.find(r => r.id === query.where.id) ?? null;
      },
    },
    contract: { async findFirst() { return null; } },
    async $transaction(callback: (tx: Record<string, any>) => Promise<unknown>) {
      txCount += 1;
      const tx = {
        jobReservation: {
          async findFirst() { return null; },
          async create({ data }: { data: Record<string, any> }) {
            reservations.push(data);
            return data;
          },
        },
        bid: {
          async update({ where, data }: { where: { id: string }; data: { status: string } }) {
            const target = rows.find(r => r.id === where.id);
            assert.ok(target);
            target.status = data.status;
            return target;
          },
          async findMany() {
            return rows.filter(r => r.id !== CLIENT.bidId && r.status === "SUBMITTED")
              .map(r => ({ id: r.id, jobId: r.jobId, proOrgId: r.proOrgId }));
          },
          async updateMany({ where, data }: { where: { id: { not: string } }; data: { status: string } }) {
            let count = 0;
            for (const r of rows) {
              if (r.id !== where.id.not && r.status === "SUBMITTED") {
                r.status = data.status;
                count += 1;
              }
            }
            return { count };
          },
        },
        job: {
          async update({ data }: { data: { status: string } }) {
            jobStatus = data.status;
            return {};
          },
        },
        project: {
          async upsert({ create }: { create: Record<string, any> }) {
            projects.push(create);
            return create;
          },
        },
        domainOutboxEvent: {
          async create({ data }: { data: Record<string, any> }) {
            events.push(data);
            return data;
          },
        },
      };
      return callback(tx);
    },
  };
  const repository = new BidsRepository(
    prisma as never,
    { ensureActorContext: async () => undefined } as never,
    new OutboxRepository(),
  );
  const winner = await repository.accept(CLIENT);

  assert.equal(winner.status, "accepted");
  assert.equal(rows[0].status, "ACCEPTED");
  assert.equal(rows[1].status, "REJECTED");
  assert.equal(jobStatus, "ACCEPTED");
  assert.equal(txCount, 1);
  assert.equal(reservations.length, 1);
  assert.equal(reservations[0]?.professionalOrgId, "pro_org_A");
  assert.equal(projects.length, 1);
  assert.equal(projects[0]?.jobId, "job_A");
  assert.equal(projects[0]?.assignedProOrgId, "pro_org_A");
  assert.deepEqual(events.map(e => e.eventType), ["bid.accepted.v1", "bid.rejected.v1"]);
  assert.deepEqual(events.map(e => e.entityId), ["bid_A1", "bid_A2"]);
  assert.ok(events.every(e => e.tenantId === "tenant_A"));
});
