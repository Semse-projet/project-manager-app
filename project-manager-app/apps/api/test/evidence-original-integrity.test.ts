import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { mkdtemp, rm, writeFile, symlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { StorageService } from "../dist/infrastructure/storage/storage.service.js";
import {
  resolveEvidenceChecksumMode,
  serverEvidenceChecksum,
} from "../dist/modules/evidence/evidence-original-integrity.js";

test("server hash matches immutable stored bytes and is not client controlled", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "semse-server-checksum-"));
  const old = process.env.SEMSE_STORAGE_ROOT;
  process.env.SEMSE_STORAGE_ROOT = root;
  t.after(async () => {
    if (old === undefined) delete process.env.SEMSE_STORAGE_ROOT;
    else process.env.SEMSE_STORAGE_ROOT = old;
    await rm(root, { recursive: true, force: true });
  });
  const storage = new StorageService();
  const key = "tenants/tenantA/evidence/capture.jpg";
  const bytes = Buffer.from([0xff,0xd8,0xff,0x00,0xff,0xd9]);
  await storage.store({key,stream:Readable.from([bytes]),contentType:"image/jpeg"});
  const result = await storage.hashOriginal(key);
  assert.equal(result.sizeBytes, bytes.length);
  assert.equal(result.sha256,createHash("sha256").update(bytes).digest("hex"));
  assert.equal(await serverEvidenceChecksum(key,storage,"enforce"),result.sha256);
});

test("enforce never registers an original that is missing or unhashable", async () => {
  let calls = 0;
  const storage = { async hashOriginal() { calls++; throw Error("no such file"); } };
  await assert.rejects(
    () => serverEvidenceChecksum("tenants/tenantA/evidence/missing.jpg",storage as never,"enforce"),
    (err: unknown) => !!err && typeof err==="object" && "status" in err && err.status===422,
  );
  assert.equal(calls,1);
});

test("shadow may continue compatibility but cannot invent a checksum", async () => {
  const storage = { async hashOriginal() { throw Error("no original"); } };
  assert.equal(await serverEvidenceChecksum("example",storage as never,"shadow"),undefined);
});

test("off never touches original bytes", async () => {
  const storage = { async hashOriginal() { throw Error("MUST NOT READ"); } };
  assert.equal(await serverEvidenceChecksum("example",storage as never,"off"),undefined);
});

test("enforce fails closed if storage injection is absent", async () => {
  await assert.rejects(
    () => serverEvidenceChecksum("example",undefined,"enforce"),
    (err: unknown) => !!err && typeof err==="object" && "status" in err && err.status===422,
  );
});

test("unrecognized mode is rejected, not downgraded to off", t => {
  const old=process.env.EVIDENCE_ORIGINAL_SHA256_MODE;
  t.after(() => {
    if(old===undefined) delete process.env.EVIDENCE_ORIGINAL_SHA256_MODE;
    else process.env.EVIDENCE_ORIGINAL_SHA256_MODE=old;
  });
  process.env.EVIDENCE_ORIGINAL_SHA256_MODE="surprise";
  assert.throws(()=>resolveEvidenceChecksumMode());
});

test("empty file and symlink cannot be hashed as an Evidence original", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(),"semse-hash-safety-"));
  const old=process.env.SEMSE_STORAGE_ROOT;
  process.env.SEMSE_STORAGE_ROOT=root;
  t.after(async()=>{
    if(old===undefined) delete process.env.SEMSE_STORAGE_ROOT;
    else process.env.SEMSE_STORAGE_ROOT=old;
    await rm(root,{recursive:true,force:true});
  });
  const storage=new StorageService();
  await writeFile(path.join(root,"empty"),Buffer.alloc(0));
  await assert.rejects(()=>storage.hashOriginal("empty"),/nonempty/);
  await symlink(path.join(root,"empty"),path.join(root,"link"));
  await assert.rejects(()=>storage.hashOriginal("link"),/regular file/);
});


test("server SHA-256 rejects symlink even when target contains a valid original", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "semse-hash-symlink-"));
  const previous = process.env.SEMSE_STORAGE_ROOT;
  process.env.SEMSE_STORAGE_ROOT = root;
  t.after(async () => {
    if (previous === undefined) delete process.env.SEMSE_STORAGE_ROOT;
    else process.env.SEMSE_STORAGE_ROOT = previous;
    await rm(root, { recursive: true, force: true });
  });
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  await writeFile(path.join(root, "original.jpg"), bytes);
  await symlink(path.join(root, "original.jpg"), path.join(root, "borrowed.jpg"));
  const storage = new StorageService();
  const positive = await storage.hashOriginal("original.jpg");
  assert.equal(positive.sha256, createHash("sha256").update(bytes).digest("hex"));
  await assert.rejects(
    () => storage.hashOriginal("borrowed.jpg"),
    /not a nonempty regular file/,
  );
});

test("canonical SHA-256 streaming holds the validated inode open, never reopens a pathname", async () => {
  // Contract protects against a future regression to lstat followed by
  // createReadStream(filePath), which follows a symlink inserted in between.
  const source = await import("node:fs/promises").then(fs =>
    fs.readFile(new URL("../src/infrastructure/storage/storage.service.ts", import.meta.url), "utf8")
  );
  assert.match(source, /constants\.O_RDONLY\s*\|\s*constants\.O_NOFOLLOW/);
  assert.match(source, /handle\.createReadStream\(\{\s*autoClose:\s*false\s*\}\)/);
  assert.match(source, /opened\.ino\s*!==\s*before\.ino/);
  assert.match(source, /after\.ino\s*!==\s*pathnameAfter\.ino/);
});
