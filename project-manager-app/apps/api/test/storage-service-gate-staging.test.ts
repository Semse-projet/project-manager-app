import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { StorageService } from "../dist/infrastructure/storage/storage.service.js";
import { StorageWriteGateBlockedError } from "../dist/infrastructure/storage/storage-write-gate-state.js";

const KEY = "tenants/tenantA/public-intake/evidence/gate-synthetic.txt";
const vars = ["SEMSE_STORAGE_ROOT", "SEMSE_STORAGE_WRITE_GATE_MODE", "NODE_ENV", "STORAGE_PROVIDER", "RAILWAY_ENVIRONMENT", "RAILWAY_ENVIRONMENT_NAME"];

async function isolated(t: import("node:test").TestContext, mode = "staging") {
  const original = Object.fromEntries(vars.map(k => [k, process.env[k]]));
  const root = await mkdtemp(path.join(tmpdir(), "semse-staging-gate-"));
  process.env.SEMSE_STORAGE_ROOT = root;
  process.env.SEMSE_STORAGE_WRITE_GATE_MODE = mode;
  process.env.NODE_ENV = "test";
  process.env.STORAGE_PROVIDER = "local";
  delete process.env.RAILWAY_ENVIRONMENT;
  delete process.env.RAILWAY_ENVIRONMENT_NAME;
  t.after(async () => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(root, {recursive:true,force:true});
  });
  return root;
}

function fakeBoundary() {
  const calls: string[] = [];
  let state = "OPEN";
  let breakSettlement = false;
  const gate = {
    async assertPlanOpen(scope: string) {
      calls.push("plan:"+scope);
      if (state !== "OPEN") throw new StorageWriteGateBlockedError("not_open");
    },
    async beforePublish() {
      calls.push("publish-check");
      // A ticket admitted in OPEN is allowed to finish while the gate drains.
      // FROZEN with an ACTIVE ticket is contradictory and must fail closed.
      if (state === "FROZEN") throw new StorageWriteGateBlockedError("inconsistent_frozen_snapshot");
    },
    async run(input: {
      scope:string;
      kind:string;
      work:(ticket: {
        id:string;scope:string;epoch:bigint;writerInstanceId:string;kind:any;
      })=>Promise<unknown>;
      proveCleanFailure?: (ticket: unknown, cause: unknown)=>Promise<void>;
    }) {
      calls.push("admit:"+input.kind);
      if (state !== "OPEN") throw new StorageWriteGateBlockedError("not_open");
      const ticket = {
        id:"b78c25ea-d9ac-42cc-99d2-e309241959e0",
        scope:input.scope,
        epoch:1n,
        writerInstanceId:"api-test",
        kind:input.kind,
      };
      try {
        const result = await input.work(ticket);
        if (breakSettlement) throw Error("settlement failed");
        calls.push("settle:"+input.kind);
        return result;
      } catch (cause) {
        if (input.proveCleanFailure) {
          await input.proveCleanFailure(ticket,cause);
          calls.push("settle-clean:"+input.kind);
        }
        throw cause;
      }
    },
  };
  return {gate, calls, setPhase(value: string){state=value;}, failSettlement(){breakSettlement=true;}};
}

test("staging: plan, store, and delete pass through ticket boundary", async t => {
  const root = await isolated(t);
  const boundary = fakeBoundary();
  const storage = new StorageService(boundary.gate as never);
  const plan = await storage.putUploadPlan({key:KEY,contentType:"text/plain"});
  assert.equal(plan.key,KEY);
  assert.ok(boundary.calls.some(s => s.startsWith("plan:storage:")));
  const payload = Buffer.from("synthetic-evidence-bytes");
  const stored = await storage.store({key:KEY,stream:Readable.from([payload]),contentType:"text/plain"});
  assert.equal(stored.sizeBytes,payload.length);
  assert.deepEqual(await readFile(path.join(root,KEY)),payload);
  await storage.delete(KEY);
  assert.equal((await storage.stat(KEY)).exists,false);
  assert.deepEqual(boundary.calls.filter(s=>s.startsWith("admit:")), ["admit:ORIGINAL_STORE","admit:ORIGINAL_DELETE"]);
  assert.equal(boundary.calls.filter(s=>s==="publish-check").length,2);
  assert.equal(boundary.calls.filter(s=>s.startsWith("settle:")).length,2);
});

test("staging: DRAINING refuses plans and bytes before file mutation", async t => {
  const root = await isolated(t);
  const boundary = fakeBoundary();
  boundary.setPhase("DRAINING");
  const storage = new StorageService(boundary.gate as never);
  await assert.rejects(
    ()=>storage.putUploadPlan({key:KEY,contentType:"text/plain"}),
    e=>(e as {status?:number;retryAfterSeconds?:number}).status===503 &&
      (e as {retryAfterSeconds?:number}).retryAfterSeconds===5,
  );
  await assert.rejects(()=>storage.store({key:KEY,stream:Readable.from(["bytes"]),contentType:"text/plain"}),e=>(e as {status?:number}).status===503);
  await assert.rejects(()=>stat(path.join(root,KEY)),{code:"ENOENT"});
});

test("staging: outer admitted ticket survives DRAINING and nested store reuses it", async t => {
  const root = await isolated(t);
  const boundary = fakeBoundary();
  const storage = new StorageService(boundary.gate as never);
  const payload = Buffer.from("nested-ticket-bytes");

  const stored = await storage.withWriteGateMutation("MULTIPART_COMPLETE", async () => {
    boundary.setPhase("DRAINING");
    return storage.store({key:KEY,stream:Readable.from([payload]),contentType:"text/plain"});
  });

  assert.equal(stored.sizeBytes,payload.length);
  assert.deepEqual(await readFile(path.join(root,KEY)),payload);
  assert.deepEqual(
    boundary.calls.filter(s=>s.startsWith("admit:")),
    ["admit:MULTIPART_COMPLETE"],
    "nested store must not attempt a second admission during DRAINING",
  );
  assert.deepEqual(
    boundary.calls.filter(s=>s.startsWith("settle:")),
    ["settle:MULTIPART_COMPLETE"],
  );
});

test("staging: DB settlement failure does not delete a published original",async t=>{
  const root = await isolated(t);
  const boundary = fakeBoundary();
  boundary.failSettlement();
  const storage = new StorageService(boundary.gate as never);
  await assert.rejects(()=>storage.store({key:KEY,stream:Readable.from(["keep-me"]),contentType:"text/plain"}),e=>(e as {status?:number}).status===503);
  assert.equal((await readFile(path.join(root,KEY))).toString(),"keep-me");
});

test("staging: missing provider fails closed, including plan and deletion",async t=>{
  await isolated(t);
  const storage = new StorageService();
  await assert.rejects(()=>storage.putUploadPlan({key:KEY,contentType:"text/plain"}),e=>(e as {status?:number}).status===503);
  await assert.rejects(()=>storage.store({key:KEY,stream:Readable.from(["x"]),contentType:"text/plain"}),e=>(e as {status?:number}).status===503);
  await assert.rejects(()=>storage.delete(KEY),e=>(e as {status?:number}).status===503);
});

test("production refuses staging gate instead of claiming partial enforcement",async t=>{
  await isolated(t);
  process.env.NODE_ENV = "production";
  const storage = new StorageService(fakeBoundary().gate as never);
  await assert.rejects(()=>storage.store({key:KEY,stream:Readable.from(["x"]),contentType:"text/plain"}),e=>(e as {status?:number}).status===503);
});

test("Railway production marker rejects partial staging enforcement even with NODE_ENV=test",async t=>{
  await isolated(t);
  process.env.RAILWAY_ENVIRONMENT = "production";
  const storage = new StorageService(fakeBoundary().gate as never);
  await assert.rejects(()=>storage.putUploadPlan({key:KEY,contentType:"text/plain"}),e=>(e as {status?:number}).status===503);
  await assert.rejects(()=>storage.store({key:KEY,stream:Readable.from(["x"]),contentType:"text/plain"}),e=>(e as {status?:number}).status===503);
});

test("off retains legacy file behavior and only ENOENT deletion is ignored",async t=>{
  const root = await isolated(t,"off");
  const storage = new StorageService();
  await storage.store({key:KEY,stream:Readable.from(["old-compatible"]),contentType:"text/plain"});
  await storage.delete(KEY);
  await storage.delete(KEY);
  const directory = path.join(root,"tenants","tenantA","public-intake","evidence","directory");
  await mkdir(directory,{recursive:true});
  await assert.rejects(()=>storage.delete("tenants/tenantA/public-intake/evidence/directory"));
});
