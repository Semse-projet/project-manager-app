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
export function sshIdentity(text) {
  const lines=String(text).split(/\r?\n/);
  const get=name=> {
    const match=lines.map(l=>l.trim()).find(l=>l.toLowerCase().startsWith(name+" "));
    return match ? match.slice(name.length).trim() : null;
  };
  const host=get("hostname")?.toLowerCase();
  const user=get("user");
  if(host!=="ssh.railway.com" || !user || !/^[a-zA-Z0-9._-]+$/.test(user))
    throw Error("Unverified SSH alias");
  return {host,user};
}
export function validateAlias(text){ return sshIdentity(text); }
function expectedRailwayAlias(invokeCommand){
  const cfg=invokeCommand("railway",["ssh","config","-p",target.project,
    "-e",target.environment,"-s",target.service,"--alias",target.alias,"--dry-run"],15000);
  return sshIdentity(cfg);
}
function assertAliasBound(invokeCommand){
  const expected=expectedRailwayAlias(invokeCommand);
  const current=sshIdentity(invokeCommand("ssh",["-G",target.alias],15000));
  if(expected.user!==current.user || expected.host!==current.host)throw Error("Stale SSH alias for different Railway instance");
}

// On Windows, the Railway CLI can resolve to railway.ps1. Node spawnSync
// cannot start a .ps1 file directly. PowerShell is used ONLY to execute one of
// two static, allowlisted Railway commands. No storage paths, JS inventory
// source, input from users, or secrets are interpolated into the command.
export function resolveOperatorCommand(command, args, {
  platform = process.platform,
} = {}) {
  if (platform !== "win32" || command !== "railway")
    return { command, args };
  const version = args.length === 1 && args[0] === "--version";
  const expectedConfig = ["ssh","config","-p",target.project,"-e",target.environment,
    "-s",target.service,"--alias",target.alias,"--dry-run"];
  const config = args.length === expectedConfig.length &&
    args.every((v,i) => v === expectedConfig[i]);
  if (!version && !config) throw Error("Non-approved Railway command for Windows shim");
  if (!args.every(v => /^[A-Za-z0-9._-]+$/.test(v)))
    throw Error("Unsafe Railway CLI argument");
  return { command: "powershell.exe",
    args: ["-NoProfile", "-NonInteractive", "-Command", "railway " + args.join(" ")] };
}

function invoke(command,args,timeout=900000,maxBuffer=100*1024*1024,input) {
  const native=resolveOperatorCommand(command,args);
  const result=spawnSync(native.command,native.args,{encoding:"utf8",windowsHide:true,
    timeout,maxBuffer,stdio:[input===undefined?"ignore":"pipe","pipe","pipe"],
    ...(input===undefined ? {} : {input})});
  if(result.error||result.status!==0)throw Error("Command failed without accepted output");
  return result.stdout;
}
/** Local-only, identity-redacted diagnostics: never opens SSH sessions or reads /data. */
export function runOperatorLocalPreflight(invokeCommand = invoke, spawnCommand = spawnSync) {
  let stage = "railway-cli";
  try {
    invokeCommand("railway", ["--version"], 15000);
    stage = "ssh-config-preview";
    const expected = expectedRailwayAlias(invokeCommand);
    stage = "ssh-alias-binding";
    const actual = sshIdentity(invokeCommand("ssh", ["-G", target.alias], 15000));
    if (expected.user !== actual.user || expected.host !== actual.host)
      throw Error("SSH alias must match current instance");
    stage = "scp-executable";
    // SCP without arguments should exit 1 after displaying usage; no files accessed.
    const scp = spawnCommand("scp", [], {
      encoding: "utf8", windowsHide: true, timeout: 15000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (scp.error || ![0, 1].includes(scp.status))
      throw Error("SCP command not available");
    return { ready: true, failedStage: null };
  } catch {
    return { ready: false, failedStage: stage };
  }
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
  if(!args.execute||!args.encrypted||!args.quiescent||!args.fullStorageScope)
    throw Error("Explicit encryption and frozen-write attestations required");
  const safe=await deps.validateDestination(args.secureDir);
  deps.invoke("railway",["--version"],15000);
  assertAliasBound(deps.invoke);
  // SSH uses a static, authenticated alias: never route filesystem reads through
  // a Windows shell wrapper or interpolate paths into a command string.
  const root=parseStorageRoot(deps.invoke("ssh",["-T",target.alias,
    "printenv","SEMSE_STORAGE_ROOT"],30000));
  const code=await deps.readFile(path.join(path.dirname(fileURLToPath(import.meta.url)),
    "field-memory-source-inventory.mjs"),"utf8");
  if(!code.includes("export { inventory }"))throw Error("Invalid source inventory script");
  const reference="export-"+randomUUID();
  const dir=path.join(safe,"semse-"+reference);
  const exportedRoot=path.join(dir,"originals"),isolatedParent=path.join(dir,"isolated");
  await deps.mkdir(exportedRoot,{recursive:true,mode:0o700});
  await deps.mkdir(isolatedParent,{recursive:true,mode:0o700});
  async function capture(filename) {
    // Stream JS via SSH stdin, avoiding command-line quoting and code injection.
    // node --input-type=module - <reference> reads code only from stdin.
    const raw=deps.invoke("ssh",["-T",target.alias,"node","--input-type=module",
      "-",reference],900000,100*1024*1024,code);
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
      const result = runOperatorLocalPreflight();
      if (!result.ready) {
        process.stderr.write("LOCAL_PREFLIGHT_BLOCKED: " + result.failedStage
          + ". No originals were accessed; no host/user/key details printed.\n");
        process.exitCode = 1;
      } else {
        process.stdout.write("LOCAL_PREFLIGHT_PASS; no originals were accessed.\n");
      }
    } else {
      const r=await performOperatorExport({secureDir:option("--secure-dir"),
        execute:process.argv.includes("--execute"),
        encrypted:process.argv.includes("--confirm-encrypted"),
        quiescent:process.argv.includes("--confirm-quiescent"),
        fullStorageScope:process.argv.includes("--confirm-full-storage-scope")});
      process.stdout.write(JSON.stringify(r,null,2)+"\n");
      if(r.result!=="OFFSITE_RESTORE_PASS")process.exitCode=2;
    }
  } catch {
    process.stderr.write("SEMSE export ABORTED: check SSH alias, encrypted destination, storage mount and private results. No keys printed.\n");
    process.exitCode=1;
  }
}
