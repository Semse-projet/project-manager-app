import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdtemp, open, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PrivateVolumeSignatureArtifactStore } from "../dist/modules/contracts/private-volume-signature-artifact.store.js";

const pdf = new Uint8Array(Buffer.from("%PDF-1.7\nprivate-signed-document\n%%EOF"));
const sha = createHash("sha256").update(pdf).digest("hex");
const artifact = {
  tenantId: "tenant_a", contractId: "contract_a", kind: "SIGNED_PDF" as const,
  mimeType: "application/pdf", sha256: sha, content: pdf,
};

async function fixture(fn: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "semse-signature-private-test-"));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test("private volume store computes deterministic private refs, persists hash-matched bytes and makes no HTTP URL", async () => {
  await fixture(async (root) => {
    const store = new PrivateVolumeSignatureArtifactStore(root);
    const ref = await store.putImmutable(artifact);
    assert.match(ref, /^private-signatures\/[a-f0-9]{64}\/[a-f0-9]{64}\/SIGNED_PDF\/[a-f0-9]{64}$/);
    assert.ok(!ref.includes("tenant_a") && !ref.includes("contract_a") && !ref.includes("http"));
    const actualPath = path.join(root, ref.replace("private-signatures/", ""));
    assert.deepEqual(await readFile(actualPath), Buffer.from(pdf));
    const info = await lstat(actualPath);
    assert.equal(info.mode & 0o777, 0o600);
    const second = await store.putImmutable(artifact);
    assert.equal(second, ref);
    const entries = await readdir(path.dirname(actualPath));
    assert.deepEqual(entries, [sha]);
  });
});

test("distinct tenants and contracts are physically isolated, even with same artifact digest", async () => {
  await fixture(async (root) => {
    const store = new PrivateVolumeSignatureArtifactStore(root);
    const a = await store.putImmutable(artifact);
    const b = await store.putImmutable({ ...artifact, tenantId: "tenant_b" });
    const c = await store.putImmutable({ ...artifact, contractId: "contract_b" });
    assert.notEqual(a, b);
    assert.notEqual(a, c);
  });
});

test("rejects forged content SHA, zero bytes, impossible size and unknown ref types", async () => {
  await fixture(async (root) => {
    const store = new PrivateVolumeSignatureArtifactStore(root);
    for (const bad of [
      { sha256: "a".repeat(64) },
      { content: new Uint8Array() },
      { kind: "../SIGNED_PDF" },
      { mimeType: "text/html" },
      { content: new Uint8Array(25 * 1024 * 1024 + 1) },
    ]) await assert.rejects(store.putImmutable({ ...artifact, ...bad } as never), /invalid or tampered/);
  });
});

test("concurrent writes of identical artifacts are idempotent without overwriting", async () => {
  await fixture(async (root) => {
    const store = new PrivateVolumeSignatureArtifactStore(root);
    const results = await Promise.all(Array.from({ length: 4 }, () => store.putImmutable(artifact)));
    assert.equal(new Set(results).size, 1);
  });
});

test("does not replace a modified immutable final file", async () => {
  await fixture(async (root) => {
    const store = new PrivateVolumeSignatureArtifactStore(root);
    const ref = await store.putImmutable(artifact);
    const target = path.join(root, ref.replace("private-signatures/", ""));
    await writeFile(target, "TAMPERED");
    await assert.rejects(store.putImmutable(artifact), /digest collision or immutable record modified/);
  });
});

test("dedicated private root is mandatory", () => {
  for (const root of [".", "/tmp", "/tmp/semse-storage", "/"]) {
    assert.throws(() => new PrivateVolumeSignatureArtifactStore(root), /dedicated absolute persistent mount/);
  }
});
