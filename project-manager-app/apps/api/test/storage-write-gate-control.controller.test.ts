import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { hasPermission } from "../src/common/rbac.ts";
import { StorageWriteGateControlController } from "../dist/infrastructure/storage/storage-write-gate-control.controller.js";

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
  for (const role of ["CLIENT", "PRO", "WORKER", "EVENT_CONSUMER", "DEMO_AGRO"]) {
    assert.equal(
      hasPermission([role], "ops:storage-write-gate:manage"),
      false,
      role + " must not receive storage gate control",
    );
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
