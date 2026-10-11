#!/usr/bin/env node
// SEMSE original Evidence restore integrity drill. NEVER restores onto production.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import {copyFile,lstat,mkdir,mkdtemp,open,readFile,readdir,rm,writeFile,realpath} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";

export const SCHEMA="semse-originals-manifest-v1";
function safeName(s) {
  return typeof s==="string" && s.length>0 && !s.includes("\\") && !s.includes("\0")
    && !path.posix.isAbsolute(s) && path.posix.normalize(s)===s
    && s.split("/").every(x=>x && x!=="." && x!=="..");
}
async function filesUnder(root) {
  if (!(await lstat(root)).isDirectory()) throw Error("Source must be ordinary directory");
  const items=[];
  async function walk(dir,prefix) {
    for(const entry of await readdir(dir,{withFileTypes:true})) {
      const name=prefix ? prefix+"/"+entry.name : entry.name;
      if(!safeName(name)) throw Error("Unsafe filename");
      const full=path.join(dir,entry.name);
      if(entry.isSymbolicLink()) throw Error("Symbolic links forbidden in Evidence backup");
      if(entry.isDirectory()) await walk(full,name);
      else if(entry.isFile()) {
        items.push({name,full});
        if(items.length>200000) throw Error("File count exceeds audit limit");
      } else throw Error("Special file forbidden in Evidence backup");
    }
  }
  await walk(root,"");
  return items.sort((a,b)=>a.name.localeCompare(b.name,"en"));
}
async function digest(file) {
  const sha=createHash("sha256");let bytes=0;
  for await(const chunk of createReadStream(file)) {sha.update(chunk);bytes+=chunk.length;}
  return {sizeBytes:bytes,sha256:sha.digest("hex")};
}
export async function makeManifest(root,backupReference) {
  if(typeof backupReference!=="string" || !/^[a-zA-Z0-9._-]{8,128}$/.test(backupReference))
    throw Error("Opaque backup reference required");
  const files=[];
  for(const file of await filesUnder(root)) files.push({relativePath:file.name,...await digest(file.full)});
  return {schema:SCHEMA,backupReference,createdAt:new Date().toISOString(),files};
}
export async function saveManifestExclusive(manifest,output,originalRoot) {
  const dest=path.resolve(output),source=path.resolve(originalRoot);
  if(dest===source || dest.startsWith(source+path.sep)) throw Error("Manifest must be outside original root");
  const handle=await open(dest,"wx",0o600);
  try {await handle.writeFile(JSON.stringify(manifest,null,2)+"\n");}
  finally {await handle.close();}
}
function validate(manifest) {
  if(manifest?.schema!==SCHEMA || !Array.isArray(manifest.files) || manifest.files.length>200000
    || typeof manifest.backupReference!=="string" || !/^[a-zA-Z0-9._-]{8,128}$/.test(manifest.backupReference))
    throw Error("Invalid snapshot manifest");
  const seen=new Set();
  for(const e of manifest.files) {
    if(!safeName(e.relativePath) || seen.has(e.relativePath)
      || !Number.isSafeInteger(e.sizeBytes) || e.sizeBytes<0
      || typeof e.sha256!=="string" || !/^[a-f0-9]{64}$/.test(e.sha256))
      throw Error("Invalid or duplicate manifest entry");
    seen.add(e.relativePath);
  }
}
export async function verifyRestoredOriginals(manifest,restoredRoot) {
  validate(manifest);
  const resolved=path.resolve(restoredRoot);
  if(resolved==="/data" || resolved.startsWith("/data/"))
    throw Error("Restored copy must be isolated from production /data");
  const actualRoot=await realpath(resolved);
  if(actualRoot==="/data" || actualRoot.startsWith("/data/"))
    throw Error("Restored copy resolves inside production /data");
  if(!(await lstat(resolved)).isDirectory()) throw Error("Restored root must be ordinary directory");
  const list=await filesUnder(resolved),expected=new Map(manifest.files.map(x=>[x.relativePath,x]));
  const found=new Set();
  let matches=0,altered=0,unexpected=0;
  for(const f of list) {
    const e=expected.get(f.name);
    if(!e) {unexpected++;continue;}
    found.add(f.name);
    const actual=await digest(f.full);
    if(actual.sizeBytes===e.sizeBytes && actual.sha256===e.sha256) matches++;
    else altered++;
  }
  const missing=manifest.files.length-found.size;
  return {status:missing||altered||unexpected?"FAIL":"PASS",expectedFiles:manifest.files.length,
    matchedFiles:matches,missingFiles:missing,alteredFiles:altered,unexpectedFiles:unexpected,
    actualRailwayBackupVerified:false,
    note:"Hash comparison only. Backup provenance, restore isolation and database/Evidence correlation require separate operator evidence."};
}
export async function syntheticRestoreDrill() {
  const base=await mkdtemp(path.join(os.tmpdir(),"semse-originals-fixture-"));
  try {
    const source=path.join(base,"source"),restore=path.join(base,"restored");
    await mkdir(path.join(source,"photos"),{recursive:true});
    await mkdir(path.join(restore,"photos"),{recursive:true});
    await writeFile(path.join(source,"photos","wall.jpg"),Buffer.from([255,216,255,0,217]));
    const manifest=await makeManifest(source,"synthetic-fixture");
    await copyFile(path.join(source,"photos","wall.jpg"),path.join(restore,"photos","wall.jpg"));
    const normal=await verifyRestoredOriginals(manifest,restore);
    assert.equal(normal.status,"PASS");
    await writeFile(path.join(restore,"photos","wall.jpg"),Buffer.from("tampered"));
    const corrupted=await verifyRestoredOriginals(manifest,restore);
    assert.equal(corrupted.status,"FAIL");
    return {mode:"SYNTHETIC_ONLY",cleanRestore:normal.status,corruptionDetected:corrupted.alteredFiles===1,
      actualRailwayBackupVerified:false};
  } finally {await rm(base,{recursive:true,force:true});}
}
function arg(name) {const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined;}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if(process.argv.includes("--fixture")) {
      process.stdout.write(JSON.stringify(await syntheticRestoreDrill(),null,2)+"\n");
    } else if(process.argv.includes("--create-manifest")) {
      const root=arg("--source"),dest=arg("--output"),id=arg("--backup-reference");
      if(!root||!dest||!id) throw Error("Source/output/backup reference required");
      const manifest=await makeManifest(root,id);
      await saveManifestExclusive(manifest,dest,root);
      process.stdout.write(JSON.stringify({status:"MANIFEST_CREATED",files:manifest.files.length,
        actualRailwayBackupVerified:false})+"\n");
    } else if(process.argv.includes("--verify")) {
      const file=arg("--manifest"),restored=arg("--restored-root");
      if(!file||!restored) throw Error("Manifest and restored root required");
      const audit=await verifyRestoredOriginals(JSON.parse(await readFile(file,"utf8")),restored);
      process.stdout.write(JSON.stringify(audit,null,2)+"\n");
      if(audit.status!=="PASS") process.exitCode=2;
    } else throw Error("Choose --fixture, --create-manifest, or --verify");
  } catch {
    process.stderr.write("Restore audit aborted: invalid arguments, unsafe layout, or unreadable evidence\n");
    process.exitCode=1;
  }
}