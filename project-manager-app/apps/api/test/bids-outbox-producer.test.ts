import test from "node:test";
import assert from "node:assert/strict";

import { OutboxRepository } from "../dist/modules/domain-events/outbox.repository.js";
import { BidsRepository } from "../dist/modules/bids/bids.repository.js";

function amount(value: number) {
  return { toNumber: () => value };
}

function makeCreateHarness() {
  const outboxRows: Array<Record<string, unknown>> = [];
  const bidRows: Array<Record<string, unknown>> = [];

  const prisma = {
    role: {
      findUnique: async () => ({ id: "role_pro" }),
    },
    membership: {
      findFirst: async () => ({ userId: "usr_pro_1" }),
    },
    org: {
      upsert: async () => ({ id: "org_pro_1" }),
    },
    job: {
      findFirst: async () => ({
        id: "job_1",
        tenantId: "tenant_1",
        status: "POSTED",
        clientOrgId: "org_client_1",
      }),
    },
    jobReservation: {
      findFirst: async () => null,
    },
    contract: {
      findFirst: async () => null,
    },
    bid: {
      findFirst: async () => null, // no existing duplicate bid
    },
    $transaction: async (
      callback: (tx: Record<string, any>) => Promise<unknown>,
    ) => {
      const tx = {
        bid: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            const row = {
              id: "bid_1",
              ...data,
              amount: amount(data.amount as number),
              job: { id: "job_1", tenantId: "tenant_1", status: "POSTED", clientOrgId: "org_client_1" },
            };
            bidRows.push(row);
            return row;
          },
        },
        domainOutboxEvent: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            outboxRows.push(data);
            return data;
          },
        },
      };
      return callback(tx);
    },
  };

  const actorContext = { ensureActorContext: async () => undefined };
  const outboxRepository = new OutboxRepository();
  const repository = new BidsRepository(prisma as never, actorContext as never, outboxRepository);
  return { repository, outboxRows, bidRows };
}

const createCommand = {
  tenantId: "tenant_1",
  jobId: "job_1",
  proOrgId: "org_pro_1",
  userId: "usr_pro_1",
  orgId: "org_pro_1",
  amount: 4500,
  etaDays: 10,
};

test("bids.create writes bid.created.v1 to the outbox inside the same transaction as the bid row", async () => {
  const { repository, outboxRows, bidRows } = makeCreateHarness();

  await repository.create(createCommand);

  assert.equal(bidRows.length, 1);
  assert.equal(outboxRows.length, 1);
  assert.equal(outboxRows[0]?.eventType, "bid.created.v1");
  assert.equal(outboxRows[0]?.entityId, "bid_1");
  assert.equal(outboxRows[0]?.idempotencyKey, "bid.created.v1:bid_1");
  assert.deepEqual(outboxRows[0]?.payloadJson, {
    bidId: "bid_1",
    jobId: "job_1",
    proOrgId: "org_pro_1",
    professionalUserId: "usr_pro_1",
    amount: 4500,
    etaDays: 10,
  });
});

function makeAcceptHarness(input: {
  submittedBidIds: string[];
}) {
  const outboxRows: Array<Record<string, unknown>> = [];

  const acceptedBid = {
    id: "bid_accepted",
    jobId: "job_1",
    proOrgId: "org_pro_1",
    professionalUserId: "usr_pro_1",
    amount: amount(4500),
    etaDays: 10,
    status: "SUBMITTED",
    job: { id: "job_1", tenantId: "tenant_1", status: "PUBLISHED", clientOrgId: "org_client_1" },
  };

  const prisma = {
    bid: {
      findFirst: async () => acceptedBid,
    },
    contract: {
      findFirst: async () => null,
    },
    $transaction: async (
      callback: (tx: Record<string, any>) => Promise<unknown>,
    ) => {
      const tx = {
        jobReservation: {
          findFirst: async () => null,
          create: async () => ({}),
        },
        bid: {
          update: async () => ({
            ...acceptedBid,
            status: "ACCEPTED",
          }),
          findMany: async () =>
            input.submittedBidIds.map((id) => ({ id, jobId: "job_1", proOrgId: `org_pro_${id}` })),
          updateMany: async () => ({ count: input.submittedBidIds.length }),
        },
        job: {
          update: async () => ({}),
        },
        project: {
          upsert: async () => ({}),
        },
        domainOutboxEvent: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            outboxRows.push(data);
            return data;
          },
        },
      };
      return callback(tx);
    },
  };

  const actorContext = { ensureActorContext: async () => undefined };
  const outboxRepository = new OutboxRepository();
  const repository = new BidsRepository(prisma as never, actorContext as never, outboxRepository);
  return { repository, outboxRows };
}

const acceptCommand = {
  tenantId: "tenant_1",
  bidId: "bid_accepted",
  userId: "usr_client_1",
  orgId: "org_client_1",
  roles: ["CLIENT"],
};

test("bids.accept writes bid.accepted.v1 for the winner and one bid.rejected.v1 per outbid competitor", async () => {
  const { repository, outboxRows } = makeAcceptHarness({
    submittedBidIds: ["bid_other_1", "bid_other_2"],
  });

  await repository.accept(acceptCommand);

  assert.equal(outboxRows.length, 3);
  assert.equal(outboxRows[0]?.eventType, "bid.accepted.v1");
  assert.equal(outboxRows[0]?.entityId, "bid_accepted");
  assert.equal(outboxRows[0]?.idempotencyKey, "bid.accepted.v1:bid_accepted");

  const rejected = outboxRows.slice(1);
  assert.deepEqual(
    rejected.map((row) => row.entityId),
    ["bid_other_1", "bid_other_2"],
  );
  for (const row of rejected) {
    assert.equal(row.eventType, "bid.rejected.v1");
    assert.equal(row.idempotencyKey, `bid.rejected.v1:${row.entityId}`);
    assert.equal((row.payloadJson as { reason: string }).reason, "competing_bid_accepted");
  }
});

test("bids.accept writes only the winner's bid.accepted.v1 when there are no competing bids to reject", async () => {
  const { repository, outboxRows } = makeAcceptHarness({ submittedBidIds: [] });

  await repository.accept(acceptCommand);

  assert.equal(outboxRows.length, 1);
  assert.equal(outboxRows[0]?.eventType, "bid.accepted.v1");
});
