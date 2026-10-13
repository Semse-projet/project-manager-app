import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {compareSourceInventories} from '../../scripts/field-memory-compare-inventories.mjs';
import {makeManifest} from '../../scripts/field-memory-originals-restore-drill.mjs';
async function fixture(t) {
  const dir=await mkdtemp(path.join(os.tmpdir(),'semse-consistency-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  await mkdir(path.join(dir,'photos'),{recursive:true});
  await writeFile(path.join(dir,'photos','original.jpg'),Buffer.from([255,216,255,217]));
  return {dir,manifest:await makeManifest(dir,'source-export-20261013')};
}
test('before and after matching hashes, sizes and file sets PASS',async t=>{
  const f=await fixture(t);const second=structuredClone(f.manifest);
  second.createdAt='2099-01-01T00:00:00.000Z';
  const x=compareSourceInventories(f.manifest,second);
  assert.equal(x.status,'PASS');assert.equal(x.beforeFiles,1);
  assert.equal(x.addedFiles,0);assert.equal(x.removedFiles,0);
  assert.equal(x.changedFiles,0);assert.ok(!JSON.stringify(x).includes('original.jpg'));
});
test('same-size mutated original fails',async t=>{
  const f=await fixture(t);const b=structuredClone(f.manifest);
  b.files[0].sha256='a'.repeat(64);
  const x=compareSourceInventories(f.manifest,b);
  assert.equal(x.status,'FAIL');assert.equal(x.changedFiles,1);
});
test('new and removed originals fail without exposing paths',async t=>{
  const f=await fixture(t);const b=structuredClone(f.manifest);
  b.files[0].relativePath='photos/new.jpg';
  const x=compareSourceInventories(f.manifest,b);
  assert.equal(x.status,'FAIL');assert.equal(x.addedFiles,1);
  assert.equal(x.removedFiles,1);assert.ok(!JSON.stringify(x).includes('new.jpg'));
});
test('different inventory references rejected',async t=>{
  const f=await fixture(t);const b={...f.manifest,backupReference:'another-reference'};
  assert.throws(()=>compareSourceInventories(f.manifest,b),/share an export reference/);
});
test('empty and path traversal manifests cannot report success',async t=>{
  const f=await fixture(t);
  assert.throws(()=>compareSourceInventories({...f.manifest,files:[]},f.manifest));
  const changed=structuredClone(f.manifest);changed.files[0].relativePath='../escape.jpg';
  assert.throws(()=>compareSourceInventories(f.manifest,changed));
});
test('duplicate manifest keys cannot report success',async t=>{
  const f=await fixture(t);const b=structuredClone(f.manifest);b.files.push(b.files[0]);
  assert.throws(()=>compareSourceInventories(f.manifest,b),/Invalid inventory entry/);
});
test('CLI returns exit 2 on changed snapshot with private aggregate response',async t=>{
  const f=await fixture(t);const a=path.join(os.tmpdir(),path.basename(f.dir)+'-before.json');
  const b=path.join(os.tmpdir(),path.basename(f.dir)+'-after.json');
  t.after(async()=>{await rm(a,{force:true});await rm(b,{force:true});});
  await writeFile(a,JSON.stringify(f.manifest));
  const mutated=structuredClone(f.manifest);mutated.files[0].sizeBytes++;
  await writeFile(b,JSON.stringify(mutated));
  const cli=path.resolve('scripts/field-memory-compare-inventories.mjs');
  const run=spawnSync(process.execPath,[cli,'--before',a,'--after',b],{cwd:path.resolve('.'),encoding:'utf8',timeout:10000});
  assert.equal(run.status,2);assert.equal(JSON.parse(run.stdout).changedFiles,1);
  assert.ok(!run.stdout.includes('original.jpg'));
});
