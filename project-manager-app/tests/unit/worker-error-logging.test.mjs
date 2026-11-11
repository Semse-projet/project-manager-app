import assert from "node:assert/strict";
import test from "node:test";

import { describeError } from "../../apps/worker/src/observability/job-logging.mjs";

test("describeError conserva mensaje, tipo y el HTTP status/ruta de requestJson", () => {
  const details = describeError(new Error('HTTP 403 /v1/agents/runs/reclaim-stale: {"message":"Insufficient permissions"}'));
  assert.equal(details.type, "Error");
  assert.equal(details.httpStatus, 403);
  assert.equal(details.path, "/v1/agents/runs/reclaim-stale");
  assert.match(details.message, /Insufficient permissions/);
});

test("describeError es serializable (pino ya no lo convierte en {})", () => {
  const serialized = JSON.parse(JSON.stringify({ error: describeError(new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } })) }));
  assert.deepEqual(serialized.error, { message: "fetch failed", type: "TypeError", causeCode: "ECONNREFUSED" });
});

test("describeError acepta valores no Error y recorta mensajes largos", () => {
  assert.deepEqual(describeError("boom"), { message: "boom", type: "string" });
  assert.equal(describeError(new Error("x".repeat(900))).message.length, 501);
});
