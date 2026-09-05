import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { ForgeLeaseService } from "../dist/infrastructure/forge/forge-lease.service.js";

const redisTest = process.env.REDIS_URL ? test : test.skip;

function tenant() {
  return `tenant-${randomUUID()}`;
}

redisTest("acquiring an already-held category/tenant lease fails until released", async () => {
  const service = new ForgeLeaseService();
  const tenantId = tenant();
  const first = { category: "schema", tenantId, runId: "run-a", taskId: "task-a" };
  const second = { category: "schema", tenantId, runId: "run-b", taskId: "task-b" };

  try {
    const firstAttempt = await service.acquire(first);
    assert.equal(firstAttempt.acquired, true);

    const secondAttempt = await service.acquire(second);
    assert.equal(secondAttempt.acquired, false);
    assert.equal(secondAttempt.reason, "held_by_other");
    assert.deepEqual(secondAttempt.heldBy, { runId: "run-a", taskId: "task-a" });

    await service.release(first);

    const thirdAttempt = await service.acquire(second);
    assert.equal(thirdAttempt.acquired, true);

    await service.release(second);
  } finally {
    await service.onModuleDestroy();
  }
});

redisTest("release only clears the lease when the requester matches the holder", async () => {
  const service = new ForgeLeaseService();
  const tenantId = tenant();
  const holder = { category: "auth-module", tenantId, runId: "run-holder", taskId: "task-holder" };
  const impostor = { category: "auth-module", tenantId, runId: "run-other", taskId: "task-other" };

  try {
    const acquired = await service.acquire(holder);
    assert.equal(acquired.acquired, true);

    // A non-holder's release must not clear someone else's lease.
    await service.release(impostor);

    const stillHeld = await service.acquire(impostor);
    assert.equal(stillHeld.acquired, false);
    assert.deepEqual(stillHeld.heldBy, { runId: "run-holder", taskId: "task-holder" });

    await service.release(holder);
    const afterRealRelease = await service.acquire(impostor);
    assert.equal(afterRealRelease.acquired, true);
    await service.release(impostor);
  } finally {
    await service.onModuleDestroy();
  }
});

redisTest("a lease expires on its own after the TTL elapses", async () => {
  const service = new ForgeLeaseService();
  const tenantId = tenant();
  const holder = { category: "payments-identity", tenantId, runId: "run-ttl", taskId: "task-ttl" };
  const other = { category: "payments-identity", tenantId, runId: "run-ttl-2", taskId: "task-ttl-2" };

  try {
    const acquired = await service.acquire({ ...holder, ttlSeconds: 1 });
    assert.equal(acquired.acquired, true);

    const deniedWhileHeld = await service.acquire(other);
    assert.equal(deniedWhileHeld.acquired, false);

    await new Promise((resolve) => setTimeout(resolve, 1_200));

    const afterExpiry = await service.acquire(other);
    assert.equal(afterExpiry.acquired, true);
    await service.release(other);
  } finally {
    await service.onModuleDestroy();
  }
});

redisTest("different categories or tenants do not contend for the same lease", async () => {
  const service = new ForgeLeaseService();
  const tenantId = tenant();
  const schemaLease = { category: "schema", tenantId, runId: "run-x", taskId: "task-x" };
  const migrationsLease = { category: "migrations", tenantId, runId: "run-y", taskId: "task-y" };
  const otherTenantLease = { category: "schema", tenantId: tenant(), runId: "run-z", taskId: "task-z" };

  try {
    assert.equal((await service.acquire(schemaLease)).acquired, true);
    assert.equal((await service.acquire(migrationsLease)).acquired, true);
    assert.equal((await service.acquire(otherTenantLease)).acquired, true);

    await service.release(schemaLease);
    await service.release(migrationsLease);
    await service.release(otherTenantLease);
  } finally {
    await service.onModuleDestroy();
  }
});
