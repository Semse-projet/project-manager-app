import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { IS_PUBLIC_KEY } from "../src/common/public.decorator.ts";
import { UploadsController } from "../dist/infrastructure/storage/uploads.controller.js";

test("GET /v1/uploads/files/* is marked @Public so vision service can download without session token", () => {
  const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, UploadsController.prototype.getFile);
  assert.strictEqual(isPublic, true, "getFile must carry @Public() — vision service downloads without Bearer token");
});

test("PUT /v1/uploads/files/* is NOT marked @Public (upload stays authenticated)", () => {
  const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, UploadsController.prototype.putFile);
  assert.ok(!isPublic, "putFile must NOT be public — only authenticated users may upload");
});
