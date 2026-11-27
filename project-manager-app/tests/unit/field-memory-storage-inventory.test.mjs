import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildStorageInventory,
  compareStorageInventories,
} from "../../scripts/field-memory-storage-inventory.mjs";

test("storage inventory is read-only and compare detects a changed original", async (t) => {
  const source = await mkdtemp(path.join(os.tmpdir(), "semse-inventory-src-"));
  const copy = await mkdtemp(path.join(os.tmpdir(), "semse-inventory-copy-"));
  t.after(() => Promise.all([
    rm(source, {recursive: true, force: true}),
    rm(copy, {recursive: true, force: true}),
  ]));
  await mkdir(path.join(source, "zone"), {recursive: true});
  await writeFile(path.join(source, "zone", "original.bin"), Buffer.from("alpha"));
  await mkdir(path.join(source, "multipart"), {recursive: true});
  await writeFile(path.join(source, "multipart", "part.bin"), Buffer.from("ignore"));

  const before = await buildStorageInventory(source, "window-20261125", {isolatedRoot: true});
  assert.equal(before.files.length, 1);
  assert.equal(before.files[0].relativePath, "zone/original.bin");
  assert.equal(before.files[0].sizeBytes, 5);
  assert.match(before.files[0].sha256, /^[0-9a-f]{64}$/);

  await mkdir(path.join(copy, "zone"), {recursive: true});
  await writeFile(path.join(copy, "zone", "original.bin"), Buffer.from("alpha"));
  const restored = await buildStorageInventory(copy, "window-20261125", {isolatedRoot: true});
  assert.equal(compareStorageInventories(before, restored).status, "PASS");

  await writeFile(path.join(copy, "zone", "original.bin"), Buffer.from("bravo"));
  const changed = await buildStorageInventory(copy, "window-20261125", {isolatedRoot: true});
  const mismatch = compareStorageInventories(before, changed);
  assert.equal(mismatch.status, "FAIL");
  assert.equal(mismatch.changedFiles, 1);

  const script = await readFile(fileURLToPath(new URL(
    "../../scripts/field-memory-storage-inventory.mjs",
    import.meta.url,
  )), "utf8");
  assert.doesNotMatch(script, /writeFile|unlink|rm\(|truncate/);
});
