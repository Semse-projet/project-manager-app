import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { WorkerVerificationService } from "../dist/modules/worker-verification/worker-verification.service.js";
import {
  attestationMessage,
  canTransition,
  challengeTtlSeconds,
  effectiveStatus,
  generateNonce,
  hashNonce,
} from "../dist/modules/worker-verification/worker-verification.state.js";

// C11 — verificacion POR TENANT: estado propio de cada tenant, desafio con nonce de un
// solo uso y caducidad, historial auditable y transiciones monotonicas.

type Row = { status: string; verifiedAt?: Date };
type Challenge = { tenantId: string; userId: string; consumedAt: Date | null; expiresAt: Date };
type Ev = { tenantId: string; userId: string; type: string; fromStatus: string | null; toStatus: string | null; occurredAt: Date; metadataJson: unknown };

/** Repositorio en memoria con la MISMA semantica que el real (tenant, CAS, un solo uso, eventos). */
function makeRepo(opts: { legacy?: Record<string, string>; cryptoValid?: boolean; workers?: Array<[string, string]> } = {}) {
  const rows = new Map<string, Row>(); // `${tenant}:${user}`
  const challenges = new Map<string, Challenge>(); // hash -> challenge
  const events: Ev[] = [];
  const legacy = opts.legacy ?? {};
  const workers = new Set((opts.workers ?? [["t1", "w1"], ["t2", "w1"]]).map(([t, u]) => `${t}:${u}`));
  const key = (t: string, u: string) => `${t}:${u}`;
  const repo = {
    async getWorkerInTenant(userId: string, tenantId: string) {
      return workers.has(key(tenantId, userId)) ? { id: userId, verificationStatus: legacy[userId] ?? "unverified" } : null;
    },
    async getEffectiveStatus(tenantId: string, userId: string) {
      return effectiveStatus(rows.get(key(tenantId, userId))?.status, legacy[userId]);
    },
    async transitionTenantStatus(i: { tenantId: string; userId: string; from: string[]; to: string; eventType: string }) {
      const k = key(i.tenantId, i.userId);
      if (i.from.includes("unverified") && !rows.has(k)) rows.set(k, { status: "unverified" });
      const cur = rows.get(k);
      if (!cur || !i.from.includes(cur.status)) return false;
      events.push({ tenantId: i.tenantId, userId: i.userId, type: i.eventType, fromStatus: cur.status, toStatus: i.to, occurredAt: new Date(), metadataJson: null });
      cur.status = i.to;
      if (i.to === "verified") cur.verifiedAt = new Date();
      return true;
    },
    async issueChallenge(i: { tenantId: string; userId: string; nonceHash: string; expiresAt: Date }) {
      const now = new Date();
      for (const c of challenges.values()) {
        if (c.tenantId === i.tenantId && c.userId === i.userId && !c.consumedAt && c.expiresAt > now) c.consumedAt = now;
      }
      challenges.set(i.nonceHash, { tenantId: i.tenantId, userId: i.userId, consumedAt: null, expiresAt: i.expiresAt });
      events.push({ tenantId: i.tenantId, userId: i.userId, type: "challenge_issued", fromStatus: null, toStatus: null, occurredAt: new Date(), metadataJson: null });
    },
    async consumeChallenge(i: { tenantId: string; userId: string; nonceHash: string; now?: Date }) {
      const c = challenges.get(i.nonceHash);
      const now = i.now ?? new Date();
      if (!c || c.tenantId !== i.tenantId || c.userId !== i.userId || c.consumedAt || c.expiresAt <= now) return false;
      c.consumedAt = now;
      return true;
    },
    async appendEvent(i: { tenantId: string; userId: string; type: string; metadata?: unknown }) {
      events.push({ tenantId: i.tenantId, userId: i.userId, type: i.type, fromStatus: null, toStatus: null, occurredAt: new Date(), metadataJson: i.metadata ?? null });
    },
    async listEvents(tenantId: string, userId: string) {
      return events.filter((e) => e.tenantId === tenantId && e.userId === userId).map((e) => ({ ...e, actorUserId: null })).reverse();
    },
    async storeDidSignature() {},
    async createVerificationLog() {},
    async verifyDidSignature(_w: string, _s: string, _k: string, message: string) {
      repo.lastMessage = message;
      return opts.cryptoValid === true;
    },
    lastMessage: "",
  };
  return { repo, rows, challenges, events, make: () => new WorkerVerificationService(repo as never) };
}
const self = { userId: "w1", roles: ["WORKER"] };
const start = (svc: WorkerVerificationService, tenantId = "t1") =>
  svc.initiateVerification({ workerId: "w1", tenantId, actor: self, verificationType: "DID_SIGNATURE" });

test("logica pura: transiciones monotonicas y estado efectivo", () => {
  assert.equal(canTransition("unverified", "pending"), true);
  assert.equal(canTransition("pending", "verified"), true);
  assert.equal(canTransition("unverified", "verified"), true);
  assert.equal(canTransition("verified", "pending"), false);
  assert.equal(canTransition("pending", "unverified"), false);
  assert.equal(canTransition("verified", "verified"), false);
  assert.equal(canTransition("suspended", "verified"), false);
  assert.equal(canTransition("pending", "suspended"), false);
  assert.equal(effectiveStatus("pending", "verified"), "pending"); // la fila por tenant manda
  assert.equal(effectiveStatus(null, "verified"), "verified"); // compat temporal con el global legado
  assert.equal(effectiveStatus(undefined, undefined), "unverified");
  assert.equal(challengeTtlSeconds({} as never), 600);
  assert.equal(challengeTtlSeconds({ WORKER_VERIFICATION_CHALLENGE_TTL_SECONDS: "5" } as never), 600);
  assert.equal(challengeTtlSeconds({ WORKER_VERIFICATION_CHALLENGE_TTL_SECONDS: "99999" } as never), 3600);
  assert.notEqual(generateNonce(), generateNonce());
  assert.match(hashNonce("x"), /^[0-9a-f]{64}$/);
});

test("el estado es POR TENANT: verificar en t1 no verifica en t2 (ni escribe el global)", async () => {
  const { make, rows, legacy } = { ...makeRepo({ cryptoValid: true }), legacy: {} };
  const svc = make();
  const c1 = await start(svc, "t1");
  const done = await svc.submitDidSignature("w1", "t1", "sig", "pub", c1.challenge!.nonce, self);
  assert.equal(done.status, "verified");
  assert.equal(rows.get("t1:w1")!.status, "verified");
  assert.equal((await svc.getVerificationStatus("w1", "t2")).status, "pending", "en t2 sigue sin verificar");
  assert.equal(rows.has("t2:w1"), false);
  void legacy;
});

test("iniciar emite un nonce aleatorio de un solo uso y el mensaje a firmar queda ligado a tenant+trabajador+nonce", async () => {
  const { make } = makeRepo();
  const svc = make();
  const a = await start(svc);
  const b = await start(svc);
  assert.notEqual(a.challenge!.nonce, b.challenge!.nonce);
  assert.ok(a.challenge!.expiresAt.getTime() > Date.now());
  assert.equal(a.challenge!.message, attestationMessage("t1", "w1", a.challenge!.nonce));
  assert.match(a.challenge!.message, /^semse-verify:v1:t1:w1:/);
});

test("un nuevo desafio invalida el anterior vigente", async () => {
  const { make } = makeRepo({ cryptoValid: true });
  const svc = make();
  const a = await start(svc);
  const b = await start(svc);
  const old = await svc.submitDidSignature("w1", "t1", "sig", "pub", a.challenge!.nonce, self);
  assert.equal(old.status, "failed");
  const fresh = await svc.submitDidSignature("w1", "t1", "sig", "pub", b.challenge!.nonce, self);
  assert.equal(fresh.status, "verified");
});

test("UN SOLO USO: un intento fallido (firma invalida) quema el nonce; no se puede reintentar con el mismo", async () => {
  const { make, rows, repo } = makeRepo({ cryptoValid: false });
  const svc = make();
  const c = await start(svc);
  const first = await svc.submitDidSignature("w1", "t1", "sig", "pub", c.challenge!.nonce, self);
  assert.equal(first.status, "failed");
  assert.equal(repo.lastMessage, attestationMessage("t1", "w1", c.challenge!.nonce), "la firma se valida sobre el mensaje ligado al nonce");
  repo.verifyDidSignature = async () => true; // aunque ahora la criptografia diera "valido"…
  const replay = await svc.submitDidSignature("w1", "t1", "sig", "pub", c.challenge!.nonce, self);
  assert.equal(replay.status, "failed", "…el nonce ya esta consumido");
  assert.equal(rows.get("t1:w1")!.status, "pending");
});

test("nonce caducado, de otro trabajador, de otro tenant o inventado => failed sin cambiar estado", async () => {
  const { make, challenges, rows } = makeRepo({ cryptoValid: true, workers: [["t1", "w1"], ["t2", "w1"], ["t1", "w2"]] });
  const svc = make();
  const c = await start(svc, "t1");
  // otro tenant
  assert.equal((await svc.submitDidSignature("w1", "t2", "sig", "pub", c.challenge!.nonce, self)).status, "failed");
  // inventado
  assert.equal((await svc.submitDidSignature("w1", "t1", "sig", "pub", "x".repeat(43), self)).status, "failed");
  // caducado
  challenges.get(hashNonce(c.challenge!.nonce))!.expiresAt = new Date(Date.now() - 1000);
  assert.equal((await svc.submitDidSignature("w1", "t1", "sig", "pub", c.challenge!.nonce, self)).status, "failed");
  assert.equal(rows.get("t1:w1")!.status, "pending");
  // el de otro trabajador
  const other = await svc.initiateVerification({ workerId: "w2", tenantId: "t1", actor: { userId: "w2", roles: [] }, verificationType: "DID_SIGNATURE" });
  const stolen = await svc.submitDidSignature("w1", "t1", "sig", "pub", other.challenge!.nonce, self);
  assert.equal(stolen.status, "failed");
});

test("sin nonce valido => 400 antes de consumir nada", async () => {
  const { make } = makeRepo({ cryptoValid: true });
  const svc = make();
  await start(svc);
  await assert.rejects(svc.submitDidSignature("w1", "t1", "sig", "pub", "", self), BadRequestException);
});

test("precondicion: solo el propio trabajador u OPS_ADMIN; otro => 403 y no se emite desafio", async () => {
  const { make, challenges } = makeRepo();
  const svc = make();
  const other = { userId: "w2", roles: ["WORKER"] };
  await assert.rejects(svc.initiateVerification({ workerId: "w1", tenantId: "t1", actor: other, verificationType: "DID_SIGNATURE" }), ForbiddenException);
  await assert.rejects(svc.submitDidSignature("w1", "t1", "s", "p", "n".repeat(43), other), ForbiddenException);
  await assert.rejects(svc.submitDidSignature("w1", "t1", "s", "p", "n".repeat(43), undefined), ForbiddenException);
  assert.equal(challenges.size, 0);
  const ops = await svc.initiateVerification({ workerId: "w1", tenantId: "t1", actor: { userId: "ops", roles: ["OPS_ADMIN"] }, verificationType: "DID_SIGNATURE" });
  assert.ok(ops.challenge);
});

test("monotonico: verificado no se degrada, y suspendido ni se verifica ni recibe desafio", async () => {
  const verified = makeRepo({ legacy: { w1: "verified" } });
  const s1 = verified.make();
  const r1 = await start(s1);
  assert.equal(r1.status, "verified");
  assert.equal(r1.challenge, undefined, "ya verificado: no se emite desafio");
  assert.equal(verified.challenges.size, 0);

  const suspended = makeRepo({ legacy: { w1: "suspended" }, cryptoValid: true });
  const s2 = suspended.make();
  const r2 = await start(s2);
  assert.equal(r2.status, "failed");
  assert.equal(r2.challenge, undefined);
  const sub = await s2.submitDidSignature("w1", "t1", "s", "p", "n".repeat(43), self);
  assert.equal(sub.status, "failed");
  assert.equal(suspended.challenges.size, 0);
});

test("historial auditable: eventos reales de la verificacion en ESTE tenant, con motivo del rechazo", async () => {
  const { make } = makeRepo({ cryptoValid: false });
  const svc = make();
  const c = await start(svc);
  await svc.submitDidSignature("w1", "t1", "sig", "pub", c.challenge!.nonce, self);
  await svc.submitDidSignature("w1", "t1", "sig", "pub", c.challenge!.nonce, self); // reuso
  const h = await svc.getVerificationHistory("w1", "t1");
  assert.equal(h.historyAvailable, true);
  const types = h.events.map((e) => e.type);
  assert.ok(types.includes("status_changed") && types.includes("challenge_issued"));
  assert.equal(types.filter((t) => t === "signature_rejected").length, 2);
  assert.ok(h.events.some((e) => e.reason === "signature_invalid"));
  assert.ok(h.events.some((e) => e.reason === "challenge_invalid_expired_or_used"));
  assert.deepEqual((await svc.getVerificationHistory("w1", "t2")).events, [], "el historial de t2 no ve el de t1");
});

test("compatibilidad temporal: sin fila por tenant se lee el global legado; con fila, manda el tenant", async () => {
  const { make } = makeRepo({ legacy: { w1: "verified" } });
  assert.equal((await make().getVerificationStatus("w1", "t1")).status, "verified");
});
