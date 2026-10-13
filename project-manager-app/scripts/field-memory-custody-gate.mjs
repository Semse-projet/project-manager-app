#!/usr/bin/env node
// Single mandatory acceptance gate: before/after source inventories AND
// offsite export AND isolated restored copy. Never asserts Railway snapshot restore.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareSourceInventories } from './field-memory-compare-inventories.mjs';
import { rehearseOffsiteRecovery } from './field-memory-offsite-restore-rehearsal.mjs';

function parseManifest(contents) {
  // Reject enormous untrusted manifests before JSON parsing.
  if (contents.byteLength > 60 * 1024 * 1024) throw Error('Manifest size over limit');
  return JSON.parse(contents.toString('utf8'));
}
function validScanTime(value) {
  return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}
export async function executeCustodyGate({beforeFile,afterFile,exportedRoot,isolatedParent}) {
  if (!beforeFile || !afterFile || !exportedRoot || !isolatedParent) throw Error('Missing required inputs');
  if (path.resolve(beforeFile) === path.resolve(afterFile)) throw Error('Same inventory path cannot attest two scans');
  const [bBytes,aBytes] = await Promise.all([readFile(beforeFile),readFile(afterFile)]);
  const before=parseManifest(bBytes),after=parseManifest(aBytes);
  const compare=compareSourceInventories(before,after);
  const refs={
    reference:compare.reference,
    inventoryBeforeSha256:createHash('sha256').update(bBytes).digest('hex'),
    inventoryAfterSha256:createHash('sha256').update(aBytes).digest('hex'),
    sourceFiles:compare.beforeFiles,
    railwaySnapshotRestored:false,
    evidenceDatabaseReconciled:false,
    captureSessionActivationPermitted:false,
  };
  if (!validScanTime(before.createdAt) || !validScanTime(after.createdAt) ||
    Date.parse(after.createdAt) <= Date.parse(before.createdAt)) {
    return {result:'BLOCKED',reason:'nonsequential_source_inventories',...refs};
  }
  if (compare.status!=='PASS') {
    return {
      result:'BLOCKED',reason:'source_changed_during_export',...refs,
      addedFiles:compare.addedFiles,removedFiles:compare.removedFiles,
      changedFiles:compare.changedFiles,
    };
  }
  const restored=await rehearseOffsiteRecovery({manifestFile:beforeFile,exportedRoot,isolatedParent});
  if (restored.status!=='PASS') {
    return {
      result:'BLOCKED',reason:'export_or_restored_bytes_invalid',...refs,
      missingFiles:restored.missingFiles,alteredFiles:restored.alteredFiles,
      unexpectedFiles:restored.unexpectedFiles,
    };
  }
  return {
    result:'OFFSITE_RESTORE_PASS',
    qualification:'Independent export only, not managed Railway backup; source quiescence requires operator attestation.',
    ...refs,
    filesRestored:restored.filesRecovered,
    missingFiles:restored.missingFiles,alteredFiles:restored.alteredFiles,
    unexpectedFiles:restored.unexpectedFiles,durationMs:restored.durationMs,
  };
}
function option(flag) {
  const i=process.argv.indexOf(flag);
  return i>=0 && process.argv[i+1] && !process.argv[i+1].startsWith('--')
    ? process.argv[i+1]:undefined;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (!process.argv.includes('--confirm-encrypted-destination') ||
        !process.argv.includes('--confirm-quiescent-export')) {
      throw Error('Explicit encryption and write-quiescence confirmations required');
    }
    const result=await executeCustodyGate({
      beforeFile:option('--before'),afterFile:option('--after'),
      exportedRoot:option('--export-root'),isolatedParent:option('--isolated-parent'),
    });
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    if (result.result!=='OFFSITE_RESTORE_PASS') process.exitCode=2;
  } catch {
    process.stderr.write('Custody gate aborted: invalid or unsafe inputs, read failure or inability to attest export. No paths disclosed.\n');
    process.exitCode=1;
  }
}
