import assert from "node:assert/strict";
import test from "node:test";

import { describeError } from "../../apps/worker/src/observability/job-logging.mjs";

test("describeError conserva HTTP status/ruta y omite el cuerpo upstream", () => {
  const secret = "VERY_PRIVATE_ACCESS_TOKEN_DO_NOT_LOG";
  const details = describeError(new Error(
    `HTTP 403 /v1/agents/runs/reclaim-stale: {"message":"Insufficient permissions","token":"${secret}"}`
  ));
  assert.deepEqual(details, {
    message: "HTTP 403 /v1/agents/runs/reclaim-stale (response omitted)",
    type: "Error",
    httpStatus: 403,
    path: "/v1/agents/runs/reclaim-stale"
  });
  assert.ok(!JSON.stringify(details).includes(secret));
  assert.ok(!JSON.stringify(details).includes("Insufficient permissions"));
});

test("describeError elimina query strings y fragmentos con credenciales", () => {
  const details = describeError(new Error(
    'HTTP 403 /v1/agents/runs/claim?api_key=hiddenValue: {"password":"secret"}'
  ));
  assert.equal(details.httpStatus, 403);
  assert.equal(details.path, "/v1/agents/runs/claim");
  assert.ok(!JSON.stringify(details).includes("api_key"));
  assert.ok(!JSON.stringify(details).includes("password"));
});

test("describeError es serializable con causa de red segura", () => {
  const serialized = JSON.parse(JSON.stringify({
    error: describeError(new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } }))
  }));
  assert.deepEqual(serialized.error, {
    message: "fetch failed",
    type: "TypeError",
    causeCode: "ECONNREFUSED"
  });
});

test("describeError omite mensajes no clasificados y valores no Error", () => {
  const sensitive = "user@example.com token=secret";
  assert.deepEqual(describeError(new Error(sensitive)), {
    message: "Error details omitted",
    type: "Error"
  });
  assert.deepEqual(describeError(sensitive), {
    message: "Error details omitted",
    type: "string"
  });
});

test("describeError no registra rutas inesperadas ni cause codes arbitrarios", () => {
  const result = describeError(new TypeError(
    'HTTP 500 /v1/agents/runs/%0Asecret: {"private":"secret"}',
    { cause: { code: "SECRET=bypass" } }
  ));
  assert.equal(result.httpStatus, 500);
  assert.equal(result.path, "[redacted]");
  assert.equal(result.causeCode, undefined);
  assert.ok(!JSON.stringify(result).includes("secret"));
});
