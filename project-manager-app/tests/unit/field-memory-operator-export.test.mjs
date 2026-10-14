import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,rm,writeFile,readFile} from "node:fs/promises";
import {copyFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {parseStorageRoot,validateAlias,performOperatorExport} from "../../scripts/field-memory-operator-export.mjs";
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
test("bad remote inventory aborts before SCP and never invents success",async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),"semse-operator-test-"));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 let copied=false;
 const fake={validateDestination:async()=>dir,mkdir,writeFile,readFile,executeCustodyGate,
  invoke(cmd,args){
   if(cmd==="ssh")return "hostname ssh.railway.com\nuser test.up.railway.app";
   if(cmd==="railway"&&args[0]==="--version")return "railway test";
   if(cmd==="railway"&&args.includes("printenv"))return "/data/semse-storage\n";
   if(cmd==="railway"&&args.includes("node"))return '{"schema":"wrong"}';
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
   if(cmd==="ssh")return "hostname ssh.railway.com\nuser test.up.railway.app";
   if(cmd==="railway"&&args[0]==="--version")return "railway test";
   if(cmd==="railway"&&args.includes("printenv"))return "/data/semse-storage\n";
   if(cmd==="railway"&&args.includes("node")) {
    reads++;
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
