import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inventory, resolveInventoryReference } from '../../scripts/field-memory-source-inventory.mjs';

async function root(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'semse-source-inventory-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, 'zone'), { recursive: true });
  await writeFile(path.join(dir, 'zone', 'original.jpg'), Buffer.from([0xff, 0xd8, 0xfe, 0x12]));
  return dir;
}
test('generates read-only manifest for original files, excluding multipart', async t => {
  const dir = await root(t);
  await mkdir(path.join(dir, 'multipart'));
  await writeFile(path.join(dir, 'multipart', 'chunk.part'), 'temporary');
  const r = await inventory(dir, 'export-2026-10-13', { enforceProductionRoot: false });
  assert.equal(r.schema, 'semse-originals-manifest-v1');
  assert.equal(r.files.length, 1);
  assert.equal(r.files[0].relativePath, 'zone/original.jpg');
  assert.equal(r.files[0].sha256, createHash('sha256').update(Buffer.from([0xff, 0xd8, 0xfe, 0x12])).digest('hex'));
  assert.equal(r.files[0].sizeBytes, 4);
  assert.equal(r.excludedStagingDirectory, 'multipart');
});
test('rejects unmounted root in production mode', async t => {
  const dir = await root(t);
  await assert.rejects(() => inventory(dir, 'export-2026-10-13'), /outside mounted storage/);
});
test('rejects filesystem symlink', async t => {
  const dir = await root(t);
  await symlink('/etc/passwd', path.join(dir, 'zone', 'link'));
  await assert.rejects(() => inventory(dir, 'export-2026-10-13', { enforceProductionRoot: false }), /Symbolic link/);
});
test('rejects invalid snapshot reference and empty source', async t => {
  const dir = await root(t);
  await assert.rejects(() => inventory(dir, '../bad', { enforceProductionRoot: false }), /Invalid opaque reference/);
  const empty = await mkdtemp(path.join(os.tmpdir(), 'semse-empty-inventory-'));
  t.after(() => rm(empty, { recursive: true, force: true }));
  await assert.rejects(() => inventory(empty, 'export-empty-2026', { enforceProductionRoot: false }), /No originals/);
});

test('Node stdin, -e and direct CLI receive the same opaque inventory reference', () => {
  assert.equal(resolveInventoryReference(['node','-','export-20261013'], false),'export-20261013');
  assert.equal(resolveInventoryReference(['node','export-20261013'], false),'export-20261013');
  assert.equal(resolveInventoryReference(['node','script.mjs','export-20261013'], true),'export-20261013');
});
