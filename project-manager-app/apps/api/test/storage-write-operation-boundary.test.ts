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

test("failed settlement does not claim success or mark clean", async () => {
  let settled = 0;
  const boundary = new StorageWriteOperationBoundary({
    admitWrite: async () => ({id:"ticket",...sample,epoch:1n}),
    assertActive: async () => {},
    settleWrite: async () => { settled++; throw Error("database failure during settle"); },
  } as never);
  await assert.rejects(() => boundary.run({...sample, work: async () => "bytes-published"}),/database failure/);
  assert.equal(settled, 1);
});

test("boundary not provided in runtime Nest StorageModule", () => {
  const mod = readFileSync(new URL("../src/infrastructure/storage/storage.module.ts",import.meta.url),"utf8");
  assert.doesNotMatch(mod, /StorageWriteOperationBoundary/);
});
