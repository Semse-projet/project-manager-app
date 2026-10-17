import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { StorageService } from "../dist/infrastructure/storage/storage.service.js";

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
  const ticket = {id:"1234",scope:"storage:/synthetic",epoch:1n,writerInstanceId:"api-test",kind:"ORIGINAL_STORE" as const};
  const gate = {
    async assertPlanOpen(scope: string) {
      calls.push("plan:"+scope);
      if (state !== "OPEN") throw Error("not open");
    },
    async beforePublish() {
      calls.push("publish-check");
      if (state !== "OPEN") throw Error("not open");
    },
    async run(input: {kind:string;work:(ticket: typeof ticket)=>Promise<unknown>}) {
      calls.push("admit:"+input.kind);
      if (state !== "OPEN") throw Error("not open");
      const result = await input.work(ticket);
      if (breakSettlement) throw Error("settlement failed");
      calls.push("settle:"+input.kind);
      return result;
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
  await assert.rejects(()=>storage.putUploadPlan({key:KEY,contentType:"text/plain"}),e=>(e as {status?:number}).status===503);
  await assert.rejects(()=>storage.store({key:KEY,stream:Readable.from(["bytes"]),contentType:"text/plain"}),e=>(e as {status?:number}).status===503);
  await assert.rejects(()=>stat(path.join(root,KEY)),{code:"ENOENT"});
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
