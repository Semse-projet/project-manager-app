import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { WorkerVerificationService } from "../dist/modules/worker-verification/worker-verification.service.js";

// C11 — precondiciones de atestacion de identidad: el estado es durable
// (User.verificationStatus), solo el propio trabajador u OPS_ADMIN atesta, y
// nunca se degrada un estado verified/suspended desde este flujo.

type Row = { id: string; verificationStatus: string };

/** "DB" compartida: dos instancias del servicio (replicas/reinicios) la ven igual. */
function makeDb(initial: Record<string, string> = { w1: "unverified" }, opts: { cryptoValid?: boolean } = {}) {
  const rows = new Map<string, Row>(Object.entries(initial).map(([id, verificationStatus]) => [id, { id, verificationStatus }]));
  const log: string[] = [];
  const repository = {
    async getWorkerInTenant(id: string, tenantId: string) {
      return tenantId === "t1" ? rows.get(id) ?? null : null;
    },
    async markPendingIfUnverified(id: string) {
      const r = rows.get(id);
      if (r && r.verificationStatus === "unverified") { r.verificationStatus = "pending"; return true; }
      return false;
    },
    async markVerified(id: string) {
      const r = rows.get(id);
      if (r && ["unverified", "pending"].includes(r.verificationStatus)) { r.verificationStatus = "verified"; return true; }
      return false;
    },
    async storeDidSignature() { log.push("store"); },
    async createVerificationLog() { log.push("log"); },
    async verifyDidSignature() { return opts.cryptoValid === true; },
  };
  const make = () => new WorkerVerificationService(repository as never);
  return { rows, log, make };
}
const self = { userId: "w1", roles: ["WORKER"] };

test("el estado sobrevive a un 'reinicio': otra instancia del servicio ve lo mismo (no hay Map en memoria)", async () => {
  const { make } = makeDb();
  const a = make();
  const started = await a.initiateVerification({ workerId: "w1", tenantId: "t1", actor: self, verificationType: "DID_SIGNATURE" });
  assert.equal(started.status, "pending");
  const b = make(); // replica / reinicio
  assert.equal((await b.getVerificationStatus("w1", "t1")).status, "pending");
});

test("iniciar persiste 'pending' solo desde 'unverified' y NUNCA degrada verified ni suspended", async () => {
  const { rows, make } = makeDb({ w1: "unverified", wv: "verified", ws: "suspended" });
  const svc = make();
  await svc.initiateVerification({ workerId: "w1", tenantId: "t1", actor: self, verificationType: "DID_SIGNATURE" });
  assert.equal(rows.get("w1")!.verificationStatus, "pending");
  await svc.initiateVerification({ workerId: "wv", tenantId: "t1", actor: { userId: "wv", roles: [] }, verificationType: "DID_SIGNATURE" });
  await svc.initiateVerification({ workerId: "ws", tenantId: "t1", actor: { userId: "ws", roles: [] }, verificationType: "DID_SIGNATURE" });
  assert.equal(rows.get("wv")!.verificationStatus, "verified");
  assert.equal(rows.get("ws")!.verificationStatus, "suspended");
});

test("precondicion: solo el propio trabajador u OPS_ADMIN atesta; otro worker:write del tenant => 403 y nada se persiste", async () => {
  const { rows, log, make } = makeDb();
  const svc = make();
  const other = { userId: "w2", roles: ["WORKER", "CLIENT"] };
  await assert.rejects(svc.initiateVerification({ workerId: "w1", tenantId: "t1", actor: other, verificationType: "DID_SIGNATURE" }), ForbiddenException);
  await assert.rejects(svc.submitDidSignature("w1", "t1", "sig", "pub", other), ForbiddenException);
  await assert.rejects(svc.submitDidSignature("w1", "t1", "sig", "pub", undefined), ForbiddenException, "sin actor => fail closed");
  assert.equal(rows.get("w1")!.verificationStatus, "unverified");
  assert.deepEqual(log, []);
  // OPS_ADMIN y el propio trabajador sí pueden
  await svc.initiateVerification({ workerId: "w1", tenantId: "t1", actor: { userId: "ops", roles: ["OPS_ADMIN"] }, verificationType: "DID_SIGNATURE" });
  assert.equal(rows.get("w1")!.verificationStatus, "pending");
});

test("firma que NO valida (hoy la criptografia DID falla cerrado): failed transitorio, nada se marca verified ni se degrada", async () => {
  const { rows, make } = makeDb({ w1: "pending" });
  const state = await make().submitDidSignature("w1", "t1", "sig", "pub", self);
  assert.equal(state.status, "failed");
  assert.equal(rows.get("w1")!.verificationStatus, "pending");
  assert.equal(state.didSignature, undefined, "no se devuelve la firma");
});

test("firma valida (cuando exista criptografia real): se PERSISTE verified y otra instancia lo ve", async () => {
  const { rows, log, make } = makeDb({ w1: "pending" }, { cryptoValid: true });
  const state = await make().submitDidSignature("w1", "t1", "sig", "pub", self);
  assert.equal(state.status, "verified");
  assert.equal(rows.get("w1")!.verificationStatus, "verified");
  assert.ok(log.includes("log"));
  assert.equal((await make().getVerificationStatus("w1", "t1")).status, "verified");
});

test("un trabajador suspendido no se re-verifica por este flujo, aunque la firma fuese valida", async () => {
  const { rows, log, make } = makeDb({ w1: "suspended" }, { cryptoValid: true });
  const state = await make().submitDidSignature("w1", "t1", "sig", "pub", self);
  assert.equal(state.status, "failed");
  assert.equal(rows.get("w1")!.verificationStatus, "suspended");
  assert.deepEqual(log, [], "ni siquiera se almacena la firma");
});

test("status deriva de la fuente durable: unverified|pending => pending, verified => verified, suspended => failed", async () => {
  const { make } = makeDb({ a: "unverified", b: "pending", c: "verified", d: "suspended" });
  const svc = make();
  assert.equal((await svc.getVerificationStatus("a", "t1")).status, "pending");
  assert.equal((await svc.getVerificationStatus("b", "t1")).status, "pending");
  assert.equal((await svc.getVerificationStatus("c", "t1")).status, "verified");
  const d = await svc.getVerificationStatus("d", "t1");
  assert.equal(d.status, "failed");
  assert.match(String(d.feedback), /suspended/);
});
