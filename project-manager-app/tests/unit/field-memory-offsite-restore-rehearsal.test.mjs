import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeManifest } from '../../scripts/field-memory-originals-restore-drill.mjs';
import { rehearseOffsiteRecovery } from '../../scripts/field-memory-offsite-restore-rehearsal.mjs';

async function fixture(t) {
  const base = await mkdtemp(path.join(os.tmpdir(), 'semse-offsite-test-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const exportedRoot = path.join(base, 'export');
  const isolatedParent = path.join(base, 'isolated');
  const manifestFile = path.join(base, 'private-manifest.json');
  await mkdir(path.join(exportedRoot, 'job', 'wall'), { recursive: true });
  await mkdir(isolatedParent);
  await writeFile(path.join(exportedRoot, 'job', 'wall', 'original.jpg'), Buffer.from([0xff, 0xd8, 0x00, 0x20, 0xff, 0xd9]));
  const manifest = await makeManifest(exportedRoot, 'offsite-fixture-2026');
  await writeFile(manifestFile, JSON.stringify(manifest));
  return { base, exportedRoot, isolatedParent, manifestFile };
}
test('rehearses isolated copy; no original name leaks in report', async t => {
  const f = await fixture(t), r = await rehearseOffsiteRecovery(f);
  assert.equal(r.status, 'PASS');
  assert.equal(r.phase, 'isolated_restore');
  assert.equal(r.filesRecovered, 1);
  assert.equal(r.filesExpected, 1);
  assert.equal(r.railwaySnapshotRestored, false);
  assert.match(r.manifestSha256, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(r).includes('original.jpg'));
  assert.deepEqual(await readdir(f.isolatedParent), []);
  assert.ok((await readFile(path.join(f.exportedRoot, 'job', 'wall', 'original.jpg'))).length > 0);
});
test('detects changed bytes before restoration and cleans temporary folders', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.exportedRoot, 'job', 'wall', 'original.jpg'), Buffer.from([0xff, 0xd8, 0x01, 0x20, 0xff, 0xd9]));
  const r = await rehearseOffsiteRecovery(f);
  assert.equal(r.status, 'FAIL');
  assert.equal(r.phase, 'export_integrity');
  assert.equal(r.alteredFiles, 1);
  assert.deepEqual(await readdir(f.isolatedParent), []);
});
test('detects files not in manifest, without disclosing names', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.exportedRoot, 'job', 'wall', 'foreign.png'), 'not in manifest');
  const r = await rehearseOffsiteRecovery(f);
  assert.equal(r.status, 'FAIL');
  assert.equal(r.unexpectedFiles, 1);
  assert.ok(!JSON.stringify(r).includes('foreign.png'));
});
test('refuses rehearsal directory inside export', async t => {
  const f = await fixture(t);
  await assert.rejects(() => rehearseOffsiteRecovery({ ...f, isolatedParent: f.exportedRoot }), /disjoint/);
});
test('refuses export directory inside rehearsal parent', async t => {
  const f = await fixture(t);
  await assert.rejects(() => rehearseOffsiteRecovery({ ...f, isolatedParent: f.base }), /disjoint/);
});
test('refuses missing source manifest', async t => {
  const f = await fixture(t);
  await assert.rejects(() => rehearseOffsiteRecovery({ ...f, manifestFile: path.join(f.base, 'missing.json') }));
});
test('refuses symlink as isolated directory', async t => {
  const f = await fixture(t);
  const { symlink } = await import('node:fs/promises');
  const link = path.join(f.base, 'alias');
  await symlink(f.isolatedParent, link);
  await assert.rejects(() => rehearseOffsiteRecovery({ ...f, isolatedParent: link }), /symlink/);
});


test('CLI rejects unconfirmed encrypted destination before opening source files', async t => {
  const f = await fixture(t);
  const { spawnSync } = await import('node:child_process');
  const cli = path.resolve('scripts/field-memory-offsite-restore-rehearsal.mjs');
  const run = spawnSync(process.execPath, [cli, '--manifest', f.manifestFile,
    '--export-root', f.exportedRoot, '--isolated-parent', f.isolatedParent], {
    cwd: path.resolve('.'), encoding: 'utf8', timeout: 10000,
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /ABORTED/);
  assert.ok(!run.stderr.includes('original.jpg'));
  assert.deepEqual(await readdir(f.isolatedParent), []);
});

test('CLI writes private aggregate report once and fails safe if repeated', async t => {
  const f = await fixture(t);
  const { spawnSync } = await import('node:child_process');
  const cli = path.resolve('scripts/field-memory-offsite-restore-rehearsal.mjs');
  const report = path.join(f.base, 'aggregate-report.json');
  const args = [cli, '--manifest', f.manifestFile,
    '--export-root', f.exportedRoot, '--isolated-parent', f.isolatedParent,
    '--report', report, '--confirm-encrypted-destination'];
  const ok = spawnSync(process.execPath, args, { cwd: path.resolve('.'), encoding: 'utf8', timeout: 10000 });
  assert.equal(ok.status, 0);
  assert.equal(JSON.parse(await readFile(report, 'utf8')).status, 'PASS');
  assert.ok(!ok.stdout.includes('original.jpg'));
  const again = spawnSync(process.execPath, args, { cwd: path.resolve('.'), encoding: 'utf8', timeout: 10000 });
  assert.equal(again.status, 1);
  assert.ok(!again.stderr.includes('original.jpg'));
  assert.deepEqual(await readdir(f.isolatedParent), []);
});
