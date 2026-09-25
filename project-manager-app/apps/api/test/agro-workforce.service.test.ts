import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AgroWorkforceService } from "../dist/modules/agro/agro-workforce.service.js";
import { AgroFarmAccessService } from "../dist/modules/agro/agro-farm-access.service.js";
import {
  canRedeclareCapability, canRequestReview, effectiveCapabilityStatus, verificationExpiry, wouldCreateCapabilityCycle,
} from "../dist/modules/agro/agro-workforce.domain.js";

// ── Dominio puro ──────────────────────────────────────────────────────────────

test("agro-workforce-domain: VERIFIED past expiry reads as EXPIRED", () => {
  const now = new Date("2026-09-25T00:00:00Z");
  assert.equal(effectiveCapabilityStatus("VERIFIED", new Date("2026-09-24T00:00:00Z"), now), "EXPIRED");
  assert.equal(effectiveCapabilityStatus("VERIFIED", new Date("2026-10-24T00:00:00Z"), now), "VERIFIED");
  assert.equal(effectiveCapabilityStatus("VERIFIED", null, now), "VERIFIED");
  assert.equal(effectiveCapabilityStatus("garbage", null, now), "SELF_REPORTED");
});

test("agro-workforce-domain: redeclare/review rules", () => {
  assert.equal(canRedeclareCapability("VERIFIED"), false);
  assert.equal(canRedeclareCapability("IN_REVIEW"), false);
  assert.equal(canRedeclareCapability("REJECTED"), true);
  assert.equal(canRedeclareCapability("REVOKED"), true);
  assert.equal(canRequestReview("SELF_REPORTED"), true);
  assert.equal(canRequestReview("VERIFIED"), false);
});

test("agro-workforce-domain: expiry from validityDays or explicit date", () => {
  const at = new Date("2026-01-01T00:00:00Z");
  assert.equal(verificationExpiry(at, 365)?.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.equal(verificationExpiry(at, null), null);
  const explicit = new Date("2026-06-01T00:00:00Z");
  assert.equal(verificationExpiry(at, 365, explicit), explicit);
});

test("agro-workforce-domain: capability hierarchy cycle detection", () => {
  const parents: Record<string, string | null> = { a: null, b: "a", c: "b" };
  assert.equal(wouldCreateCapabilityCycle("a", "c", (id) => parents[id]), true);
  assert.equal(wouldCreateCapabilityCycle("c", "a", (id) => parents[id]), false);
});

// ── Servicio con repositorio en memoria ──────────────────────────────────────

type Member = { id: string; farmId: string; userId: string; role: string; status: string; displayName: string | null };

const CAP_STD = { id: "cap_feed", key: "lechones_alimentacion", name: "Alimentar lechones", category: "FEEDING", active: true, requiresProfessional: false, evidenceRequired: true, validityDays: null, parentId: "cap_handle" };
const CAP_PRO = { id: "cap_vacc", key: "vacunacion_aplicacion", name: "Aplicar vacunas", category: "HEALTH_WELFARE", active: true, requiresProfessional: true, evidenceRequired: true, validityDays: 365, parentId: null };
const ROLE = { id: "role_pig", key: "porcicultor", name: "Porcicultor", sector: "ANIMAL_PRODUCTION", species: "PIG", active: true, specialties: [] };

function setup(extraMembers: Member[] = []) {
  const members: Member[] = [
    { id: "m_sup", farmId: "farm_1", userId: "sup", role: "SUPERVISOR", status: "ACTIVE", displayName: "Capataz" },
    { id: "m_w", farmId: "farm_1", userId: "worker", role: "WORKER", status: "ACTIVE", displayName: "Ana" },
    { id: "m_w2", farmId: "farm_1", userId: "worker2", role: "WORKER", status: "ACTIVE", displayName: "Luis" },
    { id: "m_vet", farmId: "farm_1", userId: "vet", role: "VETERINARIAN", status: "ACTIVE", displayName: "Dra. Vet" },
    { id: "m_mgr", farmId: "farm_1", userId: "mgr", role: "MANAGER", status: "ACTIVE", displayName: "Gerente" },
    ...extraMembers,
  ];
  const workerCaps: any[] = [];
  const verifications: any[] = [];
  const workerRoles: any[] = [];
  const auditEvents: any[] = [];
  const evidence = [{ id: "ev_1", farmId: "farm_1" }, { id: "ev_other", farmId: "farm_2" }];
  let seq = 0;

  const prisma = {
    agroFarm: { findUnique: async ({ where }: any) => (where.id === "farm_1" ? { ownerId: "owner" } : null) },
    agroFarmMember: {
      findUnique: async ({ where }: any) =>
        members.find((m) => m.farmId === where.farmId_userId.farmId && m.userId === where.farmId_userId.userId) ?? null,
    },
  } as never;

  const repo = {
    listMembers: async (farmId: string) => members.filter((m) => m.farmId === farmId),
    findMember: async (farmId: string, userId: string) => members.find((m) => m.farmId === farmId && m.userId === userId) ?? null,
    findMemberById: async (id: string) => members.find((m) => m.id === id) ?? null,
    upsertMember: async (input: any) => {
      const existing = members.find((m) => m.farmId === input.farmId && m.userId === input.userId);
      if (existing) { Object.assign(existing, { role: input.role, status: "ACTIVE" }); return existing; }
      const row = { id: `m_${++seq}`, status: "ACTIVE", displayName: input.displayName ?? null, ...input };
      members.push(row); return row;
    },
    updateMember: async (id: string, patch: any) => { const m = members.find((x) => x.id === id)!; Object.assign(m, patch); return m; },
    userExists: async (id: string) => id !== "ghost",
    findFarm: async (farmId: string) => (farmId === "farm_1" ? { id: "farm_1", ownerId: "owner", name: "Granja" } : null),
    findRole: async (k: string) => (k === ROLE.id || k === ROLE.key ? ROLE : null),
    findCapability: async (k: string) => [CAP_STD, CAP_PRO].find((c) => c.id === k || c.key === k) ?? null,
    findWorkerCapabilityFor: async (userId: string, capabilityId: string) => workerCaps.find((w) => w.userId === userId && w.capabilityId === capabilityId) ?? null,
    findWorkerCapability: async (id: string) => {
      const wc = workerCaps.find((w) => w.id === id);
      return wc ? { ...wc, capability: [CAP_STD, CAP_PRO].find((c) => c.id === wc.capabilityId) } : null;
    },
    saveDeclaration: async (input: any, audit: any) => {
      let row = workerCaps.find((w) => w.userId === input.userId && w.capabilityId === input.capabilityId);
      if (!row) { row = { id: `wc_${++seq}`, userId: input.userId, capabilityId: input.capabilityId }; workerCaps.push(row); }
      Object.assign(row, { level: input.level, status: "SELF_REPORTED", source: input.source, farmId: input.farmId, expiresAt: null, verifiedAt: null });
      auditEvents.push({ ...audit, entityId: row.id });
      return row;
    },
    updateWorkerCapabilityStatus: async (id: string, patch: any, audit: any) => {
      const row = workerCaps.find((w) => w.id === id); Object.assign(row, patch); auditEvents.push(audit); return row;
    },
    applyVerification: async (input: any, audit: any) => {
      const verification = { id: `ver_${++seq}`, ...input.verification };
      verifications.push(verification);
      const row = workerCaps.find((w) => w.id === input.verification.workerCapabilityId);
      Object.assign(row, input.capabilityPatch, { lastVerificationId: verification.id });
      auditEvents.push(audit);
      return { verification, workerCapability: row };
    },
    upsertWorkerRole: async (input: any, audit: any) => {
      const row = { id: `wr_${++seq}`, ...input, role: ROLE }; workerRoles.push(row); auditEvents.push(audit); return row;
    },
    listWorkerRoles: async (ids: string[]) => workerRoles.filter((r) => ids.includes(r.userId)),
    listWorkerCapabilities: async (ids: string[]) =>
      workerCaps.filter((w) => ids.includes(w.userId)).map((w) => ({ ...w, capability: [CAP_STD, CAP_PRO].find((c) => c.id === w.capabilityId) })),
    listVerifications: async (ids: string[]) => verifications.filter((v) => ids.includes(v.workerCapabilityId)),
  } as never;

  const evidenceSvc = {
    assertEvidenceInFarm: async (farmId: string, ids: string[]) => {
      const missing = ids.filter((id) => !evidence.some((e) => e.id === id && e.farmId === farmId));
      if (missing.length) throw new BadRequestException(`Evidence not found in farm ${farmId}: ${missing.join(", ")}`);
      return evidence.filter((e) => ids.includes(e.id));
    },
    findEvidenceInFarm: async (farmId: string, ids: string[]) => evidence.filter((e) => ids.includes(e.id) && e.farmId === farmId),
    getEntityEvidenceForMember: async () => [],
    recordEvidence: async (farmId: string, actorId: string, input: any) => ({ id: `ev_${++seq}`, farmId, capturedById: actorId, ...input }),
  } as never;

  const audit = { listForEntity: async () => auditEvents, record: async (e: any) => { auditEvents.push(e); } } as never;
  const svc = new AgroWorkforceService(repo, new AgroFarmAccessService(prisma), evidenceSvc, audit);
  return { svc, members, workerCaps, verifications, auditEvents };
}

test("agro-workforce: worker self-declares a capability (SELF_REPORTED + audit)", async () => {
  const { svc, auditEvents } = setup();
  const wc = await svc.declareCapability("farm_1", "worker", "worker", { capability: "lechones_alimentacion", level: "INTERMEDIATE" });
  assert.equal(wc.status, "SELF_REPORTED");
  assert.equal(wc.source, "SELF_REPORTED");
  assert.equal(auditEvents.at(-1).action, "capability.declared");
});

test("agro-workforce: worker cannot declare capabilities for someone else", async () => {
  const { svc } = setup();
  await assert.rejects(() => svc.declareCapability("farm_1", "worker", "worker2", { capability: "lechones_alimentacion" }), ForbiddenException);
});

test("agro-workforce: supervisor assigns capability to a member (source ASSIGNED)", async () => {
  const { svc } = setup();
  const wc = await svc.declareCapability("farm_1", "sup", "worker", { capability: "lechones_alimentacion" });
  assert.equal(wc.source, "ASSIGNED");
});

test("agro-workforce: cannot target a user outside the farm", async () => {
  const { svc } = setup();
  await assert.rejects(() => svc.declareCapability("farm_1", "sup", "stranger", { capability: "lechones_alimentacion" }), NotFoundException);
});

test("agro-workforce: non-member cannot touch the farm (404)", async () => {
  const { svc } = setup();
  await assert.rejects(() => svc.declareCapability("farm_1", "stranger", "stranger", { capability: "lechones_alimentacion" }), NotFoundException);
});

test("agro-workforce: verification requires evidence when capability demands it", async () => {
  const { svc } = setup();
  const wc = await svc.declareCapability("farm_1", "worker", "worker", { capability: "lechones_alimentacion" });
  await assert.rejects(
    () => svc.verifyCapability("farm_1", "sup", wc.id, { result: "APPROVED", method: "DIRECT_OBSERVATION" }),
    BadRequestException,
  );
});

test("agro-workforce: evidence from another farm is rejected", async () => {
  const { svc } = setup();
  const wc = await svc.declareCapability("farm_1", "worker", "worker", { capability: "lechones_alimentacion" });
  await assert.rejects(
    () => svc.verifyCapability("farm_1", "sup", wc.id, { result: "APPROVED", method: "DIRECT_OBSERVATION", evidenceIds: ["ev_other"] }),
    BadRequestException,
  );
});

test("agro-workforce: supervisor verifies with evidence → VERIFIED, append-only record, audit", async () => {
  const { svc, verifications, auditEvents } = setup();
  const wc = await svc.declareCapability("farm_1", "worker", "worker", { capability: "lechones_alimentacion" });
  const { verification, workerCapability } = await svc.verifyCapability("farm_1", "sup", wc.id, {
    result: "APPROVED", method: "DIRECT_OBSERVATION", levelAssessed: "ADVANCED", evidenceIds: ["ev_1"], notes: "Observado en maternidad",
  });
  assert.equal(workerCapability.status, "VERIFIED");
  assert.equal(workerCapability.level, "ADVANCED");
  assert.equal(verification.verifierId, "sup");
  assert.equal(verification.verifierFarmRole, "SUPERVISOR");
  assert.deepEqual(verification.evidenceIds, ["ev_1"]);
  assert.equal(verifications.length, 1);
  assert.equal(auditEvents.at(-1).action, "capability.verified");
});

test("agro-workforce: nobody can verify their own capability", async () => {
  const { svc } = setup();
  const wc = await svc.declareCapability("farm_1", "sup", "sup", { capability: "lechones_alimentacion" });
  await assert.rejects(
    () => svc.verifyCapability("farm_1", "sup", wc.id, { result: "APPROVED", method: "DIRECT_OBSERVATION", evidenceIds: ["ev_1"] }),
    ForbiddenException,
  );
});

test("agro-workforce: worker cannot verify someone else's capability", async () => {
  const { svc } = setup();
  const wc = await svc.declareCapability("farm_1", "worker2", "worker2", { capability: "lechones_alimentacion" });
  await assert.rejects(
    () => svc.verifyCapability("farm_1", "worker", wc.id, { result: "APPROVED", method: "DIRECT_OBSERVATION", evidenceIds: ["ev_1"] }),
    ForbiddenException,
  );
});

test("agro-workforce: professional capability → owner/supervisor forbidden, veterinarian allowed with expiry", async () => {
  const { svc } = setup();
  const wc = await svc.declareCapability("farm_1", "worker", "worker", { capability: "vacunacion_aplicacion" });
  await assert.rejects(
    () => svc.verifyCapability("farm_1", "owner", wc.id, { result: "APPROVED", method: "PRACTICAL_TEST", evidenceIds: ["ev_1"] }),
    ForbiddenException,
  );
  await assert.rejects(
    () => svc.verifyCapability("farm_1", "sup", wc.id, { result: "APPROVED", method: "PRACTICAL_TEST", evidenceIds: ["ev_1"] }),
    ForbiddenException,
  );
  const { workerCapability } = await svc.verifyCapability("farm_1", "vet", wc.id, { result: "APPROVED", method: "PRACTICAL_TEST", evidenceIds: ["ev_1"] });
  assert.equal(workerCapability.status, "VERIFIED");
  assert.ok(workerCapability.expiresAt instanceof Date, "validityDays=365 sets an expiry");
});

test("agro-workforce: rejection requires notes", async () => {
  const { svc } = setup();
  const wc = await svc.declareCapability("farm_1", "worker", "worker", { capability: "lechones_alimentacion" });
  await assert.rejects(() => svc.verifyCapability("farm_1", "sup", wc.id, { result: "REJECTED", method: "INTERVIEW" }), BadRequestException);
  const { workerCapability } = await svc.verifyCapability("farm_1", "sup", wc.id, { result: "REJECTED", method: "INTERVIEW", notes: "No domina la técnica" });
  assert.equal(workerCapability.status, "REJECTED");
});

test("agro-workforce: verified capability cannot be silently re-declared (409)", async () => {
  const { svc } = setup();
  const wc = await svc.declareCapability("farm_1", "worker", "worker", { capability: "lechones_alimentacion" });
  await svc.verifyCapability("farm_1", "sup", wc.id, { result: "APPROVED", method: "DIRECT_OBSERVATION", evidenceIds: ["ev_1"] });
  await assert.rejects(() => svc.declareCapability("farm_1", "worker", "worker", { capability: "lechones_alimentacion", level: "EXPERT" }), ConflictException);
});

test("agro-workforce: revoke requires reason, only on VERIFIED, records REVOKED", async () => {
  const { svc, verifications, auditEvents } = setup();
  const wc = await svc.declareCapability("farm_1", "worker", "worker", { capability: "lechones_alimentacion" });
  await assert.rejects(() => svc.revokeVerification("farm_1", "sup", wc.id, { reason: "x" }), ConflictException);
  await svc.verifyCapability("farm_1", "sup", wc.id, { result: "APPROVED", method: "DIRECT_OBSERVATION", evidenceIds: ["ev_1"] });
  await assert.rejects(() => svc.revokeVerification("farm_1", "sup", wc.id, { reason: " " }), BadRequestException);
  const { workerCapability } = await svc.revokeVerification("farm_1", "sup", wc.id, { reason: "Incumplió protocolo de bioseguridad" });
  assert.equal(workerCapability.status, "REVOKED");
  assert.equal(verifications.at(-1).result, "REVOKED");
  assert.equal(auditEvents.at(-1).action, "capability.revoked");
});

test("agro-workforce: request review moves SELF_REPORTED → IN_REVIEW", async () => {
  const { svc } = setup();
  const wc = await svc.declareCapability("farm_1", "worker", "worker", { capability: "lechones_alimentacion" });
  const updated = await svc.requestReview("farm_1", "worker", wc.id);
  assert.equal(updated.status, "IN_REVIEW");
  await assert.rejects(() => svc.requestReview("farm_1", "worker", wc.id), ConflictException);
});

test("agro-workforce: assign trade role (Porcicultor) with audit", async () => {
  const { svc, auditEvents } = setup();
  const wr = await svc.assignWorkerRole("farm_1", "sup", "worker", { role: "porcicultor", isPrimary: true });
  assert.equal(wr.source, "ASSIGNED");
  assert.equal(auditEvents.at(-1).action, "worker_role.assigned");
  await assert.rejects(() => svc.assignWorkerRole("farm_1", "sup", "worker", { role: "unknown" }), NotFoundException);
});

test("agro-workforce: members — only owner grants MANAGER; manager adds workers; ghost users rejected", async () => {
  const { svc } = setup();
  await assert.rejects(() => svc.addMember("farm_1", "mgr", { userId: "new1", role: "MANAGER" }), ForbiddenException);
  const m = await svc.addMember("farm_1", "mgr", { userId: "new1", role: "WORKER" });
  assert.equal(m.role, "WORKER");
  await assert.rejects(() => svc.addMember("farm_1", "mgr", { userId: "ghost", role: "WORKER" }), NotFoundException);
  await assert.rejects(() => svc.addMember("farm_1", "sup", { userId: "new2", role: "WORKER" }), ForbiddenException);
  const promoted = await svc.addMember("farm_1", "owner", { userId: "new1", role: "MANAGER" });
  assert.equal(promoted.role, "MANAGER");
});

test("agro-workforce: members cannot change their own membership", async () => {
  const { svc } = setup();
  await assert.rejects(() => svc.updateMember("farm_1", "mgr", "m_mgr", { status: "SUSPENDED" }), ForbiddenException);
});

test("agro-workforce: capability matrix — workers only see their own row", async () => {
  const { svc } = setup();
  await svc.declareCapability("farm_1", "worker", "worker", { capability: "lechones_alimentacion" });
  await svc.declareCapability("farm_1", "worker2", "worker2", { capability: "lechones_alimentacion" });
  const asWorker = await svc.getCapabilityMatrix("farm_1", "worker");
  assert.deepEqual(asWorker.workers.map((w: any) => w.userId), ["worker"]);
  const asSup = await svc.getCapabilityMatrix("farm_1", "sup");
  assert.ok(asSup.workers.length >= 6, "owner + 5 members");
  const row = asSup.workers.find((w: any) => w.userId === "worker2");
  assert.equal(row.capabilities[0].status, "SELF_REPORTED");
});

test("agro-workforce: profile — worker cannot read another worker's profile", async () => {
  const { svc } = setup();
  await assert.rejects(() => svc.getWorkerProfile("farm_1", "worker", "worker2"), ForbiddenException);
  const own = await svc.getWorkerProfile("farm_1", "worker", "worker");
  assert.equal(own.worker.farmRole, "WORKER");
});

test("agro-workforce: profile shows verifier, method and evidence of the verification", async () => {
  const { svc } = setup();
  const wc = await svc.declareCapability("farm_1", "worker", "worker", { capability: "lechones_alimentacion" });
  await svc.verifyCapability("farm_1", "sup", wc.id, { result: "APPROVED", method: "DIRECT_OBSERVATION", evidenceIds: ["ev_1"] });
  const profile = await svc.getWorkerProfile("farm_1", "sup", "worker");
  const cap = profile.capabilities[0];
  assert.equal(cap.status, "VERIFIED");
  assert.equal(cap.lastVerification.verifierId, "sup");
  assert.equal(cap.verifications[0].evidence[0].id, "ev_1");
});

test("agro-workforce: catalog key validation", async () => {
  const { svc } = setup();
  await assert.rejects(() => svc.createCatalogCapability({ key: "Bad Key", name: "x", category: "FEEDING" }), BadRequestException);
  await assert.rejects(() => svc.createCatalogCapability({ key: "ok_key", name: "x", category: "NOPE" }), BadRequestException);
});
