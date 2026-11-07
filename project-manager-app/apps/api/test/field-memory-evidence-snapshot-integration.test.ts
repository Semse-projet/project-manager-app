/**
 * T-008i real PostgreSQL integration in disposable CI only.
 * No Railway URLs, production credentials or customer Evidence allowed.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PrismaClient} from "@prisma/client";
import {readFrozenEvidenceProjection} from "../dist/infrastructure/storage/field-memory-evidence-snapshot.js";
import {StorageWriteGateBlockedError} from "../dist/infrastructure/storage/storage-write-gate-state.js";

const ciDB=(()=>{
 try {
   const u=new URL(process.env.DATABASE_URL??"");
   return process.env.CI==="true" && u.protocol==="postgresql:" &&
     u.hostname==="127.0.0.1" && u.port==="5433" &&
     u.username==="semse" && u.pathname==="/semse";
 } catch { return false; }
})();
const dbTest=ciDB?test:test.skip;
const env={NODE_ENV:"test",SEMSE_STORAGE_WRITE_GATE_MODE:"staging",CI:"true",DATABASE_URL:process.env.DATABASE_URL};
const digest="a".repeat(64);

dbTest("T-008i real PG: frozen audited gate yields snapshot candidate, never backup verification",async()=>{
 const db=new PrismaClient();
 const scope="storage:/tmp/semse-t008-checkpoint-"+randomUUID();
 try {
   await db.storageWriteGate.create({data:{
     scope,phase:"FROZEN",epoch:2n,coverageDigest:digest,
   }});
   await db.storageWriteGateAudit.create({data:{
     id:randomUUID(),scope,epochBefore:2n,epochAfter:2n,
     phaseBefore:"DRAINING",phaseAfter:"FROZEN",action:"MARK_FROZEN",
     actorUserId:"ci-operator",ticket:"ci-checkpoint-test",
   }});
   const result=await readFrozenEvidenceProjection(db as never,{
     scope,expectedEpoch:2n,env:{...env,SEMSE_STORAGE_ROOT:scope.slice("storage:".length)},
   });
   assert.equal(result.databaseTransactionConsistent,true);
   assert.equal(result.phase,"FROZEN");
   assert.equal(result.epoch,"2");
   assert.equal(result.filesystemSnapshotConsistent,false);
   assert.equal(result.captureSessionActivationPermitted,false);
   assert.equal(result.restoreVerified,false);
   assert.ok(["DB_PROJECTION_ONLY","BLOCKED_INCOMPLETE_EVIDENCE"].includes(result.status));
   assert.ok(result.recordCount>=0);
   // Nothing about source IDs/storage keys from ephemeral DB enters CI logs.
   await db.storageWriteOperation.create({data:{
     id:randomUUID(),scope,epoch:2n,
     kind:"EVIDENCE_REGISTER",writerInstanceId:"ci-writer-actor",
     state:"ACTIVE",
   }});
   await assert.rejects(()=>readFrozenEvidenceProjection(db as never,{
     scope,expectedEpoch:2n,env:{...env,SEMSE_STORAGE_ROOT:scope.slice("storage:".length)},
   }),(error:unknown)=>error instanceof StorageWriteGateBlockedError &&
      error.reason==="checkpoint_active_writers");
 } finally {
   await db.storageWriteGateAudit.deleteMany({where:{scope}}).catch(()=>undefined);
   await db.storageWriteOperation.deleteMany({where:{scope}}).catch(()=>undefined);
   await db.storageWriteGate.deleteMany({where:{scope}}).catch(()=>undefined);
   await db.$disconnect();
 }
});

dbTest("T-008i real PG: missing MARK_FROZEN audit prevents any Evidence query",async()=>{
 const db=new PrismaClient();
 const scope="storage:/tmp/semse-t008-no-freeze-"+randomUUID();
 try {
   await db.storageWriteGate.create({data:{
     scope,phase:"FROZEN",epoch:1n,coverageDigest:digest,
   }});
   await assert.rejects(()=>readFrozenEvidenceProjection(db as never,{
     scope,expectedEpoch:1n,env:{...env,SEMSE_STORAGE_ROOT:scope.slice("storage:".length)},
   }),(error:unknown)=>error instanceof StorageWriteGateBlockedError &&
      error.reason==="checkpoint_missing_freeze_audit");
 } finally {
   await db.storageWriteGate.deleteMany({where:{scope}}).catch(()=>undefined);
   await db.$disconnect();
 }
});


dbTest("T-008i real PG: snapshot FOR SHARE fences concurrent THAW row update until release",async()=>{
 const reader=new PrismaClient();
 const operator=new PrismaClient();
 const scope="storage:/tmp/semse-t008-lock-"+randomUUID();
 let releaseSnapshot=()=>{};
 let gateLockAcquired=()=>{};
 const locked=new Promise<void>(resolve=>{gateLockAcquired=resolve;});
 const released=new Promise<void>(resolve=>{releaseSnapshot=resolve;});
 try {
   await reader.storageWriteGate.create({data:{
     scope,phase:"FROZEN",epoch:4n,coverageDigest:digest,
   }});
   await reader.storageWriteGateAudit.create({data:{
     id:randomUUID(),scope,epochBefore:4n,epochAfter:4n,
     phaseBefore:"DRAINING",phaseAfter:"FROZEN",action:"MARK_FROZEN",
     actorUserId:"ci-operator",ticket:"ci-snapshot-lock",
   }});
   const intercepted={
     $transaction:<T>(body:(tx:unknown)=>Promise<T>,options:unknown)=>
       reader.$transaction(async tx=>{
         const wrapped=new Proxy(tx,{
           get(target,key){
             if(key==="$queryRaw"){
               return async (...args:unknown[])=>{
                 const method=tx.$queryRaw as unknown as (...arguments_:unknown[])=>Promise<unknown>;
                 const value=await method.apply(tx,args);
                 const sql=Array.isArray(args[0])?args[0].join(" "):"";
                 if(sql.includes('FROM "StorageWriteGate"') && sql.includes("FOR SHARE")){
                   gateLockAcquired();
                   await released; // Keep the real PostgreSQL transaction open.
                 }
                 return value;
               };
             }
             return Reflect.get(target,key);
           },
         });
         return body(wrapped);
       },options as never),
   };
   const pending=readFrozenEvidenceProjection(intercepted as never,{
     scope,expectedEpoch:4n,
     env:{...env,SEMSE_STORAGE_ROOT:scope.slice("storage:".length)},
   });
   try {
     await Promise.race([locked,new Promise((_,reject)=>setTimeout(()=>reject(Error("reader lock timeout")),10000))]);
     // A transition must acquire FOR UPDATE on the SAME gate row. The actual
     // PostgreSQL lock must prevent this writer from obtaining it.
     await assert.rejects(()=>operator.$transaction(async tx=>{
       await tx.$executeRaw`SET LOCAL lock_timeout = '350ms'`;
       await tx.$queryRaw`SELECT "epoch" FROM "StorageWriteGate"
         WHERE "scope" = ${scope} FOR UPDATE`;
     },{timeout:3000}));
     assert.equal((await operator.storageWriteGate.findUniqueOrThrow({where:{scope}})).phase,"FROZEN");
   } finally {
     releaseSnapshot();
   }
   const projection=await pending;
   assert.equal(projection.databaseTransactionConsistent,true);
   assert.equal(projection.filesystemSnapshotConsistent,false);
   // The lock is released after the projection has committed.
   await operator.$transaction(async tx=>{
     await tx.$queryRaw`SELECT "epoch" FROM "StorageWriteGate"
       WHERE "scope" = ${scope} FOR UPDATE`;
   },{timeout:3000});
 } finally {
   releaseSnapshot();
   await reader.storageWriteGateAudit.deleteMany({where:{scope}}).catch(()=>undefined);
   await reader.storageWriteOperation.deleteMany({where:{scope}}).catch(()=>undefined);
   await reader.storageWriteGate.deleteMany({where:{scope}}).catch(()=>undefined);
   await Promise.all([reader.$disconnect(),operator.$disconnect()]);
 }
});
