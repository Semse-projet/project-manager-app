import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {reconcileFrozenCheckpoint} from '../../scripts/field-memory-evidence-reconcile.mjs';

const SHA='a'.repeat(64),other='b'.repeat(64);
const key='tenants/test-tenant/public-intake/evidence/private-photo.jpg';
function fixture(){
  const privateProjection={
    schema:'semse-evidence-backup-projection-v1',
    records:[{id:'private-record',tenantId:'test-tenant',projectId:'private-project',
      bucketKey:key,checksum:SHA}],
  };
  return {
    manifest:{schema:'semse-originals-manifest-v1',excludedStagingDirectory:'multipart',
      files:[{relativePath:key,sha256:SHA,sizeBytes:1024}]},
    checkpoint:{
      status:'DB_PROJECTION_ONLY',phase:'FROZEN',epoch:'3',
      scopeDigest:SHA,coverageDigest:other,
      projectionDigest:createHash('sha256')
        .update(JSON.stringify(privateProjection)).digest('hex'),
      databaseTransactionConsistent:true,filesystemSnapshotConsistent:false,
      checksumAuthorityVerified:false,restoreVerified:false,
      captureSessionActivationPermitted:false,recordCount:1,
      violations:{missingChecksum:0,unsafeOrLegacyKey:0,tenantMismatch:0,
        duplicateKey:0,missingOrCrossTenantProject:0},
      privateProjection,
    },
  };
}
test('matching checkpoint digest and originals hashes never produces custody PASS',()=>{
  const f=fixture();
  const result=reconcileFrozenCheckpoint(f.manifest,f.checkpoint);
  assert.equal(result.result,'OFFLINE_CHECKPOINT_MATCH_NOT_ATTESTED');
  assert.equal(result.projectionDigestMatches,true);
  assert.equal(result.databaseSnapshotProvenanceVerified,false);
  assert.equal(result.databaseSnapshotConsistent,false);
  assert.equal(result.filesystemSnapshotConsistent,false);
  assert.equal(result.restoreVerified,false);
  assert.equal(result.captureSessionActivationPermitted,false);
  const output=JSON.stringify(result);
  for(const secret of [key,'test-tenant','private-project','private-record'])
    assert.equal(output.includes(secret),false);
});

test('changing a private record after digest creation blocks before comparing files',()=>{
  const f=fixture();
  f.checkpoint.privateProjection.records[0].checksum=other;
  const result=reconcileFrozenCheckpoint(f.manifest,f.checkpoint);
  assert.equal(result.result,'BLOCKED');
  assert.equal(result.reason,'projection_digest_mismatch');
  assert.equal(result.projectionDigestMatches,false);
  assert.equal(result.captureSessionActivationPermitted,false);
});

test('a forged internally consistent digest never authenticates a mismatched original',()=>{
  const f=fixture();
  f.manifest.files[0].sha256=other;
  const result=reconcileFrozenCheckpoint(f.manifest,f.checkpoint);
  assert.equal(result.result,'BLOCKED');
  assert.equal(result.checksumMismatches,1);
  assert.equal(result.databaseSnapshotProvenanceVerified,false);
});

test('incomplete checkpoint, epoch, or misleading PASS flags fail closed',()=>{
  for(const transform of [
    f=>{f.checkpoint.phase='OPEN';},
    f=>{f.checkpoint.epoch='0';},
    f=>{f.checkpoint.epoch='3.0';},
    f=>{f.checkpoint.coverageDigest='NOT_A_DIGEST';},
    f=>{f.checkpoint.status='BACKUP_PASS';},
    f=>{f.checkpoint.databaseTransactionConsistent=false;},
    f=>{f.checkpoint.filesystemSnapshotConsistent=true;},
    f=>{f.checkpoint.checksumAuthorityVerified=true;},
    f=>{f.checkpoint.restoreVerified=true;},
    f=>{f.checkpoint.captureSessionActivationPermitted=true;},
    f=>{f.checkpoint.recordCount=0;},
    f=>{f.checkpoint.violations.duplicateKey=1;},
    f=>{delete f.checkpoint.privateProjection;},
  ]){
    const f=fixture();
    transform(f);
    assert.throws(()=>reconcileFrozenCheckpoint(f.manifest,f.checkpoint),
      /Checkpoint envelope incomplete or untrusted/);
  }
});

test('offline CLI with --checkpoint emits counts only and intentionally exits nonzero',async t=>{
  const f=fixture();
  const directory=await mkdtemp(path.join(os.tmpdir(),'semse-checkpoint-offline-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const manifestFile=path.join(directory,'originals.json');
  const checkpointFile=path.join(directory,'private-checkpoint.json');
  await Promise.all([
    writeFile(manifestFile,JSON.stringify(f.manifest),{mode:0o600}),
    writeFile(checkpointFile,JSON.stringify(f.checkpoint),{mode:0o600}),
  ]);
  const result=spawnSync(process.execPath,[
    path.resolve('scripts/field-memory-evidence-reconcile.mjs'),
    '--manifest',manifestFile,'--checkpoint',checkpointFile,
  ],{cwd:path.resolve('.'),encoding:'utf8',timeout:10000});
  assert.equal(result.status,2);
  assert.equal(JSON.parse(result.stdout).result,'OFFLINE_CHECKPOINT_MATCH_NOT_ATTESTED');
  for(const secret of [key,'test-tenant','private-project','private-record',checkpointFile])
    assert.equal(result.stdout.includes(secret),false);
});
