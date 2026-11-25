import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { GeofenceService } from "../dist/modules/geofence/geofence.service.js";
import { decide, type DecisionInput } from "../dist/modules/geofence/geofence.policy.js";
import { activeTargetKey } from "../dist/modules/geofence/site-binding.js";
import { WorksiteLocationService } from "../dist/modules/organizations/worksite-location.service.js";
import { LaborEngineService } from "../dist/modules/labor-engine/labor-engine.service.js";

/**
 * OPEN-18 — docs/specs/core/worksite-location-binding.spec.md (AC-01…AC-10).
 * Fixture en memoria; la unicidad del vínculo activo, el CHECK y la carrera de consumo se
 * prueban además contra PostgreSQL real en worksite-location-binding-integration.test.ts.
 */

type Row = Record<string, any>;

function matches(row: Row | undefined, where: Row | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") return true; // la asignación de jobs se resuelve en job.findFirst
    const value = row?.[k];
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("in" in v) return (v.in as unknown[]).includes(value);
      if ("not" in v) return value !== v.not && value !== undefined;
      if ("is" in v) return value != null && matches(value, v.is as Row);
      if ("gte" in v) return value instanceof Date && value.getTime() >= (v.gte as Date).getTime();
      return matches(value, v as Row);
    }
    return value === v;
  });
}

function world() {
  let seq = 0;
  const memberships: Row[] = [
    { userId: "boss", orgId: "orgA", status: "ACTIVE", org: { tenantId: "t1" }, role: { key: "PRO" } },
    { userId: "ana", orgId: "orgA", status: "ACTIVE", org: { tenantId: "t1" }, role: { key: "WORKER" } },
    { userId: "leo", orgId: "orgA", status: "SUSPENDED", org: { tenantId: "t1" }, role: { key: "WORKER" } },
    { userId: "wrk", orgId: "orgA", status: "ACTIVE", org: { tenantId: "t1" }, role: { key: "WORKER" } },
    { userId: "outsider", orgId: "orgZ", status: "ACTIVE", org: { tenantId: "t1" }, role: { key: "PRO" } }
  ];
  const worksites: Row[] = [
    { id: "w1", tenantId: "t1", orgId: "orgA", name: "Obra Norte", status: "ACTIVE", latitude: null, longitude: null, radiusMeters: null, locationSource: null, locationVerifiedAt: null },
    { id: "w2", tenantId: "t1", orgId: "orgA", name: "Obra Sur", status: "ACTIVE", latitude: null, longitude: null, radiusMeters: null, locationSource: null, locationVerifiedAt: null },
    { id: "wz", tenantId: "t1", orgId: "orgZ", name: "Ajena", status: "ACTIVE", latitude: null, longitude: null, radiusMeters: null, locationSource: null, locationVerifiedAt: null }
  ];
  // jobA: cliente orgC, profesional asignado orgA, asignado a ana. jobX: sin relación con orgA. jobT: otro tenant.
  const jobs: Row[] = [
    { id: "jobA", tenantId: "t1", clientOrgId: "orgC", deletedAt: null, project: { assignedProOrgId: "orgA" }, assignedTo: ["ana", "leo"] },
    { id: "jobX", tenantId: "t1", clientOrgId: "orgC", deletedAt: null, project: { assignedProOrgId: "orgQ" }, assignedTo: ["ana"] },
    { id: "jobT", tenantId: "t2", clientOrgId: "orgA", deletedAt: null, project: null, assignedTo: ["ana"] }
  ];
  const freeProjects: Row[] = [
    { id: "fpBoss", tenantId: "t1", createdBy: "boss" },
    { id: "fpAna", tenantId: "t1", createdBy: "ana" }
  ];
  const bindings: Row[] = [];
  const events: Row[] = [];
  const prefs: Row[] = [];
  const entries: Row[] = [];
  const audits: Row[] = [];

  const membershipApi = {
    async findMany({ where }: any) { return memberships.filter((m) => matches(m, where)); }
  };
  const prisma: any = {
    membership: membershipApi,
    worksite: {
      async findFirst({ where }: any) { return worksites.find((w) => matches(w, where)) ?? null; },
      async updateMany({ where, data }: any) {
        const hit = worksites.filter((w) => matches(w, where));
        hit.forEach((w) => Object.assign(w, data));
        return { count: hit.length };
      }
    },
    worksiteBinding: {
      async findFirst({ where, include }: any) {
        const row = bindings.find((b) => matches(b, where));
        if (!row) return null;
        return include?.worksite ? { ...row, worksite: worksites.find((w) => w.id === row.worksiteId) } : row;
      },
      async findMany({ where, take }: any) {
        // Como Prisma: filtra con las relaciones a la vista, ordena por createdAt desc y luego limita.
        const withRelations = bindings.map((b) => ({
          ...b,
          worksite: worksites.find((w) => w.id === b.worksiteId),
          job: b.jobId ? jobs.find((j) => j.id === b.jobId) : null,
          freeProject: b.freeProjectId ? freeProjects.find((f) => f.id === b.freeProjectId) : null
        }));
        const kindFilter = (row: Row) => !where.OR || where.OR.some((alt: Row) => alt.kind === row.kind);
        const hit = withRelations.filter((b) => matches(b, where) && kindFilter(b))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return (take ? hit.slice(0, take) : hit).map((b) => bindings.find((x) => x.id === b.id));
      },
      async create({ data }: any) {
        if (data.activeTargetKey && bindings.some((b) => b.activeTargetKey === data.activeTargetKey)) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        const row = { id: `b${++seq}`, createdAt: new Date(), endedAt: null, ...data };
        bindings.push(row);
        return row;
      },
      async updateMany({ where, data }: any) {
        const hit = bindings.filter((b) => matches(b, where));
        hit.forEach((b) => Object.assign(b, data));
        return { count: hit.length };
      }
    },
    job: {
      async findFirst({ where }: any) {
        const job = jobs.find((j) => j.id === where.id && j.tenantId === where.tenantId && j.deletedAt === null);
        if (!job) return null;
        if (where.OR) {
          const userId = where.OR[0].bids.some.professionalUserId;
          if (!job.assignedTo.includes(userId)) return null;
        }
        return job;
      }
    },
    freeProject: { async findFirst({ where }: any) { return freeProjects.find((f) => matches(f, where)) ?? null; } },
    locationPreference: {
      async findFirst({ where }: any) { return prefs.find((p) => matches(p, where)) ?? null; },
      async create({ data }: any) { const row = { policyVersion: 1, autoStartConsentedAt: null, autoStartRevokedAt: null, ...data }; prefs.push(row); return row; },
      async updateMany({ where, data }: any) { const hit = prefs.filter((p) => matches(p, where)); hit.forEach((p) => Object.assign(p, data)); return { count: hit.length }; }
    },
    geofenceEvent: {
      async findFirst({ where }: any) { return events.find((e) => matches(e, where)) ?? null; },
      async findMany({ where }: any) { return events.filter((e) => matches(e, where)); },
      async create({ data }: any) { const row = { id: `e${++seq}`, createdAt: new Date(), bindingId: null, consumedByTimeEntryId: null, ...data }; events.push(row); return row; }
    },
    timeEntry: { async findFirst({ where }: any) { return entries.find((t) => matches(t, where)) ?? null; } }
  };
  const audit: any = { async append(entry: Row) { audits.push(entry); } };

  // Repositorio del Labor Engine con la misma semántica de reclamación condicional.
  const repo: any = {
    sitePrisma: prisma,
    async findTimeEntryByClientEventId() { return null; },
    async getActiveTimeEntry(tenantId: string, createdBy: string) { return entries.find((t) => t.tenantId === tenantId && t.createdBy === createdBy && t.status === "running") ?? null; },
    async isJobAssignedToWorker(tenantId: string, _orgId: string, jobId: string, userId: string) { return jobs.some((j) => j.id === jobId && j.tenantId === tenantId && j.assignedTo.includes(userId)); },
    async isFreeProjectOwnedByWorker(tenantId: string, id: string, userId: string) { return freeProjects.some((f) => f.id === id && f.tenantId === tenantId && f.createdBy === userId); },
    jobCoordinates: null as null | { latitude: number; longitude: number },
    async getJobCoordinates() { return repo.jobCoordinates; },
    async getFreeProjectCoordinates() { return null; },
    async startRealtimeEntry(data: Row) { const row = { id: `te${++seq}`, status: "running", ...data }; entries.push(row); return row; },
    async startRealtimeEntryConsumingDecision(data: Row, decision: { geofenceEventId: string; notBefore: Date; revalidate?: (tx: unknown) => Promise<void> }) {
      if (repo.beforeTransaction) await repo.beforeTransaction();
      if (decision.revalidate) await decision.revalidate(prisma);
      const ev = events.find((e) => e.id === decision.geofenceEventId && e.tenantId === data.tenantId && e.userId === data.createdBy &&
        e.decision === "AUTO_START_ALLOWED" && e.consumedByTimeEntryId == null && e.createdAt.getTime() >= decision.notBefore.getTime());
      if (!ev) throw Object.assign(new Error("conflict"), { status: 409 });
      const row = { id: `te${++seq}`, status: "running", ...data };
      ev.consumedByTimeEntryId = row.id;
      entries.push(row);
      return row;
    },
    async findGeofenceDecision(tenantId: string, userId: string, id: string) { return events.find((e) => e.id === id && e.tenantId === tenantId && e.userId === userId) ?? null; },
    async findActiveBinding(tenantId: string, id: string) { return bindings.find((b) => b.id === id && b.tenantId === tenantId && b.status === "ACTIVE") ?? null; },
    /** Simula un cambio que confirma entre la validación previa y la transacción. */
    beforeTransaction: null as null | (() => Promise<void>)
  };

  return {
    prisma,
    repo,
    memberships,
    worksites,
    jobs,
    bindings,
    events,
    entries,
    audits,
    locations: new WorksiteLocationService(prisma, audit),
    geofence: new GeofenceService(prisma, audit),
    labor: new LaborEngineService(repo, {} as never)
  };
}

const boss = { tenantId: "t1", orgId: "orgA", userId: "boss", roles: ["PRO"] };
const ana = { tenantId: "t1", orgId: "orgA", userId: "ana" };
const pin = { latitude: 19.4326, longitude: -99.1332, radiusMeters: 150, source: "manual_pin" as const };
const ev = (over: Record<string, unknown> = {}) => ({
  eventId: `evt-${Math.random().toString(36).slice(2, 12)}`,
  type: "ARRIVAL" as const,
  occurredAt: new Date(),
  accuracyMeters: 12,
  ...over
});

function flags(on: { crews?: boolean; geofence?: boolean; binding?: boolean } = {}) {
  process.env.SEMSE_CREWS_ENABLED = on.crews === false ? "false" : "true";
  process.env.SEMSE_GEOFENCE_POLICY_ENABLED = on.geofence === false ? "false" : "true";
  process.env.SEMSE_WORKSITE_BINDING_ENABLED = on.binding === false ? "false" : "true";
}
test.beforeEach(() => flags());
test.after(() => {
  delete process.env.SEMSE_CREWS_ENABLED;
  delete process.env.SEMSE_GEOFENCE_POLICY_ENABLED;
  delete process.env.SEMSE_WORKSITE_BINDING_ENABLED;
});

async function boundVerifiedJob(w: ReturnType<typeof world>) {
  await w.locations.setLocation(boss, "orgA", "w1", "r", pin);
  return w.locations.createBinding(boss, "orgA", "w1", "r", { kind: "JOB", targetId: "jobA" });
}
async function autoConsent(w: ReturnType<typeof world>, user = ana) {
  await w.geofence.setPreference(user, "r", { mode: "AUTO", autoStartConsent: true });
}

// ---- política pura ----
test("AC-02 política: AUTO consentido con obra NO verificada solo pregunta", () => {
  const base: DecisionInput = { mode: "AUTO", autoConsent: true, type: "ARRIVAL", accuracy: "GOOD", activeSession: false, siteAllowed: true, ageMs: 1000, recentDuplicate: false };
  assert.equal(decide({ ...base, siteVerified: false }).decision, "PROMPT");
  assert.equal(decide({ ...base, siteVerified: true }).decision, "AUTO_START_ALLOWED");
  assert.equal(decide(base).decision, "AUTO_START_ALLOWED", "sin el campo (flag apagado) el comportamiento no cambia");
});

// ---- ubicación y vínculos ----
test("AC-01 flag de vínculos apagado: gestión de ubicación/vínculos y lista de sitios → 404 sin efectos", async () => {
  flags({ binding: false });
  const w = world();
  await assert.rejects(w.locations.setLocation(boss, "orgA", "w1", "r", pin), { status: 404 });
  await assert.rejects(w.locations.createBinding(boss, "orgA", "w1", "r", { kind: "JOB", targetId: "jobA" }), { status: 404 });
  await assert.rejects(w.geofence.listSites(ana), { status: 404 });
  assert.equal(w.bindings.length, 0);
  assert.equal(w.worksites[0].latitude, null);
});

test("AC-03 pin manual o captura en sitio quedan verificados con fecha y autor; geocodificada no; la auditoría no lleva coordenadas", async () => {
  const w = world();
  const a = await w.locations.setLocation(boss, "orgA", "w1", "r", pin);
  assert.equal(a.verified, true);
  assert.equal(w.worksites[0].locationVerifiedBy, "boss");
  const b = await w.locations.setLocation(boss, "orgA", "w2", "r", { ...pin, source: "geocoded" });
  assert.equal(b.verified, false);
  assert.equal(w.worksites[1].locationVerifiedAt, null);
  const logged = JSON.stringify(w.audits);
  assert.equal(w.audits[0].action, "worksite.location_set");
  assert.equal(logged.includes("19.43") || logged.includes("latitude"), false);
});

test("permisos: sin Membership en la Org → 404; sin org:crews:manage → 403; obra de otra Org → 404", async () => {
  const w = world();
  await assert.rejects(w.locations.setLocation({ ...boss, userId: "outsider" }, "orgA", "w1", "r", pin), { status: 404 });
  await assert.rejects(w.locations.setLocation({ ...boss, userId: "ana" }, "orgA", "w1", "r", pin), { status: 403 });
  await assert.rejects(w.locations.setLocation(boss, "orgA", "wz", "r", pin), { status: 404 });
});

test("ResourceScope del Job: la Org de la obra debe ser cliente o profesional asignada; otro tenant → 404", async () => {
  const w = world();
  const ok = await w.locations.createBinding(boss, "orgA", "w1", "r", { kind: "JOB", targetId: "jobA" });
  assert.equal(ok.targetId, "jobA");
  await assert.rejects(w.locations.createBinding(boss, "orgA", "w2", "r", { kind: "JOB", targetId: "jobX" }), { status: 404 });
  await assert.rejects(w.locations.createBinding(boss, "orgA", "w2", "r", { kind: "JOB", targetId: "jobT" }), { status: 404 });
  assert.equal(w.audits.filter((a) => a.action === "worksite_binding.created").length, 1);
});

test("Q1 proyecto libre: solo su creador, que además gestiona la Org de la obra; ajeno → 404", async () => {
  const w = world();
  const ok = await w.locations.createBinding(boss, "orgA", "w1", "r", { kind: "FREE_PROJECT", targetId: "fpBoss" });
  assert.equal(ok.kind, "FREE_PROJECT");
  await assert.rejects(w.locations.createBinding(boss, "orgA", "w1", "r", { kind: "FREE_PROJECT", targetId: "fpAna" }), { status: 404 });
});

test("AC-04 un solo vínculo ACTIVE por objetivo: mismo par idempotente; otra obra → 409; tras terminarlo se puede volver a vincular", async () => {
  const w = world();
  const first = await w.locations.createBinding(boss, "orgA", "w1", "r", { kind: "JOB", targetId: "jobA" });
  const again = await w.locations.createBinding(boss, "orgA", "w1", "r", { kind: "JOB", targetId: "jobA" });
  assert.equal(again.bindingId, first.bindingId);
  await assert.rejects(w.locations.createBinding(boss, "orgA", "w2", "r", { kind: "JOB", targetId: "jobA" }), { status: 409 });
  const ended = await w.locations.endBinding(boss, "orgA", "w1", first.bindingId, "r");
  assert.equal(ended.status, "ENDED");
  assert.equal(w.bindings[0].activeTargetKey, null);
  await assert.rejects(w.locations.endBinding(boss, "orgA", "w1", first.bindingId, "r"), { status: 409 });
  const moved = await w.locations.createBinding(boss, "orgA", "w2", "r", { kind: "JOB", targetId: "jobA" });
  assert.equal(moved.worksiteId, "w2");
  assert.equal(w.bindings.length, 2);
  assert.deepEqual(w.audits.map((a) => a.action), ["worksite_binding.created", "worksite_binding.ended", "worksite_binding.created"]);
});

test("la clave del vínculo activo incluye el tenant: el mismo id en otro tenant no colisiona", () => {
  assert.notEqual(activeTargetKey("t1", { kind: "JOB", id: "j" }), activeTargetKey("t2", { kind: "JOB", id: "j" }));
});

// ---- evaluación de eventos con `site` ----
test("AC-05 AUTO consentido + obra verificada vinculada al job asignado → AUTO_START_ALLOWED con worksiteId y bindingId", async () => {
  const w = world();
  const binding = await boundVerifiedJob(w);
  await autoConsent(w);
  const r = await w.geofence.evaluate(ana, ev({ site: { kind: "JOB", id: "jobA" } }));
  assert.equal(r.decision, "AUTO_START_ALLOWED");
  assert.equal(r.worksiteId, "w1");
  assert.equal(r.bindingId, binding.bindingId);
  assert.equal(w.events[0].orgId, "orgA");
  assert.equal(w.entries.length, 0, "el servidor decide, no inicia relojes");
});

test("AC-02 obra vinculada sin ubicación verificada (geocodificada) → PROMPT, nunca AUTO", async () => {
  const w = world();
  await w.locations.setLocation(boss, "orgA", "w1", "r", { ...pin, source: "geocoded" });
  await w.locations.createBinding(boss, "orgA", "w1", "r", { kind: "JOB", targetId: "jobA" });
  await autoConsent(w);
  const r = await w.geofence.evaluate(ana, ev({ site: { kind: "JOB", id: "jobA" } }));
  assert.equal(r.decision, "PROMPT");
});

test("AC-05 sin alcance → IGNORE sin oráculo: sin vínculo, WORKER suspendido, job no asignado, vínculo terminado", async () => {
  const w = world();
  const b = await boundVerifiedJob(w);
  assert.equal((await w.geofence.evaluate(ana, ev({ site: { kind: "JOB", id: "jobX" } }))).decision, "IGNORE");
  assert.equal((await w.geofence.evaluate({ ...ana, userId: "leo" }, ev({ site: { kind: "JOB", id: "jobA" } }))).decision, "IGNORE");
  assert.equal((await w.geofence.evaluate({ ...ana, userId: "wrk" }, ev({ site: { kind: "JOB", id: "jobA" } }))).decision, "IGNORE");
  await w.locations.endBinding(boss, "orgA", "w1", b.bindingId, "r");
  assert.equal((await w.geofence.evaluate(ana, ev({ site: { kind: "JOB", id: "jobA" } }))).decision, "IGNORE");
});

test("AC-06 worksiteId que no coincide con la obra vinculada → 422", async () => {
  const w = world();
  await boundVerifiedJob(w);
  await assert.rejects(w.geofence.evaluate(ana, ev({ site: { kind: "JOB", id: "jobA" }, worksiteId: "w2" })), { status: 422 });
  const r = await w.geofence.evaluate(ana, ev({ site: { kind: "JOB", id: "jobA" }, worksiteId: "w1" }));
  assert.notEqual(r.decision, "IGNORE");
});

test("AC-01 con el flag de vínculos apagado, `site` se ignora y la ruta por worksiteId no cambia", async () => {
  const w = world();
  await boundVerifiedJob(w);
  await autoConsent(w);
  flags({ binding: false });
  assert.equal((await w.geofence.evaluate(ana, ev({ site: { kind: "JOB", id: "jobA" } }))).decision, "IGNORE");
  // La obra w2 no tiene ubicación: con el flag apagado, la ruta antigua sigue auto-iniciando como antes.
  assert.equal((await w.geofence.evaluate(ana, ev({ worksiteId: "w2" }))).decision, "AUTO_START_ALLOWED");
  flags();
  assert.equal((await w.geofence.evaluate(ana, ev({ worksiteId: "w2", occurredAt: new Date() }))).decision, "IGNORE", "enfriamiento");
});

test("AC-02 con el flag encendido, la ruta por worksiteId tampoco auto-inicia en obras sin ubicación verificada", async () => {
  const w = world();
  await autoConsent(w);
  assert.equal((await w.geofence.evaluate(ana, ev({ worksiteId: "w2" }))).decision, "PROMPT");
});

test("lista de sitios: solo vínculos que la persona puede usar y con coordenadas de la OBRA", async () => {
  const w = world();
  await boundVerifiedJob(w);
  await w.locations.createBinding(boss, "orgA", "w2", "r", { kind: "FREE_PROJECT", targetId: "fpBoss" }); // sin coordenadas y no es de ana
  const sites = await w.geofence.listSites(ana);
  assert.deepEqual(sites.map((s) => [s.kind, s.targetId, s.verified]), [["JOB", "jobA", true]]);
  assert.equal(sites[0].radiusMeters, 150);
  assert.deepEqual(await w.geofence.listSites({ ...ana, userId: "leo" }), []);
});

// ---- consumo al iniciar el TimeEntry (AC-08…AC-10) ----
async function allowed(w: ReturnType<typeof world>) {
  await boundVerifiedJob(w);
  await autoConsent(w);
  const r = await w.geofence.evaluate(ana, ev({ site: { kind: "JOB", id: "jobA" } }));
  assert.equal(r.decision, "AUTO_START_ALLOWED");
  return r.id as string;
}
const start = (w: ReturnType<typeof world>, over: Record<string, unknown> = {}) => w.labor.startTimer({
  tenantId: "t1", orgId: "orgA", createdBy: "ana", purpose: "job_linked", jobId: "jobA",
  checkIn: { latitude: 19.4326, longitude: -99.1332, method: "proximity_auto" },
  ...over
} as never);

test("AC-08 proximity_auto con decisión vigente inicia el reloj y la consume una sola vez", async () => {
  const w = world();
  const id = await allowed(w);
  const entry: any = await start(w, { geofenceEventId: id });
  assert.equal(w.events.find((e) => e.id === id)?.consumedByTimeEntryId, entry.id);
  w.entries.forEach((e) => { e.status = "completed"; });
  await assert.rejects(start(w, { geofenceEventId: id }), { status: 409 });
  assert.equal(w.entries.length, 1);
});

test("AC-08 proximity_auto sin decisión, con decisión de otro sitio o vencida → 409 y sin TimeEntry", async () => {
  const w = world();
  const id = await allowed(w);
  await assert.rejects(start(w), { status: 409 });
  await assert.rejects(start(w, { geofenceEventId: id, jobId: undefined, freeProjectId: "fpAna", purpose: "personal" }), { status: 409 });
  w.events.find((e) => e.id === id)!.createdAt = new Date(Date.now() - 11 * 60_000);
  await assert.rejects(start(w, { geofenceEventId: id }), { status: 409 });
  assert.equal(w.entries.length, 0);
});

test("AC-08 una decisión que no es AUTO_START_ALLOWED no autoriza nada", async () => {
  const w = world();
  await boundVerifiedJob(w);
  const r = await w.geofence.evaluate(ana, ev({ site: { kind: "JOB", id: "jobA" } })); // ASK → PROMPT
  assert.equal(r.decision, "PROMPT");
  await assert.rejects(start(w, { geofenceEventId: r.id }), { status: 409 });
});

test("AC-09 proximity_confirmed y el inicio manual no exigen decisión", async () => {
  const w = world();
  await start(w, { checkIn: { latitude: 19.43, longitude: -99.13, method: "proximity_confirmed" } });
  assert.equal(w.entries.length, 1);
});

test("AC-10 vínculo terminado o membresía revocada invalidan la decisión pendiente", async () => {
  const w = world();
  const id = await allowed(w);
  w.memberships.find((m) => m.userId === "ana")!.status = "SUSPENDED";
  await assert.rejects(start(w, { geofenceEventId: id }), { status: 409 });
  w.memberships.find((m) => m.userId === "ana")!.status = "ACTIVE";
  await w.locations.endBinding(boss, "orgA", "w1", w.bindings[0].id, "r");
  await assert.rejects(start(w, { geofenceEventId: id }), { status: 409 });
  assert.equal(w.entries.length, 0);
});

test("AC-01 con el flag de vínculos apagado, proximity_auto se comporta como antes (sin decisión)", async () => {
  flags({ binding: false });
  const w = world();
  await start(w);
  assert.equal(w.entries.length, 1);
});

// ---- correcciones de la revisión (Devin, 2026-11-20) ----
test("revocación que confirma entre la validación y la transacción: la revalidación dentro de la transacción la detecta", async () => {
  const w = world();
  const id = await allowed(w);
  w.repo.beforeTransaction = async () => { w.memberships.find((m) => m.userId === "ana")!.status = "SUSPENDED"; };
  await assert.rejects(start(w, { geofenceEventId: id }), { status: 409 });
  assert.equal(w.entries.length, 0);
  assert.equal(w.events.find((e) => e.id === id)?.consumedByTimeEntryId, null);
});

test("salir de AUTO tras recibir AUTO_START_ALLOWED invalida la decisión pendiente (también si ocurre ya en la transacción)", async () => {
  const w = world();
  const id = await allowed(w);
  await w.geofence.setPreference(ana, "r", { mode: "ASK" });
  await assert.rejects(start(w, { geofenceEventId: id }), { status: 409 });
  const w2 = world();
  const id2 = await allowed(w2);
  w2.repo.beforeTransaction = async () => { await w2.geofence.setPreference(ana, "r", { mode: "OFF" }); };
  await assert.rejects(start(w2, { geofenceEventId: id2 }), { status: 409 });
  assert.equal(w2.entries.length, 0);
});

test("la distancia del fichaje autorizado se mide contra la obra verificada, no contra la geocodificación del Job", async () => {
  const w = world();
  const id = await allowed(w);
  w.repo.jobCoordinates = { latitude: 19.45, longitude: -99.13 }; // ~2 km al norte del pin de la obra
  const entry: any = await start(w, { geofenceEventId: id, checkIn: { latitude: 19.4327, longitude: -99.1333, method: "proximity_auto" } });
  assert.ok(entry.checkInDistanceMeters < 50, `distancia ${entry.checkInDistanceMeters} m`);
});

test("lista de sitios: el límite se aplica tras filtrar; un sitio válido antiguo no se pierde detrás de 200 vínculos descartables", async () => {
  const w = world();
  await boundVerifiedJob(w);
  w.bindings[0].createdAt = new Date(Date.now() - 60_000);
  for (let i = 0; i < 205; i++) {
    w.bindings.push({
      id: `noise${i}`, tenantId: "t1", orgId: "orgA", worksiteId: "w2", kind: "FREE_PROJECT", jobId: null,
      freeProjectId: `fpNoise${i}`, status: "ACTIVE", activeTargetKey: `t1:FREE_PROJECT:fpNoise${i}`, createdBy: "boss",
      createdAt: new Date(), endedAt: null
    });
  }
  const sites = await w.geofence.listSites(ana);
  assert.deepEqual(sites.map((s) => s.targetId), ["jobA"]);
});


// ---- Opción A (2026-11-25): obras solo de la Org de la sesión ----
/** ana es WORKER en orgA y en orgB; jobB es de orgB (profesional asignada) y está asignado a ana. */
async function twoOrgs(w: ReturnType<typeof world>) {
  w.memberships.push(
    { userId: "ana", orgId: "orgB", status: "ACTIVE", org: { tenantId: "t1" }, role: { key: "WORKER" } },
    { userId: "bossB", orgId: "orgB", status: "ACTIVE", org: { tenantId: "t1" }, role: { key: "PRO" } }
  );
  w.worksites.push({ id: "wB", tenantId: "t1", orgId: "orgB", name: "Obra B", status: "ACTIVE", latitude: null, longitude: null, radiusMeters: null, locationSource: null, locationVerifiedAt: null });
  w.jobs.push({ id: "jobB", tenantId: "t1", clientOrgId: "orgC", deletedAt: null, project: { assignedProOrgId: "orgB" }, assignedTo: ["ana"] });
  const bossB = { tenantId: "t1", orgId: "orgB", userId: "bossB", roles: ["PRO"] };
  await w.locations.setLocation(bossB, "orgB", "wB", "r", pin);
  await w.locations.createBinding(bossB, "orgB", "wB", "r", { kind: "JOB", targetId: "jobB" });
  await boundVerifiedJob(w);
  await autoConsent(w);
}
const anaInB = { tenantId: "t1", orgId: "orgB", userId: "ana" };

test("opción A: la lista de sitios solo trae obras de la Org de la sesión; al cambiar de sesión aparecen las de la otra", async () => {
  const w = world();
  await twoOrgs(w);
  assert.deepEqual((await w.geofence.listSites(ana)).map((s) => s.targetId), ["jobA"]);
  assert.deepEqual((await w.geofence.listSites(anaInB)).map((s) => s.targetId), ["jobB"]);
});

test("opción A negativo: una llegada a una obra de otra Org de la persona → IGNORE, sin oráculo", async () => {
  const w = world();
  await twoOrgs(w);
  const r = await w.geofence.evaluate(ana, ev({ site: { kind: "JOB", id: "jobB" } }));
  assert.equal(r.decision, "IGNORE");
  assert.equal(r.worksiteId ?? null, null);
  assert.equal(w.entries.length, 0);
});

test("opción A positivo: con la sesión en la Org de la obra, la llegada se autoriza y el reloj la consume", async () => {
  const w = world();
  await twoOrgs(w);
  const r = await w.geofence.evaluate(anaInB, ev({ site: { kind: "JOB", id: "jobB" } }));
  assert.equal(r.decision, "AUTO_START_ALLOWED");
  assert.equal(w.events.find((e) => e.id === r.id)?.orgId, "orgB");
  const entry: any = await start(w, { orgId: "orgB", jobId: "jobB", geofenceEventId: r.id });
  assert.equal(w.events.find((e) => e.id === r.id)?.consumedByTimeEntryId, entry.id);
});

test("opción A negativo: el job solo es fichable desde la Org B → desde una sesión en A el reloj responde 403 antes de mirar la decisión", async () => {
  const w = world();
  await twoOrgs(w);
  const r = await w.geofence.evaluate(anaInB, ev({ site: { kind: "JOB", id: "jobB" } }));
  assert.equal(r.decision, "AUTO_START_ALLOWED");
  // Asignación real por Org: jobB solo está asignado a través de la Org B.
  w.repo.isJobAssignedToWorker = async (_t: string, orgId: string, jobId: string) => !(jobId === "jobB" && orgId !== "orgB");
  await assert.rejects(start(w, { orgId: "orgA", jobId: "jobB", geofenceEventId: r.id }), { status: 403 });
  assert.equal(w.entries.length, 0);
  assert.equal(w.events.find((e) => e.id === r.id)?.consumedByTimeEntryId ?? null, null);
});

test("una sesión en pausa cuenta como activa: la llegada se ignora y no ofrece un inicio imposible", async () => {
  const w = world();
  await boundVerifiedJob(w);
  await autoConsent(w);
  w.entries.push({ id: "te-paused", tenantId: "t1", createdBy: "ana", status: "paused" });
  const r = await w.geofence.evaluate(ana, ev({ site: { kind: "JOB", id: "jobA" } }));
  assert.equal(r.decision, "IGNORE");
});

test("opción A negativo (job fichable también desde A, p. ej. asignación individual): una decisión de la Org B no autoriza un inicio desde una sesión en la Org A → 409 y sin TimeEntry", async () => {
  const w = world();
  await twoOrgs(w);
  const r = await w.geofence.evaluate(anaInB, ev({ site: { kind: "JOB", id: "jobB" } }));
  assert.equal(r.decision, "AUTO_START_ALLOWED");
  await assert.rejects(start(w, { orgId: "orgA", jobId: "jobB", geofenceEventId: r.id }), { status: 409 });
  assert.equal(w.entries.length, 0);
  assert.equal(w.events.find((e) => e.id === r.id)?.consumedByTimeEntryId ?? null, null);
});
