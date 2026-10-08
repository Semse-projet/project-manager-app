import test from "node:test";
import assert from "node:assert/strict";
import { PrismaDocumensoOutbox } from "../dist/modules/contracts/prisma-documenso-outbox.js";

type Stored = {
  tenantId: string;
  connectionId: string;
  contractId: string;
  providerId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  externalRequestId: string | null;
  status: string;
};

const key = {
  tenantId: "tenant_a",
  connectionId: "connection_a",
  contractId: "contract_a",
  idempotencyKey: "idempotency_a",
  requestFingerprint: "a".repeat(64),
};

function harness(contractExists = true) {
  const rows: Stored[] = [];
  const checkedTenants: string[] = [];
  let writeCount = 0;
  const matches = (row: Stored, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([column, value]) => {
      if (column === "status" && typeof value === "object" && value !== null) {
        return (value as { in: string[] }).in.includes(row.status);
      }
      return (row as unknown as Record<string, unknown>)[column] === value;
    });

  const db = {
    contract: {
      async findFirst({ where }: { where: { id: string; job: { tenantId: string } } }) {
        checkedTenants.push(where.job.tenantId);
        return contractExists && where.id === "contract_a" && where.job.tenantId === "tenant_a"
          ? { id: "contract_a" } : null;
      },
    },
    signatureDispatchOutbox: {
      async create({ data }: { data: Omit<Stored, "externalRequestId"> }) {
        if (rows.some((row) => row.tenantId === data.tenantId &&
            row.connectionId === data.connectionId &&
            row.contractId === data.contractId &&
            row.providerId === data.providerId &&
            row.idempotencyKey === data.idempotencyKey)) {
          throw { code: "P2002" };
        }
        writeCount++;
        rows.push({ ...data, externalRequestId: null });
      },
      async updateMany({ where, data }: {
        where: Record<string, unknown>; data: Partial<Stored>;
      }) {
        const matching = rows.filter((row) => matches(row, where));
        for (const row of matching) Object.assign(row, data);
        writeCount += matching.length;
        return { count: matching.length };
      },
      async findFirst({ where }: { where: Record<string, unknown> }) {
        const row = rows.find((r) => matches(r, where));
        return row ? { id: "row_a" } : null;
      },
    },
  };
  return { rows, checkedTenants, writes: () => writeCount,
    outbox: new PrismaDocumensoOutbox(db as never) };
}

test("Prisma outbox enforces a real tenant-scoped contract before reserving", async () => {
  const c = harness(false);
  await assert.rejects(c.outbox.reserve(key), /not found in tenant/);
  assert.equal(c.writes(), 0);
  assert.deepEqual(c.checkedTenants, ["tenant_a"]);
});

test("Prisma outbox rejects same-key and different-payload replays", async () => {
  const c = harness();
  await c.outbox.reserve(key);
  await assert.rejects(c.outbox.reserve(key), /already reserved/);
  await assert.rejects(c.outbox.reserve({
    ...key, requestFingerprint: "b".repeat(64),
  }), /already reserved/);
  assert.equal(c.rows.length, 1);
  assert.equal(c.rows[0]?.status, "RESERVED");
});

test("Prisma outbox checkpoints CREATE before SENT and never changes invalid transitions", async () => {
  const c = harness();
  await c.outbox.reserve(key);
  const linked = { ...key, externalRequestId: "envelope_abc123" };
  await assert.rejects(c.outbox.sent(linked), /checkpoint conflict/);
  await c.outbox.created(linked);
  assert.equal(c.rows[0]?.status, "CREATED");
  await assert.rejects(c.outbox.created(linked), /checkpoint conflict/);
  await c.outbox.sent(linked);
  assert.equal(c.rows[0]?.status, "SENT");
  await assert.rejects(c.outbox.sent(linked), /checkpoint conflict/);
});

test("Prisma outbox rejects wrong connection, contract and tenant on ownership checks", async () => {
  const c = harness();
  await c.outbox.reserve(key);
  const linked = { ...key, externalRequestId: "envelope_abc123" };
  await c.outbox.created(linked);
  await c.outbox.assertOwned(linked);
  await assert.rejects(c.outbox.assertOwned({ ...linked, tenantId: "tenant_other" }), /not owned/);
  await assert.rejects(c.outbox.assertOwned({ ...linked, connectionId: "connection_other" }), /not owned/);
  await assert.rejects(c.outbox.assertOwned({ ...linked, contractId: "contract_other" }), /not owned/);
});

test("Prisma outbox does not accept invalid request fingerprints", async () => {
  const c = harness();
  await assert.rejects(c.outbox.reserve({
    ...key, requestFingerprint: "no fingerprint",
  }), /request fingerprint/);
  assert.equal(c.writes(), 0);
});
