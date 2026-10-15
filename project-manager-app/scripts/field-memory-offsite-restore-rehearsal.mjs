#!/usr/bin/env node
// Non-destructive, offline recovery rehearsal for an independently exported copy.
// Does NOT restore any Railway-managed snapshot or contact production.
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyRestoredOriginals } from './field-memory-originals-restore-drill.mjs';

function isWithin(parent, child) {
  return parent === child || child.startsWith(parent + path.sep);
}
// The live Railway mount uses POSIX paths independently of operator OS.
function isLiveDataPath(candidate) {
  if (typeof candidate !== 'string') return false;
  const normalized = path.posix.normalize(candidate.replace(/\\/g, '/'));
  return normalized === '/data' || normalized.startsWith('/data/');
}
async function canonicalDirectory(dir) {
  const info = await lstat(dir);
  if (!info.isDirectory() || info.isSymbolicLink()) throw Error('Expected ordinary directory, not a symlink');
  return realpath(dir);
}
export async function rehearseOffsiteRecovery({ manifestFile, exportedRoot, isolatedParent }) {
  if (!manifestFile || !exportedRoot || !isolatedParent) throw Error('Manifest, export and isolated parent required');
  if (isLiveDataPath(exportedRoot) || isLiveDataPath(isolatedParent)) {
    throw Error('Production /data is not a safe source or rehearsal location');
  }
  const start = Date.now();
  const [exported, isolated] = await Promise.all([
    canonicalDirectory(exportedRoot), canonicalDirectory(isolatedParent),
  ]);
  if (isWithin(exported, isolated) || isWithin(isolated, exported)) {
    throw Error('Export and rehearsal must be in disjoint directory trees');
  }
  if (isLiveDataPath(exported) || isLiveDataPath(isolated)) {
    throw Error('Production /data is not a safe source or rehearsal location');
  }
  const manifestBytes = await readFile(manifestFile);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const manifestSha256 = createHash('sha256').update(manifestBytes).digest('hex');

  // Validate the independent export BEFORE copying: never invent a matching manifest.
  const sourceAudit = await verifyRestoredOriginals(manifest, exported);
  if (sourceAudit.status !== 'PASS') {
    return {
      status: 'FAIL', phase: 'export_integrity', backupReference: manifest.backupReference,
      manifestSha256, filesExpected: sourceAudit.expectedFiles,
      exportedFilesMatched: sourceAudit.matchedFiles, missingFiles: sourceAudit.missingFiles,
      alteredFiles: sourceAudit.alteredFiles, unexpectedFiles: sourceAudit.unexpectedFiles,
      railwaySnapshotRestored: false,
    };
  }
  // Operator must select a private, encrypted disk for isolatedParent.
  const temporary = await mkdtemp(path.join(isolated, '.semse-recovery-'));
  try {
    for (const entry of manifest.files) {
      // verifyRestoredOriginals already rejected traversal and duplicate paths.
      const source = path.join(exported, ...entry.relativePath.split('/'));
      const destination = path.join(temporary, ...entry.relativePath.split('/'));
      await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      await copyFile(source, destination, constants.COPYFILE_EXCL);
    }
    const restored = await verifyRestoredOriginals(manifest, temporary);
    return {
      status: restored.status, phase: 'isolated_restore',
      backupReference: manifest.backupReference, manifestSha256,
      filesExpected: restored.expectedFiles, filesRecovered: restored.matchedFiles,
      missingFiles: restored.missingFiles, alteredFiles: restored.alteredFiles,
      unexpectedFiles: restored.unexpectedFiles,
      durationMs: Date.now() - start,
      railwaySnapshotRestored: false,
      note: 'Independent-export rehearsal only; Railway snapshot and Evidence/DB recovery not attested.',
    };
  } finally {
    // Scoped to unique mkdtemp dir; never removes source or manifest.
    await rm(temporary, { recursive: true, force: true });
  }
}
function option(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : undefined;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (!process.argv.includes('--confirm-encrypted-destination')) {
      throw Error('Operator must confirm encrypted offline destination');
    }
    const result = await rehearseOffsiteRecovery({
      manifestFile: option('--manifest'), exportedRoot: option('--export-root'),
      isolatedParent: option('--isolated-parent'),
    });
    const output = option('--report');
    if (output) {
      const report = path.resolve(output);
      const exportRoot = await realpath(option('--export-root'));
      if (isWithin(exportRoot, report)) throw Error('Report must not reside among originals');
      await writeFile(report, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    }
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (result.status !== 'PASS') process.exitCode = 2;
  } catch (error) {
    process.stderr.write('Offsite restore rehearsal ABORTED: invalid inputs, isolation, access, or copy integrity. No paths disclosed.\n');
    process.exitCode = 1;
  }
}
