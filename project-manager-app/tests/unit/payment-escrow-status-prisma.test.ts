import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ESCROW_STATUS_VALUES = [
  "active",
  "pending_settlement",
  "closed",
  "cancelled",
  "released",
] as const;

test("PaymentEscrow.status uses a Prisma enum mapped to existing lowercase DB values", async () => {
  const schema = await readFile("packages/db/prisma/schema.prisma", "utf8");

  assert.match(schema, /enum EscrowStatus\s*\{/);
  assert.match(schema, /status\s+EscrowStatus\s+@default\(ACTIVE\)/);

  for (const value of ESCROW_STATUS_VALUES) {
    assert.match(schema, new RegExp(`@map\\("${value}"\\)`));
  }
});

test("PaymentEscrow.status migration blocks unknown legacy text statuses before casting", async () => {
  const migration = await readFile(
    "packages/db/prisma/migrations/20260524180000_payment_escrow_status_enum/migration.sql",
    "utf8"
  );

  assert.match(migration, /Unsupported PaymentEscrow\.status values/);

  for (const value of ESCROW_STATUS_VALUES) {
    assert.match(migration, new RegExp(`'${value}'`));
  }
});
