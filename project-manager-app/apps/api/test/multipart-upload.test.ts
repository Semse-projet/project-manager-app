import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * PR-4 ZOOM finding: the multipart-session upload path (create -> PUT parts
 * -> complete) tracked part metadata (status/etag/bytesReceived) in a JSON
 * manifest but never actually wrote any uploaded bytes to disk, and
 * `complete` never assembled anything at the declared storage key — it just
 * returned {status: "completed"} having silently discarded every uploaded
 * byte. This is exactly the "resumable upload" gap the field-knowledge
 * program's contributor video clips depend on for files over the 25MB
 * single-PUT recommendation threshold. These tests prove the fixed version
 * actually persists and reassembles real bytes, rejects tenant confusion,
 * and never leaves a corrupt/partial file at the final key.
 */

const STORAGE_ROOT_ENV = "SEMSE_STORAGE_ROOT";
const MULTIPART_ROOT_ENV = "SEMSE_MULTIPART_STORAGE_ROOT";

async function withTempStorage<T>(fn: () => Promise<T>): Promise<T> {
  const storageRoot = await mkdtemp(path.join(os.tmpdir(), "semse-storage-test-"));
  const multipartRoot = await mkdtemp(path.join(os.tmpdir(), "semse-multipart-test-"));
  const prevStorage = process.env[STORAGE_ROOT_ENV];
  const prevMultipart = process.env[MULTIPART_ROOT_ENV];
  process.env[STORAGE_ROOT_ENV] = storageRoot;
  process.env[MULTIPART_ROOT_ENV] = multipartRoot;
  try {
    return await fn();
  } finally {
    if (prevStorage === undefined) delete process.env[STORAGE_ROOT_ENV];
    else process.env[STORAGE_ROOT_ENV] = prevStorage;
    if (prevMultipart === undefined) delete process.env[MULTIPART_ROOT_ENV];
    else process.env[MULTIPART_ROOT_ENV] = prevMultipart;
    await rm(storageRoot, { recursive: true, force: true });
    await rm(multipartRoot, { recursive: true, force: true });
  }
}

function fakeReq(tenantId: string, raw?: AsyncIterable<Buffer>) {
  return {
    headers: {},
    authContext: { userId: "usr_1", tenantId, orgId: "org_1", roles: ["OPS_ADMIN"] },
    raw: raw ?? Readable.from([]),
  } as never;
}

// A minimal, valid MP4 "ftyp" header (assertMagicBytes checks "ftyp" ascii at
// byte offset 4) padded to >= SNIFF_BYTES (32) so the sniff logic in
// validateUploadStream evaluates it as a real head, not a short-file fallback.
function mp4Header(padTo = 40): Buffer {
  const head = Buffer.from([0x00, 0x00, 0x00, 0x18, ...Buffer.from("ftyp"), 0x6d, 0x70, 0x34, 0x32]);
  return Buffer.concat([head, Buffer.alloc(Math.max(0, padTo - head.length), 0xab)]);
}

test("multipart upload: parts are actually written and reassembled byte-for-byte", async () => {
  await withTempStorage(async () => {
    const { StorageService } = await import("../dist/infrastructure/storage/storage.service.js");
    const { EvidenceController } = await import("../dist/modules/evidence/evidence.controller.js");

    const storage = new StorageService();
    const controller = new EvidenceController({} as never, storage);

    // createMultipartSession always plans parts against a fixed 10MB chunk
    // size (regardless of whether "single_put" or "external_transfer" was
    // the recommended strategy for this fileSizeBytes) — the only way to
    // get a real, >1-part manifest is to declare a size bigger than that one
    // chunk. Part 1 is exactly one 10MB chunk (starting with a real MP4
    // header so magic-byte sniffing on the reassembled stream passes); part
    // 2 is the small remainder — this proves parts are concatenated in
    // order, not just that a single part round-trips.
    const chunkSize = 10 * 1024 * 1024;
    const part1 = Buffer.concat([mp4Header(), Buffer.alloc(chunkSize - 40, 0x11)]);
    const part2 = Buffer.from("second-and-final-chunk-tail-marker");
    const totalSize = part1.length + part2.length;
    assert.ok(totalSize > chunkSize, "test fixture must actually cross the 10MB chunk boundary");

    const tenantId = `tenant_${randomUUID()}`;
    const req = fakeReq(tenantId);

    const createRes = (await controller.createMultipartSessionEndpoint(req, {
      domain: "knowledge_contribution",
      filename: "clip.mp4",
      contentType: "video/mp4",
      fileSizeBytes: totalSize,
    })) as { data: { sessionId: string; key: string; parts: Array<{ partNumber: number }> } };
    const { sessionId, key } = createRes.data;
    assert.equal(createRes.data.parts.length, 2, "a file just over one 10MB chunk must plan exactly 2 parts");

    async function uploadPart(partNumber: number, payload: Buffer) {
      const res = (await controller.uploadMultipartPart(
        fakeReq(tenantId, Readable.from([payload])),
        sessionId,
        String(partNumber)
      )) as { data: { etag: string; bytesReceived: number } };
      assert.equal(res.data.bytesReceived, payload.length);
      assert.ok(res.data.etag.length > 0);
      return res.data.etag;
    }

    const etag1 = await uploadPart(1, part1);
    const etag2 = await uploadPart(2, part2);

    const completeRes = (await controller.completeMultipartSession(req, {
      sessionId,
      parts: [
        { partNumber: 1, etag: etag1 },
        { partNumber: 2, etag: etag2 },
      ],
    })) as { data: { status: string; sizeBytes: number } };

    assert.equal(completeRes.data.status, "completed");
    assert.equal(completeRes.data.sizeBytes, totalSize);

    const stored = await storage.readBuffer(key);
    assert.deepEqual(stored, Buffer.concat([part1, part2]), "assembled file must equal the exact concatenation of the uploaded parts, in order");
  });
});

test("multipart complete: rejects a session with a missing part and leaves no file at the key", async () => {
  await withTempStorage(async () => {
    const { StorageService } = await import("../dist/infrastructure/storage/storage.service.js");
    const { EvidenceController } = await import("../dist/modules/evidence/evidence.controller.js");

    const storage = new StorageService();
    const controller = new EvidenceController({} as never, storage);
    const tenantId = `tenant_${randomUUID()}`;
    const req = fakeReq(tenantId);

    const part1 = mp4Header();
    const part2 = Buffer.from("never uploaded");

    const createRes = (await controller.createMultipartSessionEndpoint(req, {
      domain: "knowledge_contribution",
      filename: "clip.mp4",
      contentType: "video/mp4",
      fileSizeBytes: part1.length + part2.length,
    })) as { data: { sessionId: string; key: string } };
    const { sessionId, key } = createRes.data;

    const partRes = (await controller.uploadMultipartPart(
      fakeReq(tenantId, Readable.from([part1])),
      sessionId,
      "1"
    )) as { data: { etag: string } };

    await assert.rejects(() =>
      controller.completeMultipartSession(req, {
        sessionId,
        // Claims part 2 was uploaded with a fabricated etag — it never was.
        parts: [
          { partNumber: 1, etag: partRes.data.etag },
          { partNumber: 2, etag: "fabricated-etag" },
        ],
      })
    );

    const { exists } = await storage.stat(key);
    assert.equal(exists, false, "an incomplete/fabricated multipart completion must never produce a file at the final key");
  });
});

test("multipart complete: rejects when reassembled size does not match the declared size, and cleans up", async () => {
  await withTempStorage(async () => {
    const { StorageService } = await import("../dist/infrastructure/storage/storage.service.js");
    const { EvidenceController } = await import("../dist/modules/evidence/evidence.controller.js");

    const storage = new StorageService();
    const controller = new EvidenceController({} as never, storage);
    const tenantId = `tenant_${randomUUID()}`;
    const req = fakeReq(tenantId);

    const part1 = mp4Header();

    const createRes = (await controller.createMultipartSessionEndpoint(req, {
      domain: "knowledge_contribution",
      filename: "clip.mp4",
      contentType: "video/mp4",
      // Declare a size larger than what will actually be uploaded.
      fileSizeBytes: part1.length + 500,
    })) as { data: { sessionId: string; key: string } };
    const { sessionId, key } = createRes.data;

    const partRes = (await controller.uploadMultipartPart(
      fakeReq(tenantId, Readable.from([part1])),
      sessionId,
      "1"
    )) as { data: { etag: string } };

    await assert.rejects(() =>
      controller.completeMultipartSession(req, {
        sessionId,
        parts: [{ partNumber: 1, etag: partRes.data.etag }],
      })
    );

    const { exists } = await storage.stat(key);
    assert.equal(exists, false, "a size-mismatched assembly must not leave a file behind");
  });
});

test("multipart part upload: a different tenant cannot upload into or read someone else's session", async () => {
  await withTempStorage(async () => {
    const { StorageService } = await import("../dist/infrastructure/storage/storage.service.js");
    const { EvidenceController } = await import("../dist/modules/evidence/evidence.controller.js");

    const storage = new StorageService();
    const controller = new EvidenceController({} as never, storage);
    const ownerTenant = `tenant_${randomUUID()}`;
    const attackerTenant = `tenant_${randomUUID()}`;

    const createRes = (await controller.createMultipartSessionEndpoint(fakeReq(ownerTenant), {
      domain: "knowledge_contribution",
      filename: "clip.mp4",
      contentType: "video/mp4",
      fileSizeBytes: 40,
    })) as { data: { sessionId: string } };
    const { sessionId } = createRes.data;

    await assert.rejects(
      () => controller.uploadMultipartPart(fakeReq(attackerTenant, Readable.from([mp4Header()])), sessionId, "1"),
      (error: unknown) => {
        assert.equal((error as { getStatus?: () => number }).getStatus?.(), 404);
        return true;
      }
    );

    await assert.rejects(
      () => controller.completeMultipartSession(fakeReq(attackerTenant), { sessionId, parts: [{ partNumber: 1, etag: "x" }] }),
      (error: unknown) => {
        assert.equal((error as { getStatus?: () => number }).getStatus?.(), 404);
        return true;
      }
    );
  });
});

test("multipart part upload: an empty part is rejected, not silently accepted", async () => {
  await withTempStorage(async () => {
    const { StorageService } = await import("../dist/infrastructure/storage/storage.service.js");
    const { EvidenceController } = await import("../dist/modules/evidence/evidence.controller.js");

    const storage = new StorageService();
    const controller = new EvidenceController({} as never, storage);
    const tenantId = `tenant_${randomUUID()}`;

    const createRes = (await controller.createMultipartSessionEndpoint(fakeReq(tenantId), {
      domain: "knowledge_contribution",
      filename: "clip.mp4",
      contentType: "video/mp4",
      fileSizeBytes: 10,
    })) as { data: { sessionId: string } };

    await assert.rejects(() =>
      controller.uploadMultipartPart(fakeReq(tenantId, Readable.from([])), createRes.data.sessionId, "1")
    );
  });
});
