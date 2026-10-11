import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,rm,symlink,readFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {makeManifest,saveManifestExclusive,verifyRestoredOriginals,syntheticRestoreDrill} from "../../scripts/field-memory-originals-restore-drill.mjs";

async function setup(t) {
  const base=await mkdtemp(path.join(os.tmpdir(),"semse-restore-tests-"));
  t.after(()=>rm(base,{recursive:true,force:true}));
  const source=path.join(base,"source"),restore=path.join(base,"restored");
  await mkdir(path.join(source,"photos"),{recursive:true});
  await mkdir(path.join(restore,"photos"),{recursive:true});
  const bytes=Buffer.from([255,216,255,0,217]);
  await writeFile(path.join(source,"photos","photo.jpg"),bytes);
  await writeFile(path.join(restore,"photos","photo.jpg"),bytes);
  return {base,source,restore,manifest:await makeManifest(source,"fixture-backup-2026")};
}
test("synthetic restore passes and deliberate corruption is detected",async()=>{
  assert.deepEqual(await syntheticRestoreDrill(),{
    mode:"SYNTHETIC_ONLY",cleanRestore:"PASS",corruptionDetected:true,actualRailwayBackupVerified:false});
});
test("exact restored bytes match source SHA256 and size; report hides filenames",async t=>{
  const f=await setup(t),result=await verifyRestoredOriginals(f.manifest,f.restore);
  assert.equal(result.status,"PASS");assert.equal(result.matchedFiles,1);
  assert.ok(!JSON.stringify(result).includes("photo.jpg"));
});
test("same-size alteration is detected by SHA256",async t=>{
  const f=await setup(t);await writeFile(path.join(f.restore,"photos","photo.jpg"),Buffer.from([255,216,255,0,216]));
  const a=await verifyRestoredOriginals(f.manifest,f.restore);
  assert.equal(a.status,"FAIL");assert.equal(a.alteredFiles,1);
});
test("missing and unexpected files are detected",async t=>{
  const f=await setup(t);
  await rm(path.join(f.restore,"photos","photo.jpg"));await writeFile(path.join(f.restore,"photos","unexpected"),"z");
  const a=await verifyRestoredOriginals(f.manifest,f.restore);
  assert.equal(a.missingFiles,1);assert.equal(a.unexpectedFiles,1);assert.equal(a.status,"FAIL");
});
test("symbolic links cannot be smuggled into restored evidence",async t=>{
  const f=await setup(t);await symlink("/etc/passwd",path.join(f.restore,"photos","bad"));
  await assert.rejects(()=>verifyRestoredOriginals(f.manifest,f.restore),/Symbolic links forbidden/);
});
test("reject manifest traversal, Windows separators and duplicate names",async t=>{
  const f=await setup(t);
  for(const rel of ["../credentials","/etc/passwd","photos/../../etc","photos\\other"]) {
    await assert.rejects(()=>verifyRestoredOriginals({...f.manifest,files:[{...f.manifest.files[0],relativePath:rel}]},f.restore));
  }
  await assert.rejects(()=>verifyRestoredOriginals({...f.manifest,files:[f.manifest.files[0],f.manifest.files[0]]},f.restore));
});
test("verification must not treat live /data as isolated restoration",async t=>{
  const f=await setup(t);
  await assert.rejects(()=>verifyRestoredOriginals(f.manifest,"/data/semse-storage"),/isolated/);
});
test("write manifest privately, once, outside source",async t=>{
  const f=await setup(t),dest=path.join(f.base,"manifest.json");
  await saveManifestExclusive(f.manifest,dest,f.source);
  assert.equal(JSON.parse(await readFile(dest,"utf8")).files.length,1);
  await assert.rejects(()=>saveManifestExclusive(f.manifest,dest,f.source),e=>e.code==="EEXIST");
  await assert.rejects(()=>saveManifestExclusive(f.manifest,path.join(f.source,"manifest.json"),f.source),/outside/);
});
test("multipart staging is excluded from original snapshot and restore comparison",async t=>{
  const f=await setup(t);
  await mkdir(path.join(f.source,"multipart"),{recursive:true});
  await mkdir(path.join(f.restore,"multipart"),{recursive:true});
  await writeFile(path.join(f.source,"multipart","in-progress.part"),"partial");
  await writeFile(path.join(f.restore,"multipart","in-progress.part"),"different partial");
  const manifest=await makeManifest(f.source,"fixture-backup-2026");
  assert.equal(manifest.excludedStagingDirectory,"multipart");
  assert.equal(manifest.files.length,1);
  const result=await verifyRestoredOriginals(manifest,f.restore);
  assert.equal(result.status,"PASS");
});
