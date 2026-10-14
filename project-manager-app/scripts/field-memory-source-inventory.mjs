#!/usr/bin/env node
// Read-only source inventory for controlled Railway SSH execution.
// Relative file keys are confidential. Redirect stdout to an encrypted private disk.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function safeRelative(relative) {
  return relative.length > 0 && !relative.includes('\\') && !relative.includes('\0')
    && !path.posix.isAbsolute(relative) && path.posix.normalize(relative) === relative
    && relative.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}

async function inventory(storageRoot, backupReference, { enforceProductionRoot = true } = {}) {
  if (typeof backupReference !== 'string' || !/^[a-zA-Z0-9._-]{8,128}$/.test(backupReference))
    throw Error('Invalid opaque reference');
  const realRoot = await realpath(storageRoot);
  if (enforceProductionRoot && !realRoot.startsWith('/data/')) throw Error('Source outside mounted storage');
  if (!(await lstat(realRoot)).isDirectory()) throw Error('Source not ordinary directory');
  const files = [];
  async function visit(relative) {
    const dir = path.join(realRoot, ...relative.split('/').filter(Boolean));
    for (const ent of await readdir(dir, { withFileTypes: true })) {
      const child = relative ? relative + '/' + ent.name : ent.name;
      if (!safeRelative(child)) throw Error('Unsafe entry name');
      if (ent.isSymbolicLink()) throw Error('Symbolic link in originals');
      if (ent.isDirectory()) {
        if (child !== 'multipart') await visit(child);
        continue;
      }
      if (!ent.isFile()) throw Error('Unsupported filesystem entry');
      const file = path.join(realRoot, ...child.split('/'));
      const before = await lstat(file);
      if (!before.isFile()) throw Error('Original changed during listing');
      const h = createHash('sha256'); let bytes = 0;
      for await (const chunk of createReadStream(file)) { h.update(chunk); bytes += chunk.length; }
      const after = await lstat(file);
      if (!after.isFile() || bytes !== before.size || bytes !== after.size
        || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) {
        throw Error('Original changed while hashing');
      }
      files.push({ relativePath: child, sizeBytes: bytes, sha256: h.digest('hex') });
      if (files.length > 200000) throw Error('Too many originals');
    }
  }
  await visit('');
  if (!files.length) throw Error('No originals at root');
  files.sort((a,b) => a.relativePath.localeCompare(b.relativePath, 'en'));
  return {
    schema: 'semse-originals-manifest-v1', backupReference,
    createdAt: new Date().toISOString(), excludedStagingDirectory: 'multipart', files,
  };
}

// Supports node --input-type=module -e "$(cat ...)" -- reference on Railway;
// source file need not exist in the deployed API image.
export function resolveInventoryReference(argv, isDirect) {
  return isDirect || argv[1] === '-' ? argv[2] : argv[1];
}
const isDirect = Boolean(process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href);
const isInline = import.meta.url.includes('/[eval');
if (isDirect || isInline) {
  try {
    // Node reads JavaScript from stdin with argv[1] === '-', unlike -e.
    const reference = resolveInventoryReference(process.argv, isDirect);
    const manifest = await inventory(process.env.SEMSE_STORAGE_ROOT, reference);
    process.stdout.write(JSON.stringify(manifest) + '\n');
  } catch {
    process.stderr.write('Source inventory aborted: check root, consistency and permissions. No file paths printed.\n');
    process.exitCode = 1;
  }
}
export { inventory };
