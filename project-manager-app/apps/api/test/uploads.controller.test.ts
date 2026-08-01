import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { IS_PUBLIC_KEY } from "../src/common/public.decorator.ts";
import { UploadsController } from "../dist/infrastructure/storage/uploads.controller.js";
import { StorageService } from "../dist/infrastructure/storage/storage.service.js";

test("GET /v1/uploads/files/* is marked @Public so vision service can download without session token", () => {
  const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, UploadsController.prototype.getFile);
  assert.strictEqual(isPublic, true, "getFile must carry @Public() — vision service downloads without Bearer token");
});

test("PUT /v1/uploads/files/* is NOT marked @Public (upload stays authenticated)", () => {
  const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, UploadsController.prototype.putFile);
  assert.ok(!isPublic, "putFile must NOT be public — only authenticated users may upload");
});

test("upload planning and PUT require evidence:write", () => {
  assert.deepEqual(
    Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, UploadsController.prototype.presignUploadPlan),
    ["evidence:write"],
  );
  assert.deepEqual(
    Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, UploadsController.prototype.putFile),
    ["evidence:write"],
  );
});

// Regression coverage for a real bug found via live verification (2026-08-01,
// AUDIT_REMEDIATION_PLAN.md 0.34): the app runs on Fastify, but putFile/getFile
// were written assuming Express's req/res shapes. Fastify auto-rejects any
// non-JSON Content-Type with a 415 before the handler runs unless a content
// type parser is registered (see main.ts), and @Req() under FastifyAdapter
// injects the FastifyRequest wrapper — the raw async-iterable stream lives at
// `.raw`, not on the request object itself. Both bugs meant 0.34's "fixed"
// upload path 500'd/415'd on every real PUT despite passing unit tests, since
// no test exercised the actual stream/header handling until now.
test("putFile stores the real request body bytes via req.raw (Fastify shape)", async () => {
  const root = await import("node:fs/promises").then((fs) =>
    fs.mkdtemp(path.join(os.tmpdir(), "semse-uploads-test-")),
  );
  process.env.SEMSE_STORAGE_ROOT = root;
  try {
    const controller = new UploadsController(new StorageService());
    const bytes = Buffer.from("regression-test-file-body");

    async function* rawChunks() {
      yield bytes;
    }
    const fakeReq = {
      headers: { "content-type": "text/plain", "content-length": String(bytes.byteLength) },
      raw: rawChunks(),
    };

    const result = await controller.putFile("regression/test.txt", fakeReq as never);
    assert.equal(result.sizeBytes, bytes.byteLength);

    const headerCalls: Array<Record<string, string>> = [];
    const fakeRes = { headers: (h: Record<string, string>) => headerCalls.push(h) };
    const file = await controller.getFile("regression/test.txt", fakeRes as never);
    assert.equal(headerCalls.length, 1, "getFile must call reply.headers() (Fastify), not res.set() (Express)");
    assert.equal(headerCalls[0]["Content-Type"], "application/octet-stream");

    const chunks: Buffer[] = [];
    for await (const chunk of file.getStream()) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    assert.equal(Buffer.concat(chunks).toString(), bytes.toString(), "downloaded bytes must match the uploaded bytes");
  } finally {
    delete process.env.SEMSE_STORAGE_ROOT;
    await rm(root, { recursive: true, force: true });
  }
});
