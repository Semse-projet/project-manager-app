import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {makeManifest} from '../../scripts/field-memory-originals-restore-drill.mjs';
import {executeCustodyGate} from '../../scripts/field-memory-custody-gate.mjs';
async function setup(t) {
  const dir=await mkdtemp(path.join(os.tmpdir(),'semse-custody-gate-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const exportedRoot=path.join(dir,'export'), isolatedParent=path.join(dir,'isolation');
  const beforeFile=path.join(dir,'before.json'),afterFile=path.join(dir,'after.json');
  await mkdir(exportedRoot);await mkdir(isolatedParent);
  await writeFile(path.join(exportedRoot,'original.jpg'),Buffer.from([255,216,255,217]));
  const first=await makeManifest(exportedRoot,'export-custody-2026');
  const second={...structuredClone(first),createdAt:new Date(Date.parse(first.createdAt)+3000).toISOString()};
  await writeFile(beforeFile,JSON.stringify(first));
  await writeFile(afterFile,JSON.stringify(second));
  return {dir,exportedRoot,isolatedParent,beforeFile,afterFile,first,second};
}
test('valid twin inventories and independent copy yield qualified PASS, not Railway restore',async t=>{
  const f=await setup(t),r=await executeCustodyGate(f);
  assert.equal(r.result,'OFFSITE_RESTORE_PASS');assert.equal(r.filesRestored,1);
  assert.equal(r.railwaySnapshotRestored,false);
  assert.equal(r.captureSessionActivationPermitted,false);
  assert.equal(r.evidenceDatabaseReconciled,false);
  assert.match(r.inventoryBeforeSha256,/^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(r).includes('original.jpg'));
  assert.deepEqual(await readdir(f.isolatedParent),[]);
});
test('an altered source file after first scan blocks recovery',async t=>{
  const f=await setup(t);
  f.second.files[0].sha256='a'.repeat(64);
  await writeFile(f.afterFile,JSON.stringify(f.second));
  const r=await executeCustodyGate(f);
  assert.equal(r.result,'BLOCKED');assert.equal(r.reason,'source_changed_during_export');
  assert.equal(r.changedFiles,1);
  assert.deepEqual(await readdir(f.isolatedParent),[]);
});
test('a new file between inventories blocks recovery even if export matches old manifest',async t=>{
  const f=await setup(t);
  f.second.files.push({...f.second.files[0],relativePath:'new.jpg'});
  await writeFile(f.afterFile,JSON.stringify(f.second));
  const r=await executeCustodyGate(f);
  assert.equal(r.result,'BLOCKED');assert.equal(r.addedFiles,1);
});
test('corrupted export bytes block regardless of stable two source inventories',async t=>{
  const f=await setup(t);
  await writeFile(path.join(f.exportedRoot,'original.jpg'),Buffer.from([255,216,254,217]));
  const r=await executeCustodyGate(f);
  assert.equal(r.result,'BLOCKED');assert.equal(r.reason,'export_or_restored_bytes_invalid');
  assert.equal(r.alteredFiles,1);assert.deepEqual(await readdir(f.isolatedParent),[]);
});
test('same inventory path is refused',async t=>{
  const f=await setup(t);
  await assert.rejects(()=>executeCustodyGate({...f,afterFile:f.beforeFile}),/Same inventory path/);
});
test('nonsequential scan timestamps cannot be passed off as independent observations',async t=>{
  const f=await setup(t);f.second.createdAt=f.first.createdAt;
  await writeFile(f.afterFile,JSON.stringify(f.second));
  const r=await executeCustodyGate(f);
  assert.equal(r.result,'BLOCKED');assert.equal(r.reason,'nonsequential_source_inventories');
});
test('CLI denies success without encrypted destination AND write-quiescence attestation',async t=>{
  const f=await setup(t);
  const cli=path.resolve('scripts/field-memory-custody-gate.mjs');
  const args=[cli,'--before',f.beforeFile,'--after',f.afterFile,
    '--export-root',f.exportedRoot,'--isolated-parent',f.isolatedParent];
  const no=spawnSync(process.execPath,args,{cwd:path.resolve('.'),encoding:'utf8',timeout:10000});
  assert.equal(no.status,1);assert.equal(no.stdout,'');
  assert.ok(!no.stderr.includes('original.jpg'));
  const onlyOne=spawnSync(process.execPath,[...args,'--confirm-encrypted-destination'],
    {cwd:path.resolve('.'),encoding:'utf8',timeout:10000});
  assert.equal(onlyOne.status,1);
  const yes=spawnSync(process.execPath,[...args,'--confirm-encrypted-destination',
    '--confirm-quiescent-export'],{cwd:path.resolve('.'),encoding:'utf8',timeout:10000});
  assert.equal(yes.status,0);assert.equal(JSON.parse(yes.stdout).result,'OFFSITE_RESTORE_PASS');
  assert.ok(!yes.stdout.includes('original.jpg'));
});
test('CLI emits nonzero exit status for changed files, no private paths',async t=>{
  const f=await setup(t);
  f.second.files[0].sha256='b'.repeat(64);
  await writeFile(f.afterFile,JSON.stringify(f.second));
  const cli=path.resolve('scripts/field-memory-custody-gate.mjs');
  const a=spawnSync(process.execPath,[cli,'--before',f.beforeFile,'--after',f.afterFile,
    '--export-root',f.exportedRoot,'--isolated-parent',f.isolatedParent,
    '--confirm-encrypted-destination','--confirm-quiescent-export'],
    {cwd:path.resolve('.'),encoding:'utf8',timeout:10000});
  assert.equal(a.status,2);assert.equal(JSON.parse(a.stdout).result,'BLOCKED');
  assert.ok(!a.stdout.includes('original.jpg'));
});
