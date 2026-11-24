import test from "node:test";
import assert from "node:assert/strict";
import { classifyGeofenceSitesLoad, clientSiteKind, proximityActionForDecision as act, proximitySitesFromGeofenceLoad, serverSiteKind } from "../../apps/web/lib/geofence-decision.ts";

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

test("solo un 404 de geofence-sites conserva los sitios locales", () => {
  const legacy = [{ id: "job-local" }];
  assert.deepEqual(
    proximitySitesFromGeofenceLoad(classifyGeofenceSitesLoad({ ok: true, sites: null }), legacy),
    legacy,
  );
  assert.deepEqual(
    proximitySitesFromGeofenceLoad(classifyGeofenceSitesLoad({ ok: true, sites: [{ id: "worksite" }] }), legacy),
    [{ id: "worksite" }],
  );
  assert.deepEqual(
    proximitySitesFromGeofenceLoad(classifyGeofenceSitesLoad({ ok: true, sites: [] }), legacy),
    [],
  );
  assert.deepEqual(
    proximitySitesFromGeofenceLoad(classifyGeofenceSitesLoad({ ok: false }), legacy),
    [],
  );
});

test("tipos de sitio cliente ↔ servidor", () => {
  assert.equal(serverSiteKind("job"), "JOB");
  assert.equal(serverSiteKind("free"), "FREE_PROJECT");
  assert.equal(clientSiteKind("JOB"), "job");
  assert.equal(clientSiteKind("FREE_PROJECT"), "free");
});
