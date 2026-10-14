import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import {Readable} from "node:stream";
import {mkdtemp,rm,readdir} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  assertProductionStorageConfiguration,
  hasRailwayDataMount,
  isProductionStorage,
} from "../dist/infrastructure/storage/production-storage-guard.js";
import {StorageService} from "../dist/infrastructure/storage/storage.service.js";

test("production env recognition includes Railway production even without NODE_ENV",()=>{
  assert.equal(isProductionStorage({NODE_ENV:"production"}),true);
  assert.equal(isProductionStorage({RAILWAY_ENVIRONMENT:"production"}),true);
  assert.equal(isProductionStorage({RAILWAY_ENVIRONMENT_NAME:"production"}),true);
  assert.equal(isProductionStorage({NODE_ENV:"test",RAILWAY_ENVIRONMENT:"staging"}),false);
});

test("production refuses missing root, ephemeral path, traversal and unimplemented driver",()=>{
  const cases=[
    {NODE_ENV:"production",STORAGE_PROVIDER:"local"},
    {NODE_ENV:"production",STORAGE_PROVIDER:"local",SEMSE_STORAGE_ROOT:"/tmp/semse-storage"},
    {NODE_ENV:"production",STORAGE_PROVIDER:"local",SEMSE_STORAGE_ROOT:"/data"},
    {NODE_ENV:"production",STORAGE_PROVIDER:"local",SEMSE_STORAGE_ROOT:"/data/../tmp/data"},
    {NODE_ENV:"production",STORAGE_PROVIDER:"s3",SEMSE_STORAGE_ROOT:"/data/semse-storage"},
    {NODE_ENV:"production",SEMSE_STORAGE_ROOT:"/data/semse-storage"},
  ];
  for(const env of cases) assert.throws(()=>assertProductionStorageConfiguration(env),
    (e:unknown)=>!!e&&typeof e==="object"&&"status" in e&&e.status===503);
});

test("explicit mounted local storage configuration is accepted",()=>{
  assert.doesNotThrow(()=>assertProductionStorageConfiguration({
    NODE_ENV:"production",STORAGE_PROVIDER:"local",SEMSE_STORAGE_ROOT:"/data/semse-storage",
  }));
});

test("mount parser requires exact /data mount, not /data-other, no mount or root fs",()=>{
  assert.equal(hasRailwayDataMount("33 24 0:22 / / rw - overlay overlay rw\n"),false);
  assert.equal(hasRailwayDataMount("33 24 0:22 / /data-other rw - ext4 /dev/x rw\n"),false);
  assert.equal(hasRailwayDataMount("33 24 0:22 / /data rw - ext4 /dev/x rw\n"),true);
  assert.equal(hasRailwayDataMount(""),false);
});

test("production store, plan, URL, stat and hashing never use ephemeral /tmp",async t=>{
  const before={
    NODE_ENV:process.env.NODE_ENV,STORAGE_PROVIDER:process.env.STORAGE_PROVIDER,
    SEMSE_STORAGE_ROOT:process.env.SEMSE_STORAGE_ROOT,
    RAILWAY_ENVIRONMENT:process.env.RAILWAY_ENVIRONMENT,
    RAILWAY_ENVIRONMENT_NAME:process.env.RAILWAY_ENVIRONMENT_NAME,
  };
  const root=await mkdtemp(path.join(os.tmpdir(),"semse-prod-guard-"));
  t.after(async()=>{
    for(const [key,value] of Object.entries(before)){
      if(value===undefined) delete process.env[key]; else process.env[key]=value;
    }
    await rm(root,{recursive:true,force:true});
  });
  process.env.NODE_ENV="production";process.env.STORAGE_PROVIDER="local";
  process.env.SEMSE_STORAGE_ROOT=root;delete process.env.RAILWAY_ENVIRONMENT;
  delete process.env.RAILWAY_ENVIRONMENT_NAME;
  const storage=new StorageService();
  const key="tenants/t1/evidence/wall.jpg";
  const rejected=(e:unknown)=>!!e&&typeof e==="object"&&"status" in e&&e.status===503;
  await assert.rejects(()=>storage.store({key,stream:Readable.from([Buffer.from("abc")]),contentType:"image/jpeg"}),rejected);
  await assert.rejects(()=>storage.putUploadPlan({key,contentType:"image/jpeg"}),rejected);
  await assert.rejects(()=>storage.stat(key),rejected);
  await assert.rejects(()=>storage.hashOriginal(key),rejected);
  assert.throws(()=>storage.publicUrl(key),rejected);
  assert.deepEqual(await readdir(root),[]);
});
