import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { inspectMultipartQuiescence, realStorageOnPersistentMount } from "../../scripts/field-memory-multipart-quiescence.mjs";

async function fixture(t) {
  const root=await mkdtemp(path.join(tmpdir(),"semse-multipart-preflight-"));
  const multi=path.join(root,"multipart");
  await mkdir(multi);
  t.after(()=>rm(root,{recursive:true,force:true}));
  const inspect=(values={})=>inspectMultipartQuiescence({
    storageRoot:root,multipartRoot:multi,enforceProductionLayout:false,...values,
  });
  return {root,multi,inspect};
}

test("empty isolated staging directory is only an EMPTY_CANDIDATE, never a backup PASS",async t=>{
  const f=await fixture(t);
  const r=await f.inspect();
  assert.equal(r.result,"EMPTY_CANDIDATE");
  assert.equal(r.readOnly,true);
  assert.equal(r.backupVerified,false);
  assert.equal(r.evidenceDatabaseReconciled,false);
  assert.equal(r.writerCoverageAttested,false);
  assert.deepEqual(r.counts,{manifests:0,partDirectories:0,partFiles:0,unrecognizedEntries:0});
});

test("manifest file (including expired sessions) blocks a consistent backup precheck",async t=>{
  const f=await fixture(t);
  const secret="private-evidence-key-"+randomUUID();
  const manifest="mus_"+randomUUID()+".json";
  const file=path.join(f.multi,manifest);
  const bytes=JSON.stringify({key:secret,expired:true,parts:[]});
  await writeFile(file,bytes);
  const r=await f.inspect();
  assert.equal(r.result,"BLOCKED");
  assert.equal(r.reason,"multipart_pending_or_unrecognized");
  assert.equal(r.counts.manifests,1);
  assert.equal(await readFile(file,"utf8"),bytes,"auditor must never rewrite customer staging");
  assert.ok(!JSON.stringify(r).includes(secret));
  assert.ok(!JSON.stringify(r).includes(manifest));
  assert.ok(!JSON.stringify(r).includes(f.root));
});

test("multipart part directories, orphan parts and even empty session directories block",async t=>{
  const f=await fixture(t);
  const root=path.join(f.multi,"parts");
  const session=path.join(root,"mus_"+randomUUID());
  await mkdir(session,{recursive:true});
  let r=await f.inspect();
  assert.equal(r.result,"BLOCKED");
  assert.equal(r.counts.partDirectories,1);
  const data=Buffer.from("SYNTHETIC-PART-ONLY");
  await writeFile(path.join(session,"part-1.bin"),data);
  r=await f.inspect();
  assert.equal(r.counts.partFiles,1);
  assert.deepEqual(await readFile(path.join(session,"part-1.bin")),data);
});

test("unknown files and malformed manifests block even with zero known session count",async t=>{
  const f=await fixture(t);
  await writeFile(path.join(f.multi,"bad-manifest.json"),"secret");
  const r=await f.inspect();
  assert.equal(r.result,"BLOCKED");
  assert.equal(r.counts.unrecognizedEntries,1);
  assert.equal(r.counts.manifests,0);
});

test("production layout rejects /tmp even if an empty local directory exists",async t=>{
  const f=await fixture(t);
  const r=await inspectMultipartQuiescence({
    storageRoot:f.root,multipartRoot:f.multi,
    enforceProductionLayout:true,
    mountInfo:"11 1 8:2 / /data rw - ext4 /dev/mock rw\n",
  });
  assert.equal(r.result,"BLOCKED");
  assert.equal(r.reason,"persistent_mount_not_verified");
});

test("unrelated, missing and symlinked staging roots fail closed",async t=>{
  const f=await fixture(t);
  const other=await mkdtemp(path.join(tmpdir(),"semse-multipart-external-"));
  t.after(()=>rm(other,{recursive:true,force:true}));
  assert.equal((await f.inspect({multipartRoot:other})).reason,"multipart_outside_originals_root");
  assert.equal((await f.inspect({multipartRoot:path.join(f.root,"missing")})).result,"BLOCKED");
  await rm(f.multi,{recursive:true,force:true});
  await symlink(other,f.multi,process.platform==="win32"?"junction":"dir");
  const r=await f.inspect();
  assert.equal(r.result,"BLOCKED");
  assert.equal(r.reason,"multipart_unreadable_or_unsafe");
});

test("symlink entries in parts are never followed or reported by private name",async t=>{
  const f=await fixture(t);
  const session=path.join(f.multi,"parts","mus_"+randomUUID());
  await mkdir(session,{recursive:true});
  const secret="private-target-"+randomUUID();
  try {
    await symlink(path.join(f.root,secret),path.join(session,"part-1.bin"));
  } catch(error) {
    if(process.platform==="win32" && error?.code==="EPERM") return;
    throw error;
  }
  const r=await f.inspect();
  assert.equal(r.result,"BLOCKED");
  assert.equal(r.reason,"multipart_unreadable_or_unsafe");
  assert.ok(!JSON.stringify(r).includes(secret));
});

test("canonical-volume check refuses a symlinked parent escaping a nominal mount", async t => {
  const sandbox=await mkdtemp(path.join(tmpdir(),"semse-t008-symlink-ancestor-"));
  t.after(()=>rm(sandbox,{recursive:true,force:true}));
  const fakeMount=path.join(sandbox,"volume");
  const elsewhere=path.join(sandbox,"ephemeral");
  await mkdir(fakeMount);
  await mkdir(path.join(elsewhere,"storage","multipart"),{recursive:true});
  await symlink(elsewhere,path.join(fakeMount,"via-link"),
    process.platform==="win32"?"junction":"dir");
  const apparentStorage=path.join(fakeMount,"via-link","storage");
  assert.equal(apparentStorage.startsWith(fakeMount+path.sep),true,
    "the nominal path looks like it belongs to the volume");
  const physicalStorage=await realpath(apparentStorage);
  assert.equal(realStorageOnPersistentMount(physicalStorage,fakeMount),false,
    "a symlink in any ancestor cannot pass persistent-volume attestation");
  assert.equal(realStorageOnPersistentMount(
    path.join(fakeMount,"genuine-storage"),fakeMount),true);
});

test("missing environment cannot be interpreted as an empty multipart root",async()=>{
  const r=await inspectMultipartQuiescence();
  assert.equal(r.result,"BLOCKED");
  assert.equal(r.reason,"multipart_outside_originals_root");
});
