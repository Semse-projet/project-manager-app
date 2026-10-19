import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { SkillsService } from "../dist/modules/professional-skills/skills.service.js";
import { hashSummary, hashToken, normalizeTrade, summarizeExperience, SKILLS_DISCLAIMER } from "../dist/modules/professional-skills/skills.calc.js";

type Row = Record<string, any>;

const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

function makeWorld() {
  const experiences: Row[] = [];
  const attestations: Row[] = [];
  const audits: Row[] = [];
  const allocations: Row[] = [
    { id: "a1", tenantId: "t1", orgId: "orgA", crewId: "c1", userId: "ana", status: "SUBMITTED" },
    { id: "a2", tenantId: "t1", orgId: "orgA", crewId: "c1", userId: "ana", status: "SUBMITTED" },
    { id: "a3", tenantId: "t1", orgId: "orgA", crewId: "c1", userId: "ana", status: "IN_PROGRESS" },
    { id: "a4", tenantId: "t1", orgId: "orgA", crewId: "c1", userId: "sup", status: "SUBMITTED" }
  ];
  const crews: Row[] = [
    { id: "c1", tenantId: "t1", orgId: "orgA", supervisorUserId: "sup", status: "ACTIVE" }
  ];
  const memberships: Row[] = [
    { userId: "sup", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } },
    { userId: "boss", orgId: "orgA", status: "ACTIVE", role: { key: "CLIENT" }, org: { tenantId: "t1" } },
    { userId: "other", orgId: "orgA", status: "ACTIVE", role: { key: "WORKER" }, org: { tenantId: "t1" } },
    { userId: "hr", orgId: "orgB", status: "ACTIVE", role: { key: "CLIENT" }, org: { tenantId: "t2" } },
    { userId: "pro", orgId: "orgB", status: "ACTIVE", role: { key: "PRO" }, org: { tenantId: "t2" } }
  ];
  let seq = 0;
  const match = (row: Row, where: Row): boolean => Object.entries(where).every(([k, v]) => row[k] === v);
  const table = (rows: Row[], defaults: () => Row) => ({
    async findFirst({ where }: any) { return rows.find((r) => match(r, where)) ?? null; },
    async findMany({ where }: any) { return rows.filter((r) => match(r, where)); },
    async create({ data }: any) {
      const row = { id: `r${++seq}`, ...defaults(), ...data };
      if (rows === experiences && rows.some((r) => r.sourceType === row.sourceType && r.sourceId === row.sourceId)) {
        throw Object.assign(new Error("unique"), { code: "P2002" });
      }
      rows.push(row);
      return row;
    },
    async updateMany({ where, data }: any) {
      const hit = rows.filter((r) => match(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    }
  });
  const prisma: any = {
    taskAllocation: table(allocations, () => ({})),
    crew: table(crews, () => ({})),
    skillExperience: table(experiences, () => ({ evidenceLevel: "supervisor_reviewed" })),
    skillAttestation: table(attestations, () => ({ status: "ACTIVE", revokedAt: null, createdAt: new Date() })),
    membership: {
      async findMany({ where }: any) {
        return memberships.filter((m) => m.userId === where.userId && m.orgId === where.orgId &&
          (where.status ? m.status === where.status : true) &&
          (where.org ? m.org.tenantId === where.org.tenantId : true));
      }
    }
  };
  const audit: any = { async append(entry: Row) { audits.push(entry); } };
  return { service: new SkillsService(prisma, audit), experiences, attestations, audits, allocations, crews };
}

const sup = { tenantId: "t1", orgId: "orgA", userId: "sup", roles: ["WORKER"] };
const boss = { tenantId: "t1", orgId: "orgA", userId: "boss", roles: ["CLIENT"] };
const ana = { tenantId: "t1", orgId: "orgA", userId: "ana", roles: ["WORKER"] };
const hr = { tenantId: "t2", orgId: "orgB", userId: "hr", roles: ["CLIENT"] };

test.beforeEach(() => { process.env.SEMSE_SKILLS_ENABLED = "true"; });
test.after(() => { delete process.env.SEMSE_SKILLS_ENABLED; });

// ---- cálculo puro ----
test("resumen: solo hechos por oficio, sin niveles ni insignias, con granularidad de mes", () => {
  const s: any = summarizeExperience(
    [
      { trade: "Pintura", decidedAt: d("2026-03-10") },
      { trade: "pintura ", decidedAt: d("2026-05-02") },
      { trade: "Electricidad", decidedAt: d("2026-04-01") }
    ],
    d("2026-06-01")
  );
  assert.deepEqual(s.trades.map((t: any) => [t.trade, t.confirmedCount, t.since, t.until]), [
    ["electricidad", 1, "2026-04", "2026-04"],
    ["pintura", 2, "2026-03", "2026-05"]
  ]);
  assert.equal(JSON.stringify(s).includes("level"), false);
  assert.equal(JSON.stringify(s).includes("badge"), false);
  assert.equal(s.disclaimer, SKILLS_DISCLAIMER);
});

test("resumen: filtra a los oficios elegidos y normaliza acentos", () => {
  const s: any = summarizeExperience([{ trade: "Plomería", decidedAt: d("2026-03-10") }, { trade: "pintura", decidedAt: d("2026-03-11") }], d("2026-06-01"), ["plomeria"]);
  assert.deepEqual(s.trades.map((t: any) => t.trade), ["plomeria"]);
  assert.equal(normalizeTrade("  Plomería  Básica "), "plomeria basica");
  assert.equal(hashSummary({ a: 1, b: 2 }), hashSummary({ b: 2, a: 1 }));
  assert.notEqual(hashToken("x"), hashToken("y"));
});

// ---- revisión ----
test("AC-01 flag apagado -> 404 sin efectos", async () => {
  process.env.SEMSE_SKILLS_ENABLED = "false";
  const w = makeWorld();
  await assert.rejects(w.service.reviewAllocation(sup, "a1", "r", { decision: "CONFIRM", trade: "pintura" }), { status: 404 });
  await assert.rejects(w.service.mySkills(ana), { status: 404 });
  assert.equal(w.experiences.length, 0);
});

test("AC-02 solo el supervisor o un gestor revisa; no el propio trabajo; otro tenant 404", async () => {
  const w = makeWorld();
  await assert.rejects(w.service.reviewAllocation({ ...sup, userId: "other" }, "a1", "r", { decision: "CONFIRM", trade: "pintura" }), { status: 403 });
  await assert.rejects(w.service.reviewAllocation(sup, "a4", "r", { decision: "CONFIRM", trade: "pintura" }), { status: 403 });
  await assert.rejects(w.service.reviewAllocation(hr, "a1", "r", { decision: "CONFIRM", trade: "pintura" }), { status: 404 });
  assert.equal(w.experiences.length, 0);
  await w.service.reviewAllocation(boss, "a1", "r", { decision: "CONFIRM", trade: "pintura" });
  assert.equal(w.experiences.length, 1);
});

test("AC-03 solo cuenta lo ENVIADO y revisado: en curso no se revisa; confirmar exige oficio", async () => {
  const w = makeWorld();
  await assert.rejects(w.service.reviewAllocation(sup, "a3", "r", { decision: "CONFIRM", trade: "pintura" }), { status: 422 });
  await assert.rejects(w.service.reviewAllocation(sup, "a1", "r", { decision: "CONFIRM" }), { status: 422 });
  assert.equal(w.experiences.length, 0);
});

test("AC-04 una decisión por asignación; rechazar no acredita nada", async () => {
  const w = makeWorld();
  await w.service.reviewAllocation(sup, "a1", "r1", { decision: "CONFIRM", trade: "Pintura" });
  await assert.rejects(w.service.reviewAllocation(sup, "a1", "r2", { decision: "REJECT" }), { status: 409 });
  await w.service.reviewAllocation(sup, "a2", "r3", { decision: "REJECT", note: "faltó terminar" });
  const mine: any = await w.service.mySkills(ana);
  assert.equal(mine.trades.length, 1);
  assert.equal(mine.trades[0].confirmedCount, 1);
  assert.equal(mine.trades[0].trade, "pintura");
  assert.deepEqual(w.audits.map((a) => a.action), ["skill_experience.confirmed", "skill_experience.rejected"]);
});

// ---- atestaciones ----
test("AC-05 sin experiencia confirmada no hay atestación", async () => {
  const w = makeWorld();
  await assert.rejects(w.service.createAttestation(ana, "r", { consent: true }), { status: 422 });
});

test("AC-06 la atestación sale redactada: sin empresa, tarea, cuadrilla ni usuario; guarda solo el hash del token", async () => {
  const w = makeWorld();
  await w.service.reviewAllocation(sup, "a1", "r1", { decision: "CONFIRM", trade: "pintura" });
  const a: any = await w.service.createAttestation(ana, "r2", { consent: true });
  const text = JSON.stringify(a.summary);
  for (const forbidden of ["orgA", "c1", "a1", "ana", "sup", "t1"]) assert.equal(text.includes(`"${forbidden}"`), false, forbidden);
  assert.deepEqual(Object.keys(a.summary).sort(), ["disclaimer", "generatedAt", "trades"]);
  assert.equal(w.attestations[0].tokenHash, hashToken(a.token));
  assert.equal(JSON.stringify(w.attestations[0]).includes(a.token), false);
  const listed: any[] = await w.service.listAttestations(ana);
  assert.equal(JSON.stringify(listed).includes(a.token), false);
});

test("AC-07 solo comparte los oficios elegidos", async () => {
  const w = makeWorld();
  await w.service.reviewAllocation(sup, "a1", "r1", { decision: "CONFIRM", trade: "pintura" });
  await w.service.reviewAllocation(sup, "a2", "r2", { decision: "CONFIRM", trade: "electricidad" });
  const a: any = await w.service.createAttestation(ana, "r3", { consent: true, trades: ["electricidad"] });
  assert.deepEqual(a.summary.trades.map((t: any) => t.trade), ["electricidad"]);
});

test("AC-08 un gestor de otra empresa canjea el token; PRO y un token falso reciben 403/404; se audita", async () => {
  const w = makeWorld();
  await w.service.reviewAllocation(sup, "a1", "r1", { decision: "CONFIRM", trade: "pintura" });
  const a: any = await w.service.createAttestation(ana, "r2", { consent: true });
  const summary: any = await w.service.redeem(hr, "orgB", a.token, "r3");
  assert.equal(summary.trades[0].trade, "pintura");
  await assert.rejects(w.service.redeem({ ...hr, userId: "pro", roles: ["PRO"] }, "orgB", a.token, "r4"), { status: 403 });
  await assert.rejects(w.service.redeem(hr, "orgB", "token-falso-token-falso", "r5"), { status: 404 });
  await assert.rejects(w.service.redeem({ ...hr, userId: "nadie" }, "orgB", a.token, "r6"), { status: 404 });
  assert.equal(w.audits.filter((x) => x.action === "skill_attestation.redeemed").length, 1);
});

test("AC-09 revocar o vencer invalida el token; revocar dos veces -> 409; solo la dueña revoca", async () => {
  const w = makeWorld();
  await w.service.reviewAllocation(sup, "a1", "r1", { decision: "CONFIRM", trade: "pintura" });
  const a: any = await w.service.createAttestation(ana, "r2", { consent: true });
  await assert.rejects(w.service.revokeAttestation(sup, a.attestationId, "r"), { status: 404 });
  await w.service.revokeAttestation(ana, a.attestationId, "r3");
  await assert.rejects(w.service.revokeAttestation(ana, a.attestationId, "r4"), { status: 409 });
  await assert.rejects(w.service.redeem(hr, "orgB", a.token, "r5"), { status: 404 });
  const b: any = await w.service.createAttestation(ana, "r6", { consent: true });
  w.attestations[1].expiresAt = new Date(Date.now() - 1000);
  await assert.rejects(w.service.redeem(hr, "orgB", b.token, "r7"), { status: 404 });
});


test("Codex BO-12: archived crew cannot confirm submitted experience even with active supervisor membership", async () => {
  const w = makeWorld();
  w.crews[0].status = "ARCHIVED";
  await assert.rejects(
    w.service.reviewAllocation(sup, "a1", "archived-crew", { decision: "CONFIRM", trade: "electricidad" }),
    { status: 404 }
  );
  await assert.rejects(
    w.service.reviewAllocation(boss, "a1", "archived-manager", { decision: "CONFIRM", trade: "electricidad" }),
    { status: 404 }
  );
  assert.equal(w.experiences.length, 0);
  assert.equal(w.audits.length, 0);
});
