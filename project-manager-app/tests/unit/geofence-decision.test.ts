import test from "node:test";
import assert from "node:assert/strict";
import { canRetryStartOffline, clientSiteKind, proximityActionForDecision as act, serverSiteKind, trackerGeofenceSites } from "../../apps/web/lib/geofence-decision.ts";
import { fetchMyGeofenceSites } from "../../apps/web/app/lib/module-surfaces-api.ts";

// OPEN-18 W-07: el cliente solo auto-inicia con AUTO_START_ALLOWED del servidor.
test("AUTO_START_ALLOWED es la única decisión que auto-inicia", () => {
  assert.equal(act("AUTO_START_ALLOWED"), "auto");
});

test("PROMPT y MANUAL_ONLY piden confirmación a la persona", () => {
  assert.equal(act("PROMPT"), "ask");
  assert.equal(act("MANUAL_ONLY"), "ask");
});

test("IGNORE, EXCEPTION, LEAVE_PROMPT, desconocida o ausente no hacen nada", () => {
  for (const d of ["IGNORE", "EXCEPTION", "LEAVE_PROMPT", "algo-nuevo", null, undefined]) assert.equal(act(d), "none");
});

// Mismo recorrido que el tracker web: fetch real del cliente → { ok } → trackerGeofenceSites.
async function trackerLoad(status: number, body: unknown) {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    const result = await fetchMyGeofenceSites()
      .then((sites) => ({ ok: true as const, sites }))
      .catch(() => ({ ok: false as const }));
    return trackerGeofenceSites(result, (site: { targetId: string }) => site.targetId);
  } finally {
    globalThis.fetch = original;
  }
}

test("tracker: 404 de geofence-sites → null (modo anterior con los jobs y proyectos locales)", async () => {
  assert.equal(await trackerLoad(404, { error: { message: "not found" } }), null);
});

test("tracker: 503 de geofence-sites → [] (falla cerrado: sin coordenadas locales ni auto-inicio)", async () => {
  assert.deepEqual(await trackerLoad(503, { error: { message: "unavailable" } }), []);
});

test("tracker: lista vacía del servidor → [] (manda el servidor), y con sitios se usan los del servidor", async () => {
  assert.deepEqual(await trackerLoad(200, { data: [] }), []);
  assert.deepEqual(await trackerLoad(200, { data: [{ targetId: "job-1" }] }), ["job-1"]);
});

test("un inicio automático que falla no se guarda para reintentarlo sin conexión; los demás sí", () => {
  assert.equal(canRetryStartOffline("proximity_auto"), false);
  assert.equal(canRetryStartOffline("proximity_confirmed"), true);
  assert.equal(canRetryStartOffline(undefined), true);
});

test("tipos de sitio cliente ↔ servidor", () => {
  assert.equal(serverSiteKind("job"), "JOB");
  assert.equal(serverSiteKind("free"), "FREE_PROJECT");
  assert.equal(clientSiteKind("JOB"), "job");
  assert.equal(clientSiteKind("FREE_PROJECT"), "free");
});
