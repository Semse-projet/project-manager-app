/**
 * S3a: PostgreSQL + real synthetic filesystem integration in ephemeral CI.
 * NEVER targets Railway or user originals. FROZEN here certifies only this
 * disposable writer; it is NOT evidence of global production quiescence.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { PrismaClient } from "@prisma/client";
import { StorageWriteGateCoordinator } from "../dist/infrastructure/storage/storage-write-gate-coordinator.js";
import { StorageWriteGateTransitionService } from "../dist/infrastructure/storage/storage-write-gate-transition.service.js";
import { StorageWriteOperationBoundary } from "../dist/infrastructure/storage/storage-write-operation-boundary.js";
import { StorageService } from "../dist/infrastructure/storage/storage.service.js";

const ciDb = (() => {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return process.env.CI === "true" && u.protocol === "postgresql:" &&
      u.hostname === "127.0.0.1" && u.port === "5433" &&
      u.pathname === "/semse" && u.username === "semse";
  } catch { return false; }
})();
const dbTest = ciDb ? test : test.skip;
const KEY = "tenants/ci-tenant/public-intake/evidence/synthetic.txt";
const vars = [
  "SEMSE_STORAGE_ROOT","SEMSE_STORAGE_WRITE_GATE_MODE","NODE_ENV",
  "STORAGE_PROVIDER","RAILWAY_ENVIRONMENT","RAILWAY_ENVIRONMENT_NAME",
];

dbTest("S3a: real DB/FS ticket lifecycle blocks store/delete under DRAINING/FROZEN", async () => {
  const prev = Object.fromEntries(vars.map(v => [v,process.env[v]]));
  const root = await mkdtemp(path.join(tmpdir(),"semse-pg-gated-fs-"));
  const prisma = new PrismaClient();
  const scope = "storage:" + root.replaceAll("\\","/");
  const token = "t008-" + randomUUID();
  process.env.SEMSE_STORAGE_ROOT = root;
  process.env.SEMSE_STORAGE_WRITE_GATE_MODE = "staging";
  process.env.NODE_ENV = "test";
  process.env.STORAGE_PROVIDER = "local";
  delete process.env.RAILWAY_ENVIRONMENT;
  delete process.env.RAILWAY_ENVIRONMENT_NAME;

  try {
    await prisma.storageWriteGate.create({data:{
      scope,phase:"OPEN",epoch:1n,coverageDigest:"synthetic-single-process-only",
    }});
    const coordinator = new StorageWriteGateCoordinator(prisma as never);
    const control = new StorageWriteGateTransitionService(prisma as never);
    const storage = new StorageService(new StorageWriteOperationBoundary(coordinator));
    const operator = (auditTicket: string) => ({
      actorUserId:"ci-test-operator",
      actorAuthorized:true,auditTicket,recoveryWindowClosed:true,
    });

    const bytes = Buffer.from("isolated-original-" + token);
    await storage.putUploadPlan({key:KEY,contentType:"text/plain"});
    const uploaded = await storage.store({key:KEY,contentType:"text/plain",stream:Readable.from([bytes])});
    assert.equal(uploaded.sizeBytes,bytes.length);
    assert.deepEqual(await readFile(path.join(root,KEY)),bytes);
    assert.equal(await prisma.storageWriteOperation.count({where:{scope,state:"ACTIVE"}}),0);
    assert.equal(await prisma.storageWriteOperation.count({where:{scope,state:"COMPLETED"}}),1);

    assert.deepEqual(await control.transition({
      scope,expectedEpoch:1n,action:"BEGIN_DRAIN",authority:operator("ci-drain-"+token),
    }),{phase:"DRAINING",epoch:1n});
    await assert.rejects(
      () => storage.store({key:KEY+".new",contentType:"text/plain",stream:Readable.from(["new"])}),
      error => (error as {status?:number}).status === 503,
    );
    await assert.rejects(
      () => storage.delete(KEY),
      error => (error as {status?:number}).status === 503,
    );
    assert.deepEqual(await readFile(path.join(root,KEY)),bytes);

    assert.deepEqual(await control.transition({
      scope,expectedEpoch:1n,action:"MARK_FROZEN",authority:operator("ci-freeze-"+token),
    }),{phase:"FROZEN",epoch:1n});
    await assert.rejects(
      () => storage.putUploadPlan({key:KEY+".next",contentType:"text/plain"}),
      error => (error as {status?:number}).status === 503,
    );
    assert.equal(await prisma.storageWriteOperation.count({where:{scope,state:"ACTIVE"}}),0);
    assert.deepEqual(await readFile(path.join(root,KEY)),bytes);

    assert.deepEqual(await control.transition({
      scope,expectedEpoch:1n,action:"THAW",authority:operator("ci-thaw-"+token),
    }),{phase:"OPEN",epoch:2n});
    await storage.delete(KEY);
    assert.equal((await storage.stat(KEY)).exists,false);
    assert.equal(await prisma.storageWriteOperation.count({where:{scope,state:"COMPLETED"}}),2);
    assert.equal(await prisma.storageWriteGateAudit.count({where:{scope}}),3);
  } finally {
    await prisma.storageWriteGateAudit.deleteMany({where:{scope}}).catch(()=>undefined);
    await prisma.storageWriteOperation.deleteMany({where:{scope}}).catch(()=>undefined);
    await prisma.storageWriteGate.deleteMany({where:{scope}}).catch(()=>undefined);
    await prisma.$disconnect();
    await rm(root,{recursive:true,force:true});
    for(const [key,val] of Object.entries(prev)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  }
});
