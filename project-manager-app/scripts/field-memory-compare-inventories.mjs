#!/usr/bin/env node
// Compare read-only inventories taken before and after an offsite export.
// No source files are read; no file names or hashes are included in reports.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

function validateManifest(manifest) {
  if (manifest?.schema !== 'semse-originals-manifest-v1'
    || manifest.excludedStagingDirectory !== 'multipart'
    || !/^[a-zA-Z0-9._-]{8,128}$/.test(manifest.backupReference || '')
    || !Array.isArray(manifest.files) || manifest.files.length === 0
    || manifest.files.length > 200000) throw Error('Invalid inventory manifest');
  const files = new Map();
  for (const entry of manifest.files) {
    const key=entry?.relativePath;
    if (typeof key !== 'string' || !key || key.includes('\\') || key.includes('\0')
      || key.startsWith('/') || path.posix.normalize(key) !== key
      || key.split('/').some(x => !x || x === '..' || x === '.')
      || !Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes < 0
      || !/^[0-9a-f]{64}$/.test(entry.sha256 || '')
      || files.has(key)) throw Error('Invalid inventory entry');
    files.set(key, {sizeBytes:entry.sizeBytes, sha256:entry.sha256});
  }
  return files;
}
export function compareSourceInventories(before, after) {
  const a=validateManifest(before),b=validateManifest(after);
  if (before.backupReference !== after.backupReference)
    throw Error('Source inventories do not share an export reference');
  let addedFiles=0,removedFiles=0,changedFiles=0;
  for (const [key,entry] of a) {
    const later=b.get(key);
    if (!later) removedFiles++;
    else if (entry.sizeBytes !== later.sizeBytes || entry.sha256 !== later.sha256) changedFiles++;
  }
  for (const key of b.keys()) if (!a.has(key)) addedFiles++;
  return {
    status:(addedFiles||removedFiles||changedFiles)?'FAIL':'PASS',
    phase:'source_consistency',
    reference:before.backupReference,
    beforeFiles:a.size,afterFiles:b.size,addedFiles,removedFiles,changedFiles,
    railwaySnapshotRestored:false,
    note:'Best-effort inventory equality, not atomic snapshot or freeze of concurrent writes.',
  };
}
function option(flag) {
  const index=process.argv.indexOf(flag);
  return index>=0 && process.argv[index+1] && !process.argv[index+1].startsWith('--')
    ? process.argv[index+1]:undefined;
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const before=option('--before'),after=option('--after');
    if (!before || !after) throw Error('Two inventories required');
    const [a,b]=await Promise.all([readFile(before,'utf8'),readFile(after,'utf8')]);
    const result=compareSourceInventories(JSON.parse(a),JSON.parse(b));
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
    if (result.status!=='PASS') process.exitCode=2;
  } catch {
    process.stderr.write('Inventory consistency check aborted: invalid inventories. No file paths disclosed.\n');
    process.exitCode=1;
  }
}
