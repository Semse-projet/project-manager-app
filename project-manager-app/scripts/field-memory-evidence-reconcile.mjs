#!/usr/bin/env node
// Offline, read-only Evidence-to-originals reconciliation; no network or SQL.
// Database projection is confidential. Never print IDs, keys, paths, or hashes.
import {readFile} from 'node:fs/promises';
import {createHash,timingSafeEqual} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const SHA=/^[a-f0-9]{64}$/;
function keySafe(v) {
  return typeof v==='string' && v.length>0 && v.length<=512
    && !v.startsWith('/') && !v.includes('\\') && !v.includes('\0')
    && path.posix.normalize(v)===v && v.split('/').every(x=>x && x!=='.' && x!=='..');
}
function evidenceNamespace(key) {
  return key.startsWith('evidence/') || /^tenants\/[^/]+\/(?:public-intake\/)?evidence\//.test(key);
}
function tenantFromKey(key) {
  const m=/^tenants\/([^/]+)\/(?:public-intake\/)?evidence\//.exec(key);
  return m?.[1] || null;
}
export function reconcileEvidence(manifest,projection) {
  if(manifest?.schema!=='semse-originals-manifest-v1'
    || manifest.excludedStagingDirectory!=='multipart'
    || !Array.isArray(manifest.files) || manifest.files.length===0
    || !projection || projection.schema!=='semse-evidence-backup-projection-v1'
    || !Array.isArray(projection.records)) throw Error('Unrecognized private inventory/projection schema');
  const originals=new Map();
  for (const f of manifest.files) {
    if(!keySafe(f?.relativePath) || !SHA.test(f.sha256||'') ||
       !Number.isSafeInteger(f.sizeBytes) || f.sizeBytes<0
       || originals.has(f.relativePath)) throw Error('Invalid originals manifest');
    if (evidenceNamespace(f.relativePath)) originals.set(f.relativePath,f.sha256);
  }
  const seenIds=new Set(),seenKeys=new Set();
  let missing=0,missingChecksums=0,mismatch=0,unscopedKeys=0,tenantMismatches=0,duplicates=0,invalidRefs=0;
  for (const e of projection.records) {
    if(typeof e?.id!=='string'||!e.id||typeof e?.projectId!=='string'||!e.projectId
      ||typeof e?.tenantId!=='string'||!e.tenantId || !keySafe(e.bucketKey)
      || !evidenceNamespace(e.bucketKey)) {
      invalidRefs++;continue;
    }
    if(seenIds.has(e.id) || seenKeys.has(e.bucketKey)){duplicates++;continue;}
    seenIds.add(e.id);seenKeys.add(e.bucketKey);
    const tenant=tenantFromKey(e.bucketKey);
    if(!tenant) unscopedKeys++;
    else if(tenant!==e.tenantId) tenantMismatches++;
    const actual=originals.get(e.bucketKey);
    if(!actual) missing++;
    if(!SHA.test(e.checksum||'')) missingChecksums++;
    else if(actual && actual!==e.checksum) mismatch++;
  }
  let unreferenced=0;
  for (const key of originals.keys()) if(!seenKeys.has(key)) unreferenced++;
  const blocked=missing||missingChecksums||mismatch||unscopedKeys||tenantMismatches||duplicates||invalidRefs||unreferenced||!projection.records.length;
  return {
    result:blocked?'BLOCKED':'MATCHED_METADATA_NOT_ATTESTED',
    evidenceRecords:projection.records.length,originalEvidenceFiles:originals.size,
    missingOriginals:missing,missingServerChecksums:missingChecksums,
    checksumMismatches:mismatch,unscopedKeys,tenantMismatches,
    duplicateEvidenceOrKeys:duplicates,invalidEvidenceReferences:invalidRefs,
    unreferencedOriginals:unreferenced,
    checksumAuthorityVerified:false,organizationPolicyVerified:false,
    databaseSnapshotConsistent:false,captureSessionActivationPermitted:false,
    note:'Compare private projection against hashed originals only; DB export provenance, checksum authority, tenant/org ownership and consistency require verified server controls.',
  };
}

/**
 * T-008j: compare a private DB checkpoint envelope with an independently
 * hashed originals manifest. SHA-256 binds bytes within this offline bundle
 * only; it does not authenticate the exporter, the database, the filesystem
 * freeze, or the origin of stored Evidence checksums.
 *
 * Output deliberately contains aggregate counts only — never tenant IDs,
 * storage keys, source paths, file hashes, or checkpoint IDs.
 */
export function reconcileFrozenCheckpoint(manifest,checkpoint) {
  const sha=/^[a-f0-9]{64}$/;
  const flags=[
    ['databaseTransactionConsistent',true],
    ['filesystemSnapshotConsistent',false],
    ['checksumAuthorityVerified',false],
    ['restoreVerified',false],
    ['captureSessionActivationPermitted',false],
  ];
  if (!checkpoint || typeof checkpoint!=='object' ||
      checkpoint.status!=='DB_PROJECTION_ONLY' ||
      checkpoint.phase!=='FROZEN' ||
      typeof checkpoint.epoch!=='string' ||
      !/^[1-9][0-9]*$/.test(checkpoint.epoch) ||
      typeof checkpoint.scopeDigest!=='string' || !sha.test(checkpoint.scopeDigest) ||
      typeof checkpoint.coverageDigest!=='string' || !sha.test(checkpoint.coverageDigest) ||
      typeof checkpoint.projectionDigest!=='string' || !sha.test(checkpoint.projectionDigest) ||
      !flags.every(([key,value])=>checkpoint[key]===value) ||
      checkpoint.privateProjection?.schema!=='semse-evidence-backup-projection-v1' ||
      !Array.isArray(checkpoint.privateProjection.records) ||
      !Number.isSafeInteger(checkpoint.recordCount) ||
      checkpoint.recordCount!==checkpoint.privateProjection.records.length ||
      !checkpoint.violations || typeof checkpoint.violations!=='object' ||
      !['missingChecksum','unsafeOrLegacyKey','tenantMismatch',
        'duplicateKey','missingOrCrossTenantProject']
        .every(k=>checkpoint.violations[k]===0)) {
    throw Error('Checkpoint envelope incomplete or untrusted');
  }
  const computed=createHash('sha256')
    .update(JSON.stringify(checkpoint.privateProjection)).digest('hex');
  const integrityMatched=timingSafeEqual(
    Buffer.from(computed,'hex'),Buffer.from(checkpoint.projectionDigest,'hex'));
  if(!integrityMatched) {
    return {
      result:'BLOCKED',
      reason:'projection_digest_mismatch',
      projectionDigestMatches:false,
      databaseSnapshotProvenanceVerified:false,
      filesystemSnapshotConsistent:false,
      checksumAuthorityVerified:false,
      restoreVerified:false,
      captureSessionActivationPermitted:false,
    };
  }
  const comparison=reconcileEvidence(manifest,checkpoint.privateProjection);
  return {
    ...comparison,
    result:comparison.result==='MATCHED_METADATA_NOT_ATTESTED'
      ? 'OFFLINE_CHECKPOINT_MATCH_NOT_ATTESTED' : 'BLOCKED',
    projectionDigestMatches:true,
    databaseSnapshotProvenanceVerified:false,
    databaseSnapshotConsistent:false,
    filesystemSnapshotConsistent:false,
    checksumAuthorityVerified:false,
    restoreVerified:false,
    captureSessionActivationPermitted:false,
    note:'Private checkpoint self-integrity and metadata comparison only. Neither SHA-256 nor a claimed FROZEN epoch authenticates the origin or proves consistent DB/FS custody.',
  };
}

function option(flag){
  const i=process.argv.indexOf(flag);
  return i>=0&&process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[i+1]:undefined;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    const manifest=option('--manifest'),projection=option('--projection'),checkpoint=option('--checkpoint');
    if(!manifest || Boolean(projection)===Boolean(checkpoint)) throw Error('Missing or ambiguous private inputs');
    const files=await Promise.all([readFile(manifest,'utf8'),readFile(checkpoint||projection,'utf8')]);
    if(files.some(s=>s.length>60*1024*1024)) throw Error('Private input too large');
    const r=checkpoint
      ? reconcileFrozenCheckpoint(JSON.parse(files[0]),JSON.parse(files[1]))
      : reconcileEvidence(JSON.parse(files[0]),JSON.parse(files[1]));
    process.stdout.write(JSON.stringify(r,null,2)+'\n');
    // Offline metadata similarity is never authority to activate custody.
    process.exitCode=2;
  }catch{
    process.stderr.write('Evidence reconciliation aborted. No private IDs or paths disclosed.\n');
    process.exitCode=1;
  }
}
