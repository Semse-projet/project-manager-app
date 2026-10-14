import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {orphanReport,DEFAULT_GRACE_MS} from '../../scripts/field-memory-orphan-originals-report.mjs';
const DAY=24*60*60*1000;
const NOW=Date.UTC(2026,9,14,12,0,0);
const digest='a'.repeat(64);
const key=(ms,ext='.jpg',tenant='t1')=>`tenants/${tenant}/evidence/${ms}-123e4567-e89b-12d3-a456-426614174000${ext}`;
function manifest(keys,size=10){
  return {schema:'semse-originals-manifest-v1',excludedStagingDirectory:'multipart',
    files:keys.map(k=>({relativePath:k,sizeBytes:size,sha256:digest}))};
}
function projection(keys){
  return {schema:'semse-evidence-backup-projection-v1',
    records:keys.map((k,i)=>({id:`e${i}`,tenantId:'t1',projectId:'p1',bucketKey:k,checksum:null}))};
}
test('referenced originals are not orphans',()=>{
  const k=key(NOW-10*DAY);
  const {report,staleKeys}=orphanReport(manifest([k]),projection([k]),{nowMs:NOW});
  assert.equal(report.result,'NO_STALE_ORPHANS');
  assert.equal(report.referencedOriginals,1);
  assert.equal(report.orphanOriginals,0);
  assert.deepEqual(staleKeys,[]);
});
test('recent unreferenced original is in flight, not stale',()=>{
  const k=key(NOW-60*60*1000);
  const {report}=orphanReport(manifest([k]),projection([]),{nowMs:NOW});
  assert.equal(report.result,'NO_STALE_ORPHANS');
  assert.equal(report.inFlightWithinGrace,1);
  assert.equal(report.staleOrphans,0);
});
test('old unreferenced original is a stale orphan with age and kind',()=>{
  const k=key(NOW-24*DAY);
  const {report,staleKeys}=orphanReport(manifest([k],3647004),projection([]),{nowMs:NOW});
  assert.equal(report.result,'STALE_ORPHANS_FOUND');
  assert.equal(report.staleOrphans,1);
  assert.equal(report.orphanBytes,3647004);
  assert.equal(report.orphansByKind.image,1);
  assert.equal(report.oldestOrphanAgeDays,24);
  assert.deepEqual(staleKeys,[k]);
});
test('grace window boundary: exactly at the limit is stale',()=>{
  const k=key(NOW-DEFAULT_GRACE_MS);
  assert.equal(orphanReport(manifest([k]),projection([]),{nowMs:NOW}).report.staleOrphans,1);
  const j=key(NOW-DEFAULT_GRACE_MS+1);
  assert.equal(orphanReport(manifest([j]),projection([]),{nowMs:NOW}).report.inFlightWithinGrace,1);
});
test('object without a provable upload time is never treated as in flight',()=>{
  const k='tenants/t1/public-intake/evidence/123e4567-e89b-12d3-a456-426614174000.pdf';
  const {report}=orphanReport(manifest([k]),projection([]),{nowMs:NOW});
  assert.equal(report.orphansWithUnknownAge,1);
  assert.equal(report.result,'STALE_ORPHANS_FOUND');
  assert.equal(report.orphansByKind.document,1);
});
test('future-dated key is not classified as in flight',()=>{
  const k=key(NOW+DAY);
  assert.equal(orphanReport(manifest([k]),projection([]),{nowMs:NOW}).report.staleOrphans,1);
});
test('non-evidence namespaces are ignored',()=>{
  const k='tenants/t1/contract/1700000000000-123e4567-e89b-12d3-a456-426614174000.pdf';
  const {report}=orphanReport(manifest([k]),projection([]),{nowMs:NOW});
  assert.equal(report.evidenceOriginals,0);
  assert.equal(report.orphanOriginals,0);
});
test('report never contains keys, names, ids or digests and never permits deletion',()=>{
  const k=key(NOW-30*DAY,'.md');
  const {report}=orphanReport(manifest([k]),projection([]),{nowMs:NOW});
  const text=JSON.stringify(report);
  assert.ok(!text.includes('123e4567')&&!text.includes('tenants/')&&!text.includes(digest));
  assert.equal(report.deletionPermitted,false);
  assert.equal(report.orphansByKind.text,1);
});
test('invalid or unsafe input aborts instead of guessing',()=>{
  assert.throws(()=>orphanReport({schema:'x'},projection([])));
  assert.throws(()=>orphanReport(manifest(['../escape.jpg']),projection([]),{nowMs:NOW}));
  assert.throws(()=>orphanReport(manifest([key(1)]),{schema:'semse-evidence-backup-projection-v1',records:'no'}));
  const dup=manifest([key(1)]);dup.files.push(dup.files[0]);
  assert.throws(()=>orphanReport(dup,projection([]),{nowMs:NOW}));
  assert.throws(()=>orphanReport(manifest([key(1)]),projection([]),{nowMs:NaN}));
});
test('cli exits 3 on stale orphans, never prints keys, and refuses to overwrite detail file',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'orphan-report-'));
  try{
    const k=key(Date.now()-40*DAY);
    const m=path.join(dir,'m.json'),p=path.join(dir,'p.json'),d=path.join(dir,'detail.json');
    await writeFile(m,JSON.stringify(manifest([k])));
    await writeFile(p,JSON.stringify(projection([])));
    const script=path.resolve('scripts/field-memory-orphan-originals-report.mjs');
    const run=()=>spawnSync(process.execPath,[script,'--manifest',m,'--projection',p,'--private-detail',d],{encoding:'utf8'});
    const first=run();
    assert.equal(first.status,3);
    assert.ok(!first.stdout.includes('123e4567'));
    assert.deepEqual(JSON.parse(await readFile(d,'utf8')).staleOrphanKeys,[k]);
    const second=run();
    assert.equal(second.status,1);
    assert.ok(!second.stderr.includes('123e4567'));
    assert.deepEqual(JSON.parse(await readFile(d,'utf8')).staleOrphanKeys,[k]);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('cli exits 0 when nothing is stale',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'orphan-report-'));
  try{
    const k=key(Date.now()-60*1000);
    const m=path.join(dir,'m.json'),p=path.join(dir,'p.json');
    await writeFile(m,JSON.stringify(manifest([k])));
    await writeFile(p,JSON.stringify(projection([])));
    const script=path.resolve('scripts/field-memory-orphan-originals-report.mjs');
    const r=spawnSync(process.execPath,[script,'--manifest',m,'--projection',p],{encoding:'utf8'});
    assert.equal(r.status,0);
    assert.equal(JSON.parse(r.stdout).inFlightWithinGrace,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});
