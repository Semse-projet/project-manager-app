#!/usr/bin/env node
// Operator-only: read-only Railway SSH export, encrypted local copy, isolated hash drill.
// This does NOT restore a Railway-managed snapshot and cannot certify CaptureSession.
import {randomUUID} from "node:crypto";
import {spawnSync} from "node:child_process";
import {lstat,mkdir,readFile,realpath,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {executeCustodyGate} from "./field-memory-custody-gate.mjs";

const target={project:"95ad1b14-d1d9-467d-82d8-5354619ba873",
  environment:"d682210a-956a-4508-9c5b-4ca5959278f9",service:"semse-API",alias:"semse-api-prod"};
function within(a,b){return b===a||b.startsWith(a+path.sep);}
export function parseStorageRoot(stdout){
  const lines=String(stdout).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const valid=lines.filter(x=>/^\/data\/[A-Za-z0-9._/-]+$/.test(x));
  if(valid.length!==1)throw Error("Storage root missing or ambiguous");
  const root=valid[0];
  if(path.posix.normalize(root)!==root||root.includes("//")||root.endsWith("/")||
    root.split("/").some(x=>x===".."||x==="."))throw Error("Unsafe storage root");
  return root;
}
export function validateAlias(text){
  if(!/^\s*hostname\s+ssh\.railway\.com\s*$/im.test(String(text)) ||
     !/^\s*user\s+\S+/im.test(String(text)))throw Error("Unverified SSH alias");
}
function invoke(command,args,timeout=900000,maxBuffer=100*1024*1024) {
  const result=spawnSync(command,args,{encoding:"utf8",windowsHide:true,
    timeout,maxBuffer,stdio:["ignore","pipe","pipe"]});
  if(result.error||result.status!==0)throw Error("Command failed without accepted output");
  return result.stdout;
}
async function validateDestination(destination){
  if(!destination||!path.isAbsolute(destination))throw Error("Encrypted destination must be absolute");
  const real=await realpath(destination),info=await lstat(destination);
  const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
  if(info.isSymbolicLink()||real===path.parse(real).root||
    within(repo,real)||within(real,repo))throw Error("Unsafe destination");
  return real;
}
const prefix=["ssh","-p",target.project,"-e",target.environment,"-s",target.service,"--"];
export async function performOperatorExport(args,deps={invoke,readFile,writeFile,mkdir,
  validateDestination,executeCustodyGate}){
  if(!args.execute||!args.encrypted||!args.quiescent)
    throw Error("Explicit encryption and frozen-write attestations required");
  const safe=await deps.validateDestination(args.secureDir);
  deps.invoke("railway",["--version"],15000);
  validateAlias(deps.invoke("ssh",["-G",target.alias],15000));
  const root=parseStorageRoot(deps.invoke("railway",prefix.concat(["printenv","SEMSE_STORAGE_ROOT"]),30000));
  const code=await deps.readFile(path.join(path.dirname(fileURLToPath(import.meta.url)),
    "field-memory-source-inventory.mjs"),"utf8");
  if(!code.includes("export { inventory }"))throw Error("Invalid source inventory script");
  const reference="export-"+randomUUID();
  const dir=path.join(safe,"semse-"+reference);
  const exportedRoot=path.join(dir,"originals"),isolatedParent=path.join(dir,"isolated");
  await deps.mkdir(exportedRoot,{recursive:true,mode:0o700});
  await deps.mkdir(isolatedParent,{recursive:true,mode:0o700});
  async function capture(filename) {
    const raw=deps.invoke("railway",prefix.concat(["node","--input-type=module",
      "-e",code,"--",reference]),900000);
    const manifest=JSON.parse(raw);
    if(manifest?.schema!=="semse-originals-manifest-v1"||
      manifest.backupReference!==reference||
      !Array.isArray(manifest.files)||manifest.files.length<1)throw Error("Invalid manifest");
    await deps.writeFile(path.join(dir,filename),raw,{flag:"wx",mode:0o600});
  }
  await capture("before.json");
  deps.invoke("scp",["-q","-r",target.alias+":"+root+"/.",exportedRoot],1800000,5*1024*1024);
  await capture("after.json");
  const result=await deps.executeCustodyGate({beforeFile:path.join(dir,"before.json"),
    afterFile:path.join(dir,"after.json"),exportedRoot,isolatedParent});
  await deps.writeFile(path.join(dir,"aggregate-report.json"),JSON.stringify(result,null,2)+"\n",
    {flag:"wx",mode:0o600});
  return {result:result.result,sourceFiles:result.sourceFiles,
    filesRestored:result.filesRestored||0,railwaySnapshotRestored:false,
    evidenceDatabaseReconciled:false,captureSessionActivationPermitted:false};
}
function option(flag){const i=process.argv.indexOf(flag);return i>=0?process.argv[i+1]:undefined;}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try {
    if(process.argv.includes("--check")){
      invoke("railway",["--version"],15000);
      validateAlias(invoke("ssh",["-G",target.alias],15000));
      const scp=spawnSync("scp",[],{encoding:"utf8",windowsHide:true,timeout:15000});
      if(scp.error)throw Error("SCP unavailable");
      process.stdout.write("LOCAL_PREFLIGHT_PASS; no originals were accessed.\n");
    } else {
      const r=await performOperatorExport({secureDir:option("--secure-dir"),
        execute:process.argv.includes("--execute"),
        encrypted:process.argv.includes("--confirm-encrypted"),
        quiescent:process.argv.includes("--confirm-quiescent")});
      process.stdout.write(JSON.stringify(r,null,2)+"\n");
      if(r.result!=="OFFSITE_RESTORE_PASS")process.exitCode=2;
    }
  } catch {
    process.stderr.write("SEMSE export ABORTED: check SSH alias, encrypted destination, storage mount and private results. No keys printed.\n");
    process.exitCode=1;
  }
}
