import "reflect-metadata";

import assert from "node:assert/strict";
import test from "node:test";
import { AUTHENTICATED_ACCESS_KEY, REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { ChangeOrderController } from "../dist/modules/evidence/change-order.controller.js";
import { DailyLogController } from "../dist/modules/evidence/daily-log.controller.js";
import { ExportController } from "../dist/modules/evidence/export.controller.js";
import { PhotoController } from "../dist/modules/evidence/photo.controller.js";

function classPermission(controller: Function): string[] | undefined {
  return Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, controller);
}

function methodPermission(controller: Function, methodName: string): string[] | undefined {
  return Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, controller.prototype[methodName]);
}

function classAuthenticatedAccess(controller: Function): string | undefined {
  return Reflect.getMetadata(AUTHENTICATED_ACCESS_KEY, controller);
}

test("legacy evidence exports require evidence:read", () => {
  assert.deepEqual(classPermission(ExportController), ["evidence:read"]);
  assert.equal(classAuthenticatedAccess(ExportController), undefined);
});

test("legacy photo evidence separates reads from uploads", () => {
  assert.deepEqual(classPermission(PhotoController), ["evidence:read"]);
  assert.equal(classAuthenticatedAccess(PhotoController), undefined);
  assert.deepEqual(methodPermission(PhotoController, "uploadPhoto"), ["evidence:write"]);
});

test("legacy daily logs read by default and require evidence:write to sign", () => {
  assert.deepEqual(classPermission(DailyLogController), ["evidence:read"]);
  assert.equal(classAuthenticatedAccess(DailyLogController), undefined);
  assert.deepEqual(methodPermission(DailyLogController, "signDailyLog"), ["evidence:write"]);
});

test("legacy project change orders use change-order domain permissions", () => {
  assert.deepEqual(classPermission(ChangeOrderController), ["change-orders:read"]);
  assert.equal(classAuthenticatedAccess(ChangeOrderController), undefined);

  for (const method of ["createChangeOrder", "submitForApproval"]) {
    assert.deepEqual(methodPermission(ChangeOrderController, method), ["change-orders:create"], `${method} should create or submit change orders`);
  }

  for (const method of ["approveChangeOrder", "rejectChangeOrder"]) {
    assert.deepEqual(methodPermission(ChangeOrderController, method), ["change-orders:approve"], `${method} should approve or reject change orders`);
  }
});
