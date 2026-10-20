import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { StorageWriteOperationBoundary } from "../dist/infrastructure/storage/storage-write-operation-boundary.js";

const sample = { scope: "test:/synthetic-storage", writerInstanceId: "test-writer-001", kind: "ORIGINAL_STORE" };
function fake() {
  const calls: string[] = [];
  let state = "ACTIVE";
  const ticket = { id:"9bac7a5f-86d9-40e2-812f-f9283b8a1c52", ...sample, epoch: 1n };
  const coordinator = {
    async admitWrite() { calls.push("admit"); return ticket; },
    async assertActive() { calls.push("assert"); if (state !== "ACTIVE") throw Error("inactive"); },
    async settleWrite(_ticket: unknown, result: string) {
      calls.push("settle:" + result);
      if (state !== "ACTIVE") throw Error("already settled");
      state = result;
    },
  };
  return { boundary: new StorageWriteOperationBoundary(coordinator as never), calls, get state(){ return state; } };
}

test("complete original + metadata before releasing ACTIVE ticket", async () => {
  const f = fake();
  const result = await f.boundary.run({...sample, work: async ticket => {
    await f.boundary.beforePublish(ticket);
    f.calls.push("link-and-evidence");
    return "stored";
  }});
  assert.equal(result, "stored");
  assert.deepEqual(f.calls, ["admit","assert","assert","link-and-evidence","settle:COMPLETED"]);
  assert.equal(f.state, "COMPLETED");
});

test("ambiguous failure leaves ticket ACTIVE; cannot certify FROZEN", async () => {
  const f = fake();
  await assert.rejects(() => f.boundary.run({...sample, work: async () => {
    f.calls.push("link-published");
    throw Error("Evidence DB unavailable");
  }}), /Evidence DB unavailable/);
  assert.equal(f.state, "ACTIVE");
  assert.deepEqual(f.calls, ["admit","assert","link-published"]);
});

test("failed clean proof leaves ACTIVE; no unsafe release", async () => {
  const f = fake();
  await assert.rejects(() => f.boundary.run({...sample,
    work: async () => { throw Error("upload interrupted"); },
    proveCleanFailure: async () => { throw Error("staging cannot be confirmed clean"); },
  }), /upload interrupted/);
  assert.equal(f.state, "ACTIVE");
});

test("proven clean failure settles FAILED_CLEAN", async () => {
  const f = fake();
  await assert.rejects(() => f.boundary.run({...sample,
    work: async () => { throw Error("pre-publication validation rejected"); },
    proveCleanFailure: async () => { f.calls.push("confirmed-no-bytes-and-no-metadata"); },
  }), /pre-publication validation rejected/);
  assert.deepEqual(f.calls, ["admit","assert","confirmed-no-bytes-and-no-metadata","settle:FAILED_CLEAN"]);
  assert.equal(f.state, "FAILED_CLEAN");
});

test("failed settlement does not invoke cleanup of an already published original", async () => {
  let settled = 0;
  let cleaned = 0;
  const boundary = new StorageWriteOperationBoundary({
    admitWrite: async () => ({id:"ticket",...sample,epoch:1n}),
    assertActive: async () => {},
    settleWrite: async () => { settled++; throw Error("database failure during settle"); },
  } as never);
  await assert.rejects(() => boundary.run({
    ...sample,
    work: async () => "bytes-published",
    proveCleanFailure: async () => { cleaned++; throw Error("published file MUST NOT be removed"); },
  }), /database failure/);
  assert.equal(settled, 1);
  assert.equal(cleaned, 0, "cleanup must not run after successful publication");
});

test("boundary and control plane keep production canary and transition authority separate", () => {
  const moduleSource = readFileSync(new URL("../src/infrastructure/storage/storage.module.ts",import.meta.url),"utf8");
  const storageSource = readFileSync(new URL("../src/infrastructure/storage/storage.service.ts",import.meta.url),"utf8");
  const modeSource = readFileSync(new URL("../src/infrastructure/storage/storage-write-gate-mode.ts",import.meta.url),"utf8");
  const controlSource = readFileSync(new URL("../src/infrastructure/storage/storage-write-gate-control.service.ts",import.meta.url),"utf8");
  assert.match(moduleSource, /StorageWriteOperationBoundary/);
  assert.match(moduleSource, /StorageWriteGateCoordinator/);
  assert.match(moduleSource, /StorageWriteGateTransitionService/);
  assert.match(moduleSource, /StorageWriteGateControlService/);
  assert.match(moduleSource, /StorageWriteGateControlController/);
  assert.match(storageSource, /storageWriteGateRuntimeEnabled/);
  assert.match(storageSource, /private configuredBoundary\(/);
  assert.match(modeSource, /SEMSE_STORAGE_WRITE_GATE_MODE/);
  assert.match(modeSource, /SEMSE_STORAGE_WRITE_GATE_PRODUCTION_CONTROL_MODE/);
  assert.match(modeSource, /mode === "staging"/);
  assert.match(modeSource, /mode === "production"/);
  assert.match(modeSource, /level === "provision"/);
  assert.match(modeSource, /Production storage write gate control is not armed/);
  assert.match(controlSource, /assertControlPlane\("observe"\)/);
  assert.match(controlSource, /assertControlPlane\("provision"\)/);
  assert.match(controlSource, /assertControlPlane\("mutate"\)/);
});
