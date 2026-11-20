import test from "node:test";
import assert from "node:assert/strict";
import { clientSiteKind, proximityActionForDecision as act, serverSiteKind } from "../../apps/web/lib/geofence-decision.ts";

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

test("tipos de sitio cliente ↔ servidor", () => {
  assert.equal(serverSiteKind("job"), "JOB");
  assert.equal(serverSiteKind("free"), "FREE_PROJECT");
  assert.equal(clientSiteKind("JOB"), "job");
  assert.equal(clientSiteKind("FREE_PROJECT"), "free");
});
