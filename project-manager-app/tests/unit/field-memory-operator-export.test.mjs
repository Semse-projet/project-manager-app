import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,rm,writeFile,readFile} from "node:fs/promises";
import {copyFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {parseStorageRoot,validateAlias,performOperatorExport,runOperatorLocalPreflight,resolveOperatorCommand} from "../../scripts/field-memory-operator-export.mjs";
import {makeManifest} from "../../scripts/field-memory-originals-restore-drill.mjs";
import {executeCustodyGate} from "../../scripts/field-memory-custody-gate.mjs";

test("strict /data root parser rejects path injection and missing mount",()=>{
 for(const v of ["", "/tmp/semse-storage", "/data", "/data/../etc",
 "/data/a//b","/data/a space","/data/a/","/data/a\n/data/b"])assert.throws(()=>parseStorageRoot(v));
 assert.equal(parseStorageRoot("/data/semse-storage\n"),"/data/semse-storage");
});
test("ssh alias must target ssh.railway.com",()=>{
 assert.throws(()=>validateAlias("hostname example.com\nuser bob"));
 assert.doesNotThrow(()=>validateAlias("hostname ssh.railway.com\nuser example.up.railway.app"));
});
test("without encryption and write-quiescence attestation no commands execute",async()=>{
 let count=0;
 await assert.rejects(()=>performOperatorExport({execute:true,encrypted:true,quiescent:false,
 secureDir:"/fake"},{invoke(){count++;}}));
 assert.equal(count,0);
});
test("full storage scope needs explicit authorization; copying contracts is not implicit",async()=>{
 let calls=0;
 await assert.rejects(()=>performOperatorExport({execute:true,encrypted:true,quiescent:true,fullStorageScope:false,
  secureDir:"/fake"},{invoke(){calls++;}}));
 assert.equal(calls,0);
});
test("SCP alias bound to different service instance is rejected before reading bytes",async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),"semse-operator-alias-"));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 let reads=0;
 const fake={validateDestination:async()=>dir,mkdir,writeFile,readFile,executeCustodyGate,
  invoke(cmd,args){
   if(cmd==="railway"&&args[0]==="--version")return "railway test";
   if(cmd==="railway"&&args[0]==="ssh"&&args[1]==="config")return "Host semse-api-prod\n HostName ssh.railway.com\n User correct.up.railway.app";
   if(cmd==="ssh")return "hostname ssh.railway.com\nuser wrong.up.railway.app";
   reads++;throw Error("remote original accessed when alias mismatched");
  }};
 await assert.rejects(()=>performOperatorExport({execute:true,encrypted:true,quiescent:true,
  fullStorageScope:true,secureDir:dir},fake),/Stale SSH alias/);
 assert.equal(reads,0);
});

test("bad remote inventory aborts before SCP and never invents success",async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),"semse-operator-test-"));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 let copied=false;
 const fake={validateDestination:async()=>dir,mkdir,writeFile,readFile,executeCustodyGate,
  invoke(cmd,args){
   if(cmd==="ssh" && args[0]==="-G")return "hostname ssh.railway.com\nuser test.up.railway.app";
   if(cmd==="railway"&&args[0]==="--version")return "railway test";
   if(cmd==="railway"&&args[0]==="ssh"&&args[1]==="config")return "Host semse-api-prod\n HostName ssh.railway.com\n User test.up.railway.app";
   if(cmd==="ssh" && args.includes("printenv"))return "/data/semse-storage\n";
   if(cmd==="ssh" && args.includes("node"))return '{"schema":"wrong"}';
   if(cmd==="scp"){copied=true;return "";}
   throw Error("unexpected");
  }};
 await assert.rejects(()=>performOperatorExport({execute:true,encrypted:true,quiescent:true,fullStorageScope:true,
  secureDir:dir},fake));
 assert.equal(copied,false);
});
test("two valid inventories and a local SCP fixture yield offsite-only PASS",async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),"semse-operator-success-"));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const fixture=path.join(dir,"fixture");await mkdir(fixture);
 const bytes=Buffer.from([255,216,255,217]);
 await writeFile(path.join(fixture,"wall.jpg"),bytes);
 const source=await makeManifest(fixture,"fixture-ref");
 let reads=0,steps=0;
 const fake={validateDestination:async()=>dir,mkdir,writeFile,readFile,executeCustodyGate,
  invoke(cmd,args){
   if(cmd==="ssh" && args[0]==="-G")return "hostname ssh.railway.com\nuser test.up.railway.app";
   if(cmd==="railway"&&args[0]==="--version")return "railway test";
   if(cmd==="railway"&&args[0]==="ssh"&&args[1]==="config")return "Host semse-api-prod\n HostName ssh.railway.com\n User test.up.railway.app";
   if(cmd==="ssh" && args.includes("printenv"))return "/data/semse-storage\n";
   if(cmd==="ssh" && args.includes("node")) {
    reads++;
    assert.equal(args[0],"-T");
    assert.equal(args[1],"semse-api-prod");
    assert.equal(args[2],"node");
    assert.equal(args[3],"--input-type=module");
    assert.equal(args[4],"-");
    return JSON.stringify({...source,backupReference:args.at(-1),
     createdAt:new Date(Date.now()+reads*5000).toISOString()});
   }
   if(cmd==="scp") {steps++;copyFileSync(path.join(fixture,"wall.jpg"),path.join(args.at(-1),"wall.jpg"));return "";}
   throw Error("unexpected");
  }};
 const result=await performOperatorExport({execute:true,encrypted:true,quiescent:true,fullStorageScope:true,
  secureDir:dir},fake);
 assert.equal(result.result,"OFFSITE_RESTORE_PASS");
 assert.equal(result.filesRestored,1);
 assert.equal(result.railwaySnapshotRestored,false);
 assert.equal(result.captureSessionActivationPermitted,false);
 assert.equal(reads,2);assert.equal(steps,1);
});

test("local preflight identifies which step failed, without leaking aliases, secrets or keys",()=>{
  const ok = (command,args) => {
    if (command === "railway" && args[0] === "--version") return "railway cli";
    if (command === "railway" && args[0] === "ssh") return "Host semse-api-prod\n HostName ssh.railway.com\n User correct.up.railway.app";
    if (command === "ssh" && args[0] === "-G") return "hostname ssh.railway.com\nuser correct.up.railway.app";
    throw Error("unexpected command");
  };
  const scpAvailable=()=>({status:1,error:undefined});
  assert.deepEqual(runOperatorLocalPreflight(ok,scpAvailable),{ready:true,failedStage:null});
  const failsOn = (stage) => (cmd,args) => {
    if(stage==="railway-cli" && cmd==="railway" && args[0]==="--version")throw Error("sensitive key");
    if(stage==="ssh-config-preview" && cmd==="railway" && args[0]==="ssh")throw Error("sensitive key");
    if(stage==="ssh-alias-binding" && cmd==="ssh")throw Error("sensitive key");
    return ok(cmd,args);
  };
  for (const stage of ["railway-cli","ssh-config-preview","ssh-alias-binding"]) {
    const r=runOperatorLocalPreflight(failsOn(stage),scpAvailable);
    assert.equal(r.ready,false);assert.equal(r.failedStage,stage);
    assert.ok(!JSON.stringify(r).includes("sensitive key"));
  }
  assert.equal(runOperatorLocalPreflight(ok,()=>({status:null,error:{code:"ENOENT"}})).failedStage,
    "scp-executable");
});
test("local preflight refuses an SSH alias pointing to another service identity",()=>{
  const invoke=(cmd,args)=>{
    if(cmd==="railway" && args[0]==="--version")return "railway";
    if(cmd==="railway")return "Host semse-api-prod\n HostName ssh.railway.com\n User current.up.railway.app";
    if(cmd==="ssh")return "hostname ssh.railway.com\nuser old.up.railway.app";
  };
  const result=runOperatorLocalPreflight(invoke,()=>({status:1}));
  assert.deepEqual(result,{ready:false,failedStage:"ssh-alias-binding"});
});

test("Windows Railway shim uses cmd.exe for allowlisted static commands only",()=>{
  const v=resolveOperatorCommand("railway",["--version"],{platform:"win32",comspec:"cmd.exe"});
  assert.equal(v.command,"cmd.exe");
  assert.deepEqual(v.args,["/d","/s","/c","railway --version"]);
  const config=["ssh","config","-p","95ad1b14-d1d9-467d-82d8-5354619ba873",
    "-e","d682210a-956a-4508-9c5b-4ca5959278f9","-s","semse-API",
    "--alias","semse-api-prod","--dry-run"];
  assert.equal(resolveOperatorCommand("railway",config,{platform:"win32"}).args[3],"railway "+config.join(" "));
  assert.throws(()=>resolveOperatorCommand("railway",["ssh","config","&whoami"],{platform:"win32"}));
  assert.throws(()=>resolveOperatorCommand("railway",["ssh","-s","semse-API","--","node","-e","eval"],{platform:"win32"}));
  assert.deepEqual(resolveOperatorCommand("ssh",["-G","semse-api-prod"],{platform:"win32"}),
    {command:"ssh",args:["-G","semse-api-prod"]});
  assert.deepEqual(resolveOperatorCommand("railway",["--version"],{platform:"linux"}),
    {command:"railway",args:["--version"]});
});
