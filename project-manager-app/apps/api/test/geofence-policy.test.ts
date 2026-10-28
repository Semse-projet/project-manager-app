import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { GeofenceService } from "../dist/modules/geofence/geofence.service.js";
import { accuracyBucket, decide, type DecisionInput } from "../dist/modules/geofence/geofence.policy.js";

type Row = Record<string, any>;

const base: DecisionInput = {
  mode: "ASK",
  autoConsent: false,
  type: "ARRIVAL",
  accuracy: "GOOD",
  activeSession: false,
  siteAllowed: true,
  ageMs: 1000,
  recentDuplicate: false
};
const d = (over: Partial<DecisionInput>) => decide({ ...base, ...over }).decision;

// ---- tabla de decisión pura ----
test("precisión: <=50 m buena, mayor mala, ausente desconocida", () => {
  assert.equal(accuracyBucket(10), "GOOD");
  assert.equal(accuracyBucket(50), "GOOD");
  assert.equal(accuracyBucket(51), "POOR");
  assert.equal(accuracyBucket(undefined), "UNKNOWN");
  assert.equal(accuracyBucket(-1), "UNKNOWN");
});

test("T1 llegada en ASK: pregunta, no inicia", () => {
  assert.equal(d({ mode: "ASK" }), "PROMPT");
});

test("T2 llegada en AUTO con consentimiento y buena señal: permite el auto-inicio; sin consentimiento, pregunta", () => {
  assert.equal(d({ mode: "AUTO", autoConsent: true }), "AUTO_START_ALLOWED");
  assert.equal(d({ mode: "AUTO", autoConsent: false }), "PROMPT");
});

test("T3 ubicación imprecisa o desconocida: nunca auto-inicia, queda inicio manual", () => {
  assert.equal(d({ mode: "AUTO", autoConsent: true, accuracy: "POOR" }), "MANUAL_ONLY");
  assert.equal(d({ mode: "AUTO", autoConsent: true, accuracy: "UNKNOWN" }), "MANUAL_ONLY");
  assert.equal(d({ mode: "ASK", accuracy: "POOR" }), "MANUAL_ONLY");
});

test("T4 ya hay sesión activa: no hay doble sesión", () => {
  assert.equal(d({ mode: "AUTO", autoConsent: true, activeSession: true }), "IGNORE");
  assert.equal(d({ type: "OFF_SITE_AT_SHIFT", activeSession: true }), "IGNORE");
});

test("T5 hora de turno estando fuera: ASK pregunta; AUTO NO inicia, queda como excepción", () => {
  assert.equal(d({ type: "OFF_SITE_AT_SHIFT", mode: "ASK" }), "PROMPT");
  assert.equal(d({ type: "OFF_SITE_AT_SHIFT", mode: "AUTO", autoConsent: true }), "EXCEPTION");
  assert.notEqual(d({ type: "OFF_SITE_AT_SHIFT", mode: "AUTO", autoConsent: true }), "AUTO_START_ALLOWED");
});

test("T6 salida con reloj activo: pregunta (terminar/pausar/continuar), nunca termina en silencio; sin reloj se ignora", () => {
  assert.equal(d({ type: "LEAVE", activeSession: true }), "LEAVE_PROMPT");
  assert.equal(d({ type: "LEAVE", activeSession: true, mode: "AUTO", autoConsent: true }), "LEAVE_PROMPT");
  assert.equal(d({ type: "LEAVE", activeSession: false }), "IGNORE");
});

test("T7 modo OFF: no se usa la ubicación para nada", () => {
  for (const type of ["ARRIVAL", "LEAVE", "OFF_SITE_AT_SHIFT"] as const) {
    assert.equal(d({ mode: "OFF", type, activeSession: type === "LEAVE" }), "IGNORE");
  }
});

test("T8 obra no permitida, evento viejo, evento del futuro y repetido se ignoran", () => {
  assert.equal(d({ siteAllowed: false }), "IGNORE");
  assert.equal(d({ ageMs: 11 * 60_000 }), "IGNORE");
  assert.equal(d({ ageMs: -6 * 60_000 }), "IGNORE");
  assert.equal(d({ ageMs: -60_000 }), "PROMPT");
  assert.equal(d({ recentDuplicate: true }), "IGNORE");
});

// ---- servicio ----
function makeWorld() {
  const prefs: Row[] = [];
  const events: Row[] = [];
  const audits: Row[] = [];
  const entries: Row[] = [];
  const worksites: Row[] = [
    { id: "w1", tenantId: "t1", orgId: "orgA" },
    { id: "wx", tenantId: "t1", orgId: "orgZ" }
  ];
  const memberships: Row[] = [{ userId: "ana", orgId: "orgA", status: "ACTIVE", org: { tenantId: "t1" } }];
  let seq = 0;
  const match = (row: Row, where: Row): boolean => Object.entries(where).every(([k, v]) => row[k] === v);
  const table = (rows: Row[], defaults: () => Row) => ({
    async findFirst({ where }: any) { return rows.find((r) => match(r, where)) ?? null; },
    async findMany({ where }: any) { return rows.filter((r) => match(r, where)); },
    async create({ data }: any) {
      const row = { id: `r${++seq}`, ...defaults(), ...data };
      if (rows === events && rows.some((r) => r.tenantId === row.tenantId && r.userId === row.userId && r.eventId === row.eventId)) {
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
    locationPreference: table(prefs, () => ({ policyVersion: 1, autoStartConsentedAt: null, autoStartRevokedAt: null })),
    geofenceEvent: table(events, () => ({ createdAt: new Date() })),
    worksite: table(worksites, () => ({})),
    timeEntry: table(entries, () => ({})),
    membership: {
      async findMany({ where }: any) {
        return memberships.filter((m) => m.userId === where.userId && m.orgId === where.orgId &&
          (where.status ? m.status === where.status : true) &&
          (where.org ? m.org.tenantId === where.org.tenantId : true));
      }
    }
  };
  const audit: any = { async append(entry: Row) { audits.push(entry); } };
  return { service: new GeofenceService(prisma, audit), prefs, events, audits, entries };
}

const ana = { tenantId: "t1", orgId: "orgA", userId: "ana" };
const ev = (over: Record<string, unknown> = {}) => ({
  eventId: `evt-${Math.random().toString(36).slice(2, 10)}`,
  type: "ARRIVAL" as const,
  worksiteId: "w1",
  occurredAt: new Date(),
  accuracyMeters: 12,
  ...over
});

test.beforeEach(() => { process.env.SEMSE_GEOFENCE_POLICY_ENABLED = "true"; });
test.after(() => { delete process.env.SEMSE_GEOFENCE_POLICY_ENABLED; });

test("AC-01 flag apagado -> 404 sin efectos", async () => {
  process.env.SEMSE_GEOFENCE_POLICY_ENABLED = "false";
  const w = makeWorld();
  await assert.rejects(w.service.getPreference(ana), { status: 404 });
  await assert.rejects(w.service.evaluate(ana, ev()), { status: 404 });
  assert.equal(w.events.length, 0);
});

test("AC-02 sin preferencia guardada, el modo es ASK", async () => {
  const w = makeWorld();
  const p = await w.service.getPreference(ana);
  assert.equal(p.mode, "ASK");
  assert.equal(p.autoStartConsent, false);
  assert.equal(p.effectiveMode, "ASK");
});

test("AC-03 AUTO exige consentimiento aparte; sin él -> 422; con él queda vigente", async () => {
  const w = makeWorld();
  await assert.rejects(w.service.setPreference(ana, "r", { mode: "AUTO" }), { status: 422 });
  const p = await w.service.setPreference(ana, "r", { mode: "AUTO", autoStartConsent: true });
  assert.equal(p.effectiveMode, "AUTO");
  assert.equal(p.autoStartConsent, true);
  assert.equal(w.audits[0].action, "location_preference.changed");
});

test("AC-04 salir de AUTO revoca el consentimiento; volver a AUTO lo pide otra vez", async () => {
  const w = makeWorld();
  await w.service.setPreference(ana, "r1", { mode: "AUTO", autoStartConsent: true });
  const off = await w.service.setPreference(ana, "r2", { mode: "ASK" });
  assert.equal(off.autoStartConsent, false);
  assert.notEqual(w.prefs[0].autoStartRevokedAt, null);
  await assert.rejects(w.service.setPreference(ana, "r3", { mode: "AUTO" }), { status: 422 });
});

test("AC-05 llegada en ASK pregunta y queda registrada sin coordenadas", async () => {
  const w = makeWorld();
  const r = await w.service.evaluate(ana, ev());
  assert.equal(r.decision, "PROMPT");
  assert.equal(r.replayed, false);
  const stored = JSON.stringify(w.events[0]);
  for (const forbidden of ["latitude", "longitude", "lat", "lng", "coords"]) assert.equal(stored.includes(forbidden), false, forbidden);
  assert.equal(w.events[0].accuracyBucket, "GOOD");
});

test("AC-06 AUTO consentido + buena señal permite el auto-inicio, pero el servidor no inicia ningún reloj", async () => {
  const w = makeWorld();
  await w.service.setPreference(ana, "r", { mode: "AUTO", autoStartConsent: true });
  const r = await w.service.evaluate(ana, ev());
  assert.equal(r.decision, "AUTO_START_ALLOWED");
  assert.equal(w.entries.length, 0);
});

test("AC-07 idempotente por eventId: repetir devuelve la misma decisión sin duplicar", async () => {
  const w = makeWorld();
  const e = ev({ eventId: "evt-fijo-0001" });
  const first = await w.service.evaluate(ana, e);
  const again = await w.service.evaluate(ana, e);
  assert.equal(again.replayed, true);
  assert.equal(again.decision, first.decision);
  assert.equal(w.events.length, 1);
});

test("AC-08 enfriamiento: otra llegada a la misma obra seguida se ignora", async () => {
  const w = makeWorld();
  assert.equal((await w.service.evaluate(ana, ev())).decision, "PROMPT");
  assert.equal((await w.service.evaluate(ana, ev())).decision, "IGNORE");
});

test("AC-09 con sesión activa no hay doble inicio; la salida con sesión activa pregunta", async () => {
  const w = makeWorld();
  w.entries.push({ tenantId: "t1", createdBy: "ana", status: "running" });
  assert.equal((await w.service.evaluate(ana, ev())).decision, "IGNORE");
  assert.equal((await w.service.evaluate(ana, ev({ type: "LEAVE" }))).decision, "LEAVE_PROMPT");
});

test("AC-10 obra ajena, obra inexistente o ausente se ignoran; evento viejo también", async () => {
  const w = makeWorld();
  assert.equal((await w.service.evaluate(ana, ev({ worksiteId: "wx" }))).decision, "IGNORE");
  assert.equal((await w.service.evaluate(ana, ev({ worksiteId: "nada" }))).decision, "IGNORE");
  assert.equal((await w.service.evaluate(ana, ev({ worksiteId: undefined }))).decision, "IGNORE");
  assert.equal((await w.service.evaluate(ana, ev({ occurredAt: new Date(Date.now() - 30 * 60_000) }))).decision, "IGNORE");
});

test("AC-11 modo OFF no usa la ubicación; la persona ve sus propios eventos", async () => {
  const w = makeWorld();
  await w.service.setPreference(ana, "r", { mode: "OFF" });
  assert.equal((await w.service.evaluate(ana, ev())).decision, "IGNORE");
  const mine = await w.service.listMine(ana);
  assert.equal(mine.length, 1);
  assert.equal((await w.service.listMine({ tenantId: "t1", orgId: "orgA", userId: "otra" })).length, 0);
});
