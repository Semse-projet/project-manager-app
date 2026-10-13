import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { StorageService } from "../dist/infrastructure/storage/storage.service.js";

async function withRoot(t: Parameters<typeof test>[1] extends (t: infer T) => unknown ? T : never) {
  const dir=await mkdtemp(path.join(os.tmpdir(),"semse-atomic-original-"));
  const old=process.env.SEMSE_STORAGE_ROOT;
  process.env.SEMSE_STORAGE_ROOT=dir;
  t.after(async()=>{
    if(old===undefined) delete process.env.SEMSE_STORAGE_ROOT;
    else process.env.SEMSE_STORAGE_ROOT=old;
    await rm(dir,{recursive:true,force:true});
  });
  return {dir,storage:new StorageService()};
}
test("no partially uploaded original is visible before stream completion",async t=>{
  const {dir,storage}=await withRoot(t);
  let signal!:()=>void,release!:()=>void;
  const reached=new Promise<void>(resolve=>{signal=resolve;});
  const finish=new Promise<void>(resolve=>{release=resolve;});
  const key="tenants/tenantA/public-intake/evidence/wall.jpg";
  const body=Readable.from((async function*(){
    yield Buffer.from([0xff,0xd8,0xff]);
    signal();
    await finish;
    yield Buffer.from([0,1,2,0xff,0xd9]);
  })());
  const uploading=storage.store({key,stream:body,contentType:"image/jpeg"});
  try {
    await reached;
    await assert.rejects(()=>stat(path.join(dir,key)),(e:unknown)=>(e as NodeJS.ErrnoException).code==="ENOENT");
  } finally {
    release();
  }
  const result=await uploading;
  assert.equal(result.sizeBytes,8);
  assert.deepEqual(await readFile(path.join(dir,key)),Buffer.from([0xff,0xd8,0xff,0,1,2,0xff,0xd9]));
  assert.deepEqual(await readdir(path.join(dir,"multipart",".put-staging")),[]);
});
test("stream failure leaves zero published originals and cleans its private staging file",async t=>{
  const {dir,storage}=await withRoot(t);
  const key="tenants/tenantA/public-intake/evidence/failure.jpg";
  const failed=Readable.from((async function*(){
    yield Buffer.from([0xff,0xd8,0xff]);
    throw Error("abrupt transfer");
  })());
  await assert.rejects(()=>storage.store({key,stream:failed,contentType:"image/jpeg"}),/abrupt transfer/);
  await assert.rejects(()=>stat(path.join(dir,key)),(e:unknown)=>(e as NodeJS.ErrnoException).code==="ENOENT");
  assert.deepEqual(await readdir(path.join(dir,"multipart",".put-staging")),[]);
});
test("sequential reupload with same key is rejected and leaves original unchanged",async t=>{
  const {dir,storage}=await withRoot(t);
  const key="tenants/tenantA/public-intake/evidence/immutable.txt";
  const body=(text:string)=>Readable.from([Buffer.from(text)]);
  await storage.store({key,stream:body("first"),contentType:"text/plain"});
  await assert.rejects(
    ()=>storage.store({key,stream:body("second"),contentType:"text/plain"}),
    (e:unknown)=>!!e&&typeof e==="object"&&"status" in e&&e.status===409,
  );
  assert.equal((await readFile(path.join(dir,key))).toString(),"first");
  assert.deepEqual(await readdir(path.join(dir,"multipart",".put-staging")),[]);
});
