/**
 * T-008: two real Node processes, separate Prisma connections, shared synthetic
 * filesystem. Run ONLY in GitHub Actions against disposable 127.0.0.1:5433.
 * This is a CI multi-process rehearsal, NOT a Railway staging/production freeze.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { fork, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { StorageWriteGateControlService } from "../dist/infrastructure/storage/storage-write-gate-control.service.js";
import { StorageWriteGateCoordinator } from "../dist/infrastructure/storage/storage-write-gate-coordinator.js";
import { StorageWriteGateTransitionService } from "../dist/infrastructure/storage/storage-write-gate-transition.service.js";
import { StorageWriteGateBlockedError } from "../dist/infrastructure/storage/storage-write-gate-state.js";

const ciDatabaseOnly = (() => {
  try {
    const db = new URL(process.env.DATABASE_URL ?? "");
    return process.env.CI === "true" &&
      db.protocol === "postgresql:" && db.hostname === "127.0.0.1" &&
      db.port === "5433" && db.pathname === "/semse" && db.username === "semse";
  } catch { return false; }
})();
const dbTest = ciDatabaseOnly ? test : test.skip;
const childScript = fileURLToPath(new URL("./fixtures/storage-write-gate-process.mjs", import.meta.url));
const key = (suffix: string) => "tenants/ci-tenant/public-intake/evidence/t008-" + suffix + ".txt";
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const isBlocked = (reason: string) => (error: unknown) =>
  error instanceof StorageWriteGateBlockedError && error.reason === reason;

type ChildMessage = {type: "paused" | "stored" | "rejected"; pid?: number; status?: number; key?: string};
function message(child: ChildProcess, expected: ChildMessage["type"]): Promise<ChildMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error("Timed out awaiting child " + expected)), 20000);
    function onMessage(data: ChildMessage) {
      if (data?.type !== expected) return finish(new Error("Unexpected child message " + JSON.stringify(data)));
      finish(null, data);
    }
    function onExit(code: number | null, signal: NodeJS.Signals | null) {
      finish(new Error("Child exited before " + expected + ": " + code + "/" + signal));
    }
    function finish(error: Error | null, data?: ChildMessage) {
      clearTimeout(timeout);
      child.off("message", onMessage);
      child.off("exit", onExit);
      if (error) reject(error);
      else resolve(data!);
    }
    child.on("message", onMessage);
    child.once("exit", onExit);
  });
}

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "semse-t008-process-"));
  const scope = "storage:" + root.replaceAll("\\", "/");
  const previous = Object.fromEntries([
    "SEMSE_STORAGE_ROOT", "SEMSE_STORAGE_WRITE_GATE_MODE", "NODE_ENV",
    "RAILWAY_ENVIRONMENT", "RAILWAY_ENVIRONMENT_NAME",
  ].map(k => [k, process.env[k]]));
  process.env.SEMSE_STORAGE_ROOT = root;
  process.env.SEMSE_STORAGE_WRITE_GATE_MODE = "staging";
  process.env.NODE_ENV = "test";
  delete process.env.RAILWAY_ENVIRONMENT;
  delete process.env.RAILWAY_ENVIRONMENT_NAME;

  const db = new PrismaClient();
  const coordinator = new StorageWriteGateCoordinator(db as never);
  const transitions = new StorageWriteGateTransitionService(db as never);
  const control = new StorageWriteGateControlService(db as never, coordinator, transitions);
  const token = randomUUID();
  const children: ChildProcess[] = [];
  const meta = (operation: string) => ({
    actorUserId: "ci-ops-synthetic", ticket: "T008-" + operation + "-" + token,
    reason: "synthetic multi-process CI verification only",
    idempotencyKey: "idem-" + operation + "-" + token,
  });

  function launch(mode: "slow" | "quick", filename: string): ChildProcess {
    const env = {...process.env,
      CI:"true", NODE_ENV:"test", SEMSE_STORAGE_ROOT:root,
      SEMSE_STORAGE_WRITE_GATE_MODE:"staging",
      T008_WORKER_MODE:mode, T008_WORKER_KEY:filename,
    };
    delete env.RAILWAY_ENVIRONMENT;
    delete env.RAILWAY_ENVIRONMENT_NAME;
    const child = fork(childScript, [], {
      env, execArgv: [], stdio:["ignore","pipe","pipe","ipc"],
    });
    children.push(child);
    return child;
  }

  async function cleanup() {
    for(const child of children) if(child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await db.storageWriteGateAudit.deleteMany({where:{scope}}).catch(() => undefined);
    await db.storageWriteOperation.deleteMany({where:{scope}}).catch(() => undefined);
    await db.storageWriteGate.deleteMany({where:{scope}}).catch(() => undefined);
    await db.$disconnect();
    await rm(root,{recursive:true,force:true});
    for(const [k,v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
  return {root,scope,db,coordinator,control,meta,launch,cleanup,token};
}

dbTest("T-008 two processes: drain blocks new writes, waits active, freezes and thaws", async () => {
  const f = await fixture();
  try {
    await f.control.provision(f.meta("provision"));
    const originalKey = key("slow-" + f.token);
    const childA = f.launch("slow",originalKey);
    const paused = await message(childA,"paused");
    assert.ok(paused.pid && paused.pid !== process.pid);
    assert.equal(await f.db.storageWriteOperation.count({where:{scope:f.scope,state:"ACTIVE"}}),1);

    await f.control.transition({...f.meta("drain"),expectedEpoch:1n,action:"BEGIN_DRAIN"});
    await f.control.attestCoverage({
      ...f.meta("coverage"),expectedEpoch:1n,
      coverageDigest:digest({scope:f.scope,syntheticOnly:true,pids:[paused.pid]}),
    });
    await assert.rejects(
      () => f.control.transition({...f.meta("earlyfreeze"),expectedEpoch:1n,action:"MARK_FROZEN"}),
      isBlocked("active_operations"),
    );
    const finished = message(childA,"stored");
    childA.send({type:"resume"});
    assert.equal((await finished).key,originalKey);
    const bytes = await readFile(path.join(f.root, originalKey));
    assert.equal(bytes.toString(),"synthetic-before-after");
    assert.equal(await f.db.storageWriteOperation.count({where:{scope:f.scope,state:"ACTIVE"}}),0);

    await f.control.transition({...f.meta("freeze"),expectedEpoch:1n,action:"MARK_FROZEN"});
    const childB = f.launch("quick",key("blocked-" + f.token));
    const blocked = await message(childB,"rejected");
    assert.equal(blocked.status,503);
    await assert.rejects(() => stat(path.join(f.root,key("blocked-" + f.token))),{code:"ENOENT"});
    assert.deepEqual(await readFile(path.join(f.root,originalKey)),bytes);

    await f.control.attestWindowClosed({
      ...f.meta("window"),expectedEpoch:1n,
      windowEvidenceDigest:digest({sha256:createHash("sha256").update(bytes).digest("hex"),syntheticOnly:true}),
    });
    assert.deepEqual(await f.control.transition({
      ...f.meta("thaw"),expectedEpoch:1n,action:"THAW",
    }),{phase:"OPEN",epoch:"2"});

    const childC = f.launch("quick",key("after-thaw-" + f.token));
    const stored = await message(childC,"stored");
    assert.equal(stored.key,key("after-thaw-" + f.token));
    assert.equal(await f.db.storageWriteGateAudit.count({where:{scope:f.scope,action:"MARK_FROZEN"}}),1);
  } finally {
    await f.cleanup();
  }
});

dbTest("T-008 crashed process: ticket survives SIGKILL and blocks FROZEN until fenced", async () => {
  const f = await fixture();
  try {
    await f.control.provision(f.meta("provision"));
    const deadKey = key("crash-" + f.token);
    const child = f.launch("slow",deadKey);
    const paused = await message(child,"paused");
    const active = await f.db.storageWriteOperation.findFirstOrThrow({where:{scope:f.scope,state:"ACTIVE"}});
    const exited = new Promise<{code:number|null;signal:NodeJS.Signals|null}>(resolve=>{
      child.once("exit",(code,signal)=>resolve({code,signal}));
    });
    assert.equal(child.kill("SIGKILL"),true);
    const exit = await exited;
    assert.equal(exit.signal,"SIGKILL");
    // In this disposable test we observed the actual OS process terminate,
    // unlike production where a timestamp alone never proves fencing.
    await f.control.transition({...f.meta("drain"),expectedEpoch:1n,action:"BEGIN_DRAIN"});
    await f.control.attestCoverage({
      ...f.meta("coverage"),expectedEpoch:1n,
      coverageDigest:digest({syntheticOnly:true,killedPid:paused.pid,scope:f.scope}),
    });
    await assert.rejects(
      () => f.control.transition({...f.meta("freeze-too-soon"),expectedEpoch:1n,action:"MARK_FROZEN"}),
      isBlocked("active_operations"),
    );
    const recovered = await f.control.recoverOperation({
      ...f.meta("fence"),expectedEpoch:1n,operationId:active.id,
      writerInstanceId:active.writerInstanceId,
      terminationEvidenceDigest:digest({syntheticOnly:true,pid:paused.pid,signal:exit.signal,operationId:active.id}),
    });
    assert.equal(recovered.state,"RECOVERED_FENCED");
    await f.control.transition({...f.meta("freeze"),expectedEpoch:1n,action:"MARK_FROZEN"});
    await assert.rejects(()=>stat(path.join(f.root,deadKey)),{code:"ENOENT"});
    assert.equal((await f.db.storageWriteOperation.findUniqueOrThrow({where:{id:active.id}})).state,"RECOVERED_FENCED");
  } finally {
    await f.cleanup();
  }
});
