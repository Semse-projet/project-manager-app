import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileEvidence} from '../../scripts/field-memory-evidence-reconcile.mjs';
const digest='a'.repeat(64),other='b'.repeat(64);
function fixtures(){
  const key='tenants/t1/public-intake/evidence/object.jpg';
  return {
    manifest:{schema:'semse-originals-manifest-v1',excludedStagingDirectory:'multipart',files:[{relativePath:key,sizeBytes:4,sha256:digest}]},
    projection:{schema:'semse-evidence-backup-projection-v1',records:[{id:'e1',tenantId:'t1',projectId:'p1',bucketKey:key,checksum:digest}]},
  };
}
test('matching records remain untrusted until server-hash and DB ownership attested',()=>{
  const f=fixtures(),r=reconcileEvidence(f.manifest,f.projection);
  assert.equal(r.result,'MATCHED_METADATA_NOT_ATTESTED');
  assert.equal(r.captureSessionActivationPermitted,false);
  assert.equal(r.checksumAuthorityVerified,false);
  assert.ok(!JSON.stringify(r).includes('object.jpg'));
});
test('missing file blocks even if DB claims valid checksum',()=>{
  const f=fixtures();f.projection.records[0].bucketKey='tenants/t1/public-intake/evidence/missing.jpg';
  const r=reconcileEvidence(f.manifest,f.projection);
  assert.equal(r.result,'BLOCKED');assert.equal(r.missingOriginals,1);
  assert.equal(r.unreferencedOriginals,1);
});
test('missing checksum blocks and never auto-marks record verified',()=>{
  const f=fixtures();f.projection.records[0].checksum=null;
  assert.equal(reconcileEvidence(f.manifest,f.projection).missingServerChecksums,1);
});
test('different digest blocks',()=>{
  const f=fixtures();f.projection.records[0].checksum=other;
  assert.equal(reconcileEvidence(f.manifest,f.projection).checksumMismatches,1);
});
test('cross-tenant mismatch blocks even if exact bytes match',()=>{
  const f=fixtures();f.projection.records[0].tenantId='other-tenant';
  assert.equal(reconcileEvidence(f.manifest,f.projection).tenantMismatches,1);
});
test('duplicate evidence keys or identifiers block',()=>{
  const f=fixtures();f.projection.records.push({...f.projection.records[0],id:'e2'});
  assert.equal(reconcileEvidence(f.manifest,f.projection).duplicateEvidenceOrKeys,1);
});
test('legacy unscoped key blocks even with exact digest',()=>{
  const f=fixtures();f.manifest.files[0].relativePath='evidence/legacy.jpg';
  f.projection.records[0].bucketKey='evidence/legacy.jpg';
  assert.equal(reconcileEvidence(f.manifest,f.projection).unscopedKeys,1);
});
test('orphan originals without Evidence reference block',()=>{
  const f=fixtures();f.projection.records=[];
  const r=reconcileEvidence(f.manifest,f.projection);
  assert.equal(r.result,'BLOCKED');assert.equal(r.unreferencedOriginals,1);
});
test('invalid paths and manifest duplicate refuse reconciliation',()=>{
  const f=fixtures();f.manifest.files[0].relativePath='../escape';
  assert.throws(()=>reconcileEvidence(f.manifest,f.projection),/Invalid originals manifest/);
});

test('CLI never returns exit zero on matching legacy metadata without server attestation',async t=>{
  const f=fixtures();
  const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
  const {spawnSync}=await import('node:child_process');
  const path=(await import('node:path')).default;
  const os=(await import('node:os')).default;
  const dir=await mkdtemp(path.join(os.tmpdir(),'semse-evidence-reconcile-cli-'));
  t.after(()=>rm(dir,{force:true,recursive:true}));
  const a=path.join(dir,'manifest.json'),b=path.join(dir,'projection.json');
  await writeFile(a,JSON.stringify(f.manifest));await writeFile(b,JSON.stringify(f.projection));
  const cmd=spawnSync(process.execPath,[path.resolve('scripts/field-memory-evidence-reconcile.mjs'),
    '--manifest',a,'--projection',b],{cwd:path.resolve('.'),encoding:'utf8',timeout:10000});
  assert.equal(cmd.status,2);
  assert.equal(JSON.parse(cmd.stdout).result,'MATCHED_METADATA_NOT_ATTESTED');
  assert.ok(!cmd.stdout.includes('object.jpg'));
});
