import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { StorageService } from "../dist/infrastructure/storage/storage.service.js";
import { EvidenceController } from "../dist/modules/evidence/evidence.controller.js";

function fakeReq(tenantId: string, raw = Readable.from([])) {
  return {headers:{},authContext:{tenantId,orgId:"org-fixture",userId:"user-fixture",roles:["OPS_ADMIN"]},raw} as never;
}
function fakeBoundary() {
  let state = "OPEN";
  let drainOnKind: string | null = null;
  const admitted: string[] = [];
  const cleanSettled: string[] = [];
  return {
    get admitted(){return admitted;},
    get cleanSettled(){return cleanSettled;},
    setState(next: string){state=next;},
    drainAfterAdmission(kind: string){drainOnKind=kind;},
    async assertPlanOpen() {
      if(state!=="OPEN") throw Error("storage gate not open");
    },
    async run(input: {
      scope:string;
      kind:string;
      work:(ticket: {
        id:string;kind:any;scope:string;epoch:bigint;writerInstanceId:string;
      })=>Promise<unknown>;
      proveCleanFailure?: (ticket: unknown, cause: unknown)=>Promise<void>;
    }) {
      if(state!=="OPEN") throw Error("storage gate not open");
      admitted.push(input.kind);
      const ticket = {
        id:"b78c25ea-d9ac-42cc-99d2-e309241959e0",
        kind:input.kind,
        scope:input.scope,
        epoch:1n,
        writerInstanceId:"synthetic-api",
      };
      if(drainOnKind===input.kind) {
        state="DRAINING";
        drainOnKind=null;
      }
      try {
        return await input.work(ticket);
      } catch(cause) {
        if(input.proveCleanFailure) {
          await input.proveCleanFailure(ticket,cause);
          cleanSettled.push(input.kind);
        }
        throw cause;
      }
    },
    async beforePublish() {
      if(state==="FROZEN") throw Error("storage gate frozen");
    },
  };
}
async function setup(t: import("node:test").TestContext) {
  const root = await mkdtemp(path.join(tmpdir(),"semse-t008-multipart-storage-"));
  const multipart = await mkdtemp(path.join(tmpdir(),"semse-t008-multipart-parts-"));
  const keys = ["NODE_ENV","SEMSE_STORAGE_ROOT","SEMSE_MULTIPART_STORAGE_ROOT",
    "SEMSE_STORAGE_WRITE_GATE_MODE","STORAGE_PROVIDER","RAILWAY_ENVIRONMENT","RAILWAY_ENVIRONMENT_NAME"];
  const saved = Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  Object.assign(process.env,{
    NODE_ENV:"test",SEMSE_STORAGE_ROOT:root,SEMSE_MULTIPART_STORAGE_ROOT:multipart,
    SEMSE_STORAGE_WRITE_GATE_MODE:"staging",STORAGE_PROVIDER:"local",
  });
  delete process.env.RAILWAY_ENVIRONMENT;
  delete process.env.RAILWAY_ENVIRONMENT_NAME;
  t.after(async ()=>{
    for(const [k,v] of Object.entries(saved)){
      if(v===undefined) delete process.env[k]; else process.env[k]=v;
    }
    await Promise.all([rm(root,{recursive:true,force:true}),rm(multipart,{recursive:true,force:true})]);
  });
  const boundary=fakeBoundary();
  const storage=new StorageService(boundary as never);
  const controller=new EvidenceController({} as never,storage);
  const tenantId="ten-fixture-"+randomUUID();
  return {root,multipart,boundary,storage,controller,tenantId,req:fakeReq(tenantId)};
}
const validHeader=()=>Buffer.concat([
  Buffer.from([0,0,0,24,...Buffer.from("ftyp"),0x6d,0x70,0x34,0x32]),
  Buffer.alloc(28,0x11),
]);
const is503=(err: unknown)=> typeof err==="object" && err!==null && "status" in err && err.status===503;

test("S3b presign and upload-plan endpoints are denied during DRAINING",async t=>{
  const f=await setup(t);
  f.boundary.setState("DRAINING");

  await assert.rejects(
    ()=>f.controller.presign(f.req,{
      filename:"photo.jpg",contentType:"image/jpeg",fileSizeBytes:1024,
    }),
    is503,
  );
  await assert.rejects(
    ()=>f.controller.planUpload(f.req,{
      domain:"evidence",filename:"photo.jpg",contentType:"image/jpeg",
      fileSizeBytes:1024,source:"local_device",
    }),
    is503,
  );
});

test("S3b multipart create and part are denied during DRAINING without files",async t=>{
  const f=await setup(t);
  f.boundary.setState("DRAINING");
  await assert.rejects(()=>f.controller.createMultipartSessionEndpoint(f.req,{
    domain:"evidence",filename:"original.mp4",contentType:"video/mp4",fileSizeBytes:40,
  }),is503);
  f.boundary.setState("OPEN");
  const created=await f.controller.createMultipartSessionEndpoint(f.req,{
    domain:"evidence",filename:"original.mp4",contentType:"video/mp4",fileSizeBytes:40,
  }) as {data:{sessionId:string;key:string}};
  assert.equal(f.boundary.admitted[0],"MULTIPART_CREATE");
  const manifest=path.join(f.multipart,created.data.sessionId+".json");
  assert.ok((await readFile(manifest)).length>0);
  f.boundary.setState("DRAINING");
  await assert.rejects(
    ()=>f.controller.uploadMultipartPart(
      fakeReq(f.tenantId,Readable.from([validHeader()])),
      created.data.sessionId,"1"),
    is503,
  );
  await assert.rejects(()=>stat(path.join(f.multipart,"parts",created.data.sessionId,"part-1.bin")),{code:"ENOENT"});
  assert.equal((await f.storage.stat(created.data.key)).exists,false);
});

test("S3b multipart complete is denied in DRAINING after uploaded part exists",async t=>{
  const f=await setup(t);
  const header=validHeader();
  const created=await f.controller.createMultipartSessionEndpoint(f.req,{
    domain:"evidence",filename:"original.mp4",contentType:"video/mp4",fileSizeBytes:header.length,
  }) as {data:{sessionId:string;key:string}};
  const uploaded=await f.controller.uploadMultipartPart(
    fakeReq(f.tenantId,Readable.from([header])),
    created.data.sessionId,"1",
  ) as {data:{etag:string}};
  assert.ok(f.boundary.admitted.includes("MULTIPART_PART"));
  f.boundary.setState("DRAINING");
  await assert.rejects(()=>f.controller.completeMultipartSession(f.req,{
    sessionId:created.data.sessionId,
    parts:[{partNumber:1,etag:uploaded.data.etag}],
  }),is503);
  assert.equal((await f.storage.stat(created.data.key)).exists,false);
  const bytes=await readFile(path.join(f.multipart,"parts",created.data.sessionId,"part-1.bin"));
  assert.deepEqual(bytes,header,"part remains for explicitly authorized recovery");
});

test("S3b empty multipart part is proven clean and settles FAILED_CLEAN",async t=>{
  const f=await setup(t);
  const created=await f.controller.createMultipartSessionEndpoint(f.req,{
    domain:"evidence",filename:"empty.mp4",contentType:"video/mp4",fileSizeBytes:1,
  }) as {data:{sessionId:string}};

  await assert.rejects(
    ()=>f.controller.uploadMultipartPart(
      fakeReq(f.tenantId,Readable.from([])),
      created.data.sessionId,"1"),
    e=>typeof e==="object" && e!==null && "status" in e && e.status===422,
  );

  assert.ok(f.boundary.cleanSettled.includes("MULTIPART_PART"));
  await assert.rejects(
    ()=>stat(path.join(f.multipart,"parts",created.data.sessionId,"part-1.bin")),
    {code:"ENOENT"},
  );
});

test("S3b admitted multipart completion reuses its outer ticket while DRAINING",async t=>{
  const f=await setup(t);
  const header=validHeader();
  const created=await f.controller.createMultipartSessionEndpoint(f.req,{
    domain:"evidence",filename:"original.mp4",contentType:"video/mp4",fileSizeBytes:header.length,
  }) as {data:{sessionId:string;key:string}};
  const uploaded=await f.controller.uploadMultipartPart(
    fakeReq(f.tenantId,Readable.from([header])),
    created.data.sessionId,"1",
  ) as {data:{etag:string}};

  f.boundary.drainAfterAdmission("MULTIPART_COMPLETE");
  const completed=await f.controller.completeMultipartSession(f.req,{
    sessionId:created.data.sessionId,
    parts:[{partNumber:1,etag:uploaded.data.etag}],
  }) as {data:{status:string;key:string}};

  assert.equal(completed.data.status,"completed");
  assert.equal(completed.data.key,created.data.key);
  assert.equal((await f.storage.stat(created.data.key)).exists,true);
  assert.equal(
    f.boundary.admitted.filter(kind=>kind==="ORIGINAL_STORE").length,
    0,
    "nested StorageService.store must reuse MULTIPART_COMPLETE ticket",
  );
});

test("S3b source guards both Evidence registrations behind the same write boundary",()=>{
  const source=readFileSync(new URL("../src/modules/evidence/evidence.controller.ts",import.meta.url),"utf8");
  for(const kind of ["MULTIPART_CREATE","MULTIPART_PART","MULTIPART_COMPLETE"]){
    assert.match(source,new RegExp('withWriteGateMutation\\("'+kind+'"'));
  }
  const canonical=readFileSync(new URL("../src/modules/evidence/evidence.service.ts",import.meta.url),"utf8");
  assert.equal((canonical.match(/withWriteGateMutation\("EVIDENCE_REGISTER"/g)??[]).length,1);
  assert.doesNotMatch(source,/withWriteGateMutation\("EVIDENCE_REGISTER"/,
    "controller must delegate to canonically guarded EvidenceService");
});
