import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { hasPermission } from "../src/common/rbac.ts";
import {
  productionMutateAuthorized,
  StorageWriteGateControlController,
} from "../dist/infrastructure/storage/storage-write-gate-control.controller.js";

test("storage gate control endpoints require the dedicated OPS permission", () => {
  const methods = ["status", "provision", "transition", "coverage", "windowClosed", "recover"];
  for (const method of methods) {
    assert.deepEqual(
      Reflect.getMetadata(
        REQUIRED_PERMISSIONS_KEY,
        StorageWriteGateControlController.prototype[method],
      ),
      ["ops:storage-write-gate:manage"],
    );
  }
});

test("only OPS_ADMIN receives the storage gate management permission", () => {
  assert.equal(hasPermission(["OPS_ADMIN"], "ops:storage-write-gate:manage"), true);
  assert.equal(hasPermission(["OPS_ADMIN"], "ops:storage-write-gate:production-mutate"), true);
  assert.equal(hasPermission(["ADMIN"], "ops:storage-write-gate:production-mutate"), true);
  for (const role of ["CLIENT", "PRO", "WORKER", "EVENT_CONSUMER", "DEMO_AGRO"]) {
    assert.equal(
      hasPermission([role], "ops:storage-write-gate:manage"),
      false,
      role + " must not receive storage gate control",
    );
    assert.equal(
      hasPermission([role], "ops:storage-write-gate:production-mutate"),
      false,
      role + " must not receive production mutate",
    );
  }
});

test("production mutate permission is a separate grant from staging control", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  try {
    assert.equal(productionMutateAuthorized(["OPS_ADMIN"]), false);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }

  process.env.NODE_ENV = "production";
  try {
    assert.equal(productionMutateAuthorized(["OPS_ADMIN"]), true);
    assert.throws(
      () => productionMutateAuthorized(["CLIENT"]),
      (error) => error instanceof ForbiddenException,
    );
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("production transition forwards the mutate grant after the permission check", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const calls: Array<{productionMutateAuthorized?: boolean; action?: string}> = [];
  const controller = new StorageWriteGateControlController({
    async transition(input: {productionMutateAuthorized?: boolean; action?: string}) {
      calls.push(input);
      return {phase: "DRAINING", epoch: "1"};
    },
  } as never);
  try {
    await controller.transition({
      authContext: {
        userId: "usr_ops",
        tenantId: "tenant_1",
        orgId: "org_1",
        roles: ["OPS_ADMIN"],
      },
      headers: {},
    } as never, {
      ticket: "ticket-954",
      reason: "controlled production drain",
      idempotencyKey: "idem-954-drain",
      expectedEpoch: "1",
      action: "BEGIN_DRAIN",
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.productionMutateAuthorized, true);
    assert.equal(calls[0]?.action, "BEGIN_DRAIN");
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("storage gate control rejects non-OPS_ADMIN before invoking the service", async () => {
  let calls = 0;
  const controller = new StorageWriteGateControlController({
    async status() {
      calls += 1;
      return {provisioned: false, scopeDigest: "x"};
    },
  } as never);

  await assert.rejects(
    () => controller.status({
      authContext: {
        userId: "usr_client",
        tenantId: "tenant_1",
        orgId: "org_1",
        roles: ["CLIENT"],
      },
      headers: {},
    } as never),
    (error) => error instanceof ForbiddenException,
  );
  assert.equal(calls, 0);
});
