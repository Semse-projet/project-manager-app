#!/usr/bin/env node
// Offline, read-only report of stored Evidence originals that no Evidence row references.
// It NEVER deletes, moves or rewrites anything (ADR-043: originals are write-once).
// Upload is PUT (bytes stored) then register (DB row); the gap between them is normal for a
// recent upload, so recent unreferenced originals are reported apart from stale ones.
// Database projection is confidential. Never print IDs, keys, paths, or hashes.
import {writeFile} from 'node:fs/promises';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const DAY_MS=24*60*60*1000;
export const DEFAULT_GRACE_MS=DAY_MS;
function keySafe(v) {
  return typeof v==='string' && v.length>0 && v.length<=512
    && !v.startsWith('/') && !v.includes('\\') && !v.includes('\0')
    && path.posix.normalize(v)===v && v.split('/').every(x=>x && x!=='.' && x!=='..');
}
function evidenceNamespace(key) {
  return key.startsWith('evidence/') || /^tenants\/[^/]+\/(?:public-intake\/)?evidence\//.test(key);
}
// presign names objects "<Date.now()>-<uuid><ext>"; other layouts carry no provable upload time.
function uploadedAtMs(key) {
  const m=/^(\d{13})-/.exec(path.posix.basename(key));
  return m?Number(m[1]):null;
}
const CLASSES={
  image:['.jpg','.jpeg','.png','.webp','.gif','.heic'],
  video:['.mp4','.mov','.webm'],
  document:['.pdf','.zip'],
  text:['.md','.txt'],
};
function extensionClass(key) {
  const ext=path.posix.extname(key).toLowerCase();
  for (const [name,list] of Object.entries(CLASSES)) if(list.includes(ext)) return name;
  return 'other';
}
export function orphanReport(manifest,projection,{nowMs=Date.now(),graceMs=DEFAULT_GRACE_MS}={}) {
  if(manifest?.schema!=='semse-originals-manifest-v1'
    || manifest.excludedStagingDirectory!=='multipart'
    || !Array.isArray(manifest.files)
    || !projection || projection.schema!=='semse-evidence-backup-projection-v1'
    || !Array.isArray(projection.records)) throw Error('Unrecognized private inventory/projection schema');
  if(!Number.isFinite(nowMs) || !Number.isFinite(graceMs) || graceMs<0) throw Error('Invalid time window');
  const referenced=new Set();
  for (const e of projection.records) if(keySafe(e?.bucketKey)) referenced.add(e.bucketKey);
  const seen=new Set();
  let evidenceOriginals=0,referencedOriginals=0,orphanBytes=0;
  let inFlight=0,stale=0,unknownAge=0;
  const byClass={image:0,video:0,document:0,text:0,other:0};
  const ages=[];
  const staleKeys=[];
  for (const f of manifest.files) {
    if(!keySafe(f?.relativePath) || !Number.isSafeInteger(f.sizeBytes) || f.sizeBytes<0
       || seen.has(f.relativePath)) throw Error('Invalid originals manifest');
    seen.add(f.relativePath);
    if(!evidenceNamespace(f.relativePath)) continue;
    evidenceOriginals++;
    if(referenced.has(f.relativePath)) {referencedOriginals++;continue;}
    orphanBytes+=f.sizeBytes;
    byClass[extensionClass(f.relativePath)]++;
    const at=uploadedAtMs(f.relativePath);
    if(at===null) {unknownAge++;staleKeys.push(f.relativePath);continue;}
    const age=nowMs-at;
    ages.push(age);
    if(age>=0 && age<graceMs) inFlight++;
    else {stale++;staleKeys.push(f.relativePath);}
  }
  const orphanOriginals=inFlight+stale+unknownAge;
  const days=(ms)=>Math.round(ms/DAY_MS*10)/10;
  return {
    report:{
      result:stale+unknownAge>0?'STALE_ORPHANS_FOUND':'NO_STALE_ORPHANS',
      evidenceOriginals,referencedOriginals,orphanOriginals,
      inFlightWithinGrace:inFlight,staleOrphans:stale,orphansWithUnknownAge:unknownAge,
      orphanBytes,orphansByKind:byClass,
      oldestOrphanAgeDays:ages.length?days(Math.max(...ages)):null,
      newestOrphanAgeDays:ages.length?days(Math.min(...ages)):null,
      graceHours:Math.round(graceMs/(60*60*1000)*10)/10,
      deletionPermitted:false,
      note:'Report only. Originals are write-once (ADR-043): never delete, move or overwrite them from this result. Resolve each stale orphan by operator decision (register through the normal flow, or keep as-is).',
    },
    staleKeys,
  };
}
function option(flag){
  const i=process.argv.indexOf(flag);
  return i>=0&&process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[i+1]:undefined;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    const manifestPath=option('--manifest'),projectionPath=option('--projection');
    if(!manifestPath||!projectionPath) throw Error('Missing private inputs');
    const graceHours=option('--grace-hours');
    const graceMs=graceHours===undefined?DEFAULT_GRACE_MS:Number(graceHours)*60*60*1000;
    const files=await Promise.all([readFile(manifestPath,'utf8'),readFile(projectionPath,'utf8')]);
    if(files.some(s=>s.length>60*1024*1024)) throw Error('Projection too large');
    const {report,staleKeys}=orphanReport(JSON.parse(files[0]),JSON.parse(files[1]),{graceMs});
    const detailPath=option('--private-detail');
    // Keys are private: only written to an explicit path, never over an existing file.
    if(detailPath) await writeFile(detailPath,JSON.stringify({schema:'semse-orphan-originals-detail-v1',staleOrphanKeys:staleKeys},null,2)+'\n',{encoding:'utf8',flag:'wx'});
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
    process.exitCode=report.result==='NO_STALE_ORPHANS'?0:3;
  }catch{
    process.stderr.write('Orphan originals report aborted. No private IDs or paths disclosed.\n');
    process.exitCode=1;
  }
}
