/**
 * SAT-001 anillo 2 — @semse/sdk: auth header, versión, envelope, errores
 * tipados y reintentos. Run: node --experimental-strip-types --test tests/unit/sdk-client.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  SDK_VERSION,
  SemseApiError,
  SemseAuthError,
  SemseClient,
  SemseDisabledError,
  SemseNetworkError,
  SemseScopeError
} from "../../packages/sdk/dist/index.js";

type RecordedCall = { url: string; init: RequestInit };

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

function makeClient(
  responses: Array<ReturnType<typeof jsonResponse>> | (() => never),
  calls: RecordedCall[] = [],
  extraOptions: Partial<{ appToken: string }> = {}
) {
  const queue = Array.isArray(responses) ? [...responses] : responses;
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (typeof queue === "function") return queue();
    const next = queue.shift();
    if (!next) throw new Error("no more mocked responses");
    return next;
  }) as unknown as typeof fetch;

  return new SemseClient({ baseUrl: "https://api.semse.test/", token: "sst_test", fetchFn, ...extraOptions });
}

test("SDK: envía bearer token y x-semse-sdk-version, desenvuelve el envelope", async () => {
  const calls: RecordedCall[] = [];
  const client = makeClient([jsonResponse(200, { requestId: "r1", data: { name: "alexa", scopes: [] } })], calls);

  const me = await client.satellites.me();

  assert.deepEqual(me, { name: "alexa", scopes: [] });
  assert.equal(calls[0].url, "https://api.semse.test/v1/satellites/me");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer sst_test");
  assert.equal(headers["x-semse-sdk-version"], SDK_VERSION);
});

test("SDK: 401 ⇒ SemseAuthError, 403 ⇒ SemseScopeError con missing, 503 ⇒ SemseDisabledError", async () => {
  await assert.rejects(
    () => makeClient([jsonResponse(401, { message: "Invalid satellite token" })]).satellites.me(),
    SemseAuthError
  );

  await assert.rejects(
    () =>
      makeClient([jsonResponse(403, { message: "lacks scopes", missing: ["jobs:read"] })]).satellites.me(),
    (error: unknown) => {
      assert.ok(error instanceof SemseScopeError);
      assert.deepEqual(error.missing, ["jobs:read"]);
      return true;
    }
  );

  await assert.rejects(
    () => makeClient([jsonResponse(503, { message: "disabled" })]).satellites.me(),
    SemseDisabledError
  );
});

test("SDK: GET reintenta en 5xx y en fallo de red; POST no reintenta", async () => {
  // GET: 500 → 200 recupera
  const recovered = await makeClient([
    jsonResponse(500, { message: "boom" }),
    jsonResponse(200, { requestId: "r2", data: { ok: true } })
  ]).satellites.me();
  assert.deepEqual(recovered, { ok: true } as never);

  // POST: un solo intento, error tipado de red
  const calls: RecordedCall[] = [];
  const failing = makeClient((() => {
    throw new Error("ECONNREFUSED");
  }) as never, calls);
  await assert.rejects(() => failing.intake.analyze({ rawDescription: "remodelar mi baño completo" }), SemseNetworkError);
  assert.equal(calls.length, 1);
});

test("SDK: errores 4xx no-auth ⇒ SemseApiError con status", async () => {
  await assert.rejects(
    () => makeClient([jsonResponse(400, { message: "bad input" })]).satellites.me(),
    (error: unknown) => {
      assert.ok(error instanceof SemseApiError);
      assert.equal(error.status, 400);
      return true;
    }
  );
});

test("SDK: intake.analyze postea a /v1/intake/analyze con canal opcional", async () => {
  const calls: RecordedCall[] = [];
  const client = makeClient([jsonResponse(200, { requestId: "r3", data: { intakeId: "int_1" } })], calls);

  await client.intake.analyze({ rawDescription: "quiero remodelar mi baño" }, "alexa");

  assert.equal(calls[0].url, "https://api.semse.test/v1/intake/analyze");
  assert.equal(calls[0].init.method, "POST");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers["x-semse-channel"], "alexa");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { rawDescription: "quiero remodelar mi baño" });
});

test("SDK: intake.answer usa PATCH /v1/intake/:id/answer", async () => {
  const calls: RecordedCall[] = [];
  const client = makeClient([jsonResponse(200, { requestId: "r4", data: {} })], calls);

  await client.intake.answer("int_1", { questionId: "q1", selectedValues: ["tile"] });

  assert.equal(calls[0].url, "https://api.semse.test/v1/intake/int_1/answer");
  assert.equal(calls[0].init.method, "PATCH");
});

// ── SAT-003: doble identidad (appToken) + recursos jobs/milestones ─────────────

test("SDK: sin appToken no envía x-semse-app-token", async () => {
  const calls: RecordedCall[] = [];
  await makeClient([jsonResponse(200, { requestId: "r5", data: { ok: true } })], calls).satellites.me();

  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(Object.hasOwn(headers, "x-semse-app-token"), false);
});

test("SDK: con appToken envía x-semse-app-token junto al bearer de sesión de usuario", async () => {
  const calls: RecordedCall[] = [];
  const client = makeClient(
    [jsonResponse(200, { requestId: "r6", data: [] })],
    calls,
    { appToken: "sst_mobile_app_token" }
  );

  await client.jobs.list();

  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer sst_test");
  assert.equal(headers["x-semse-app-token"], "sst_mobile_app_token");
});

test("SDK: jobs.list construye query de status; jobs.get usa /v1/jobs/:id", async () => {
  const calls: RecordedCall[] = [];
  const client = makeClient(
    [jsonResponse(200, { requestId: "r7", data: [] }), jsonResponse(200, { requestId: "r8", data: {} })],
    calls
  );

  await client.jobs.list({ status: "posted" });
  await client.jobs.get("job_1");

  assert.equal(calls[0].url, "https://api.semse.test/v1/jobs?status=posted");
  assert.equal(calls[1].url, "https://api.semse.test/v1/jobs/job_1");
});

test("SDK: milestones.listByJob usa /v1/jobs/:jobId/milestones", async () => {
  const calls: RecordedCall[] = [];
  const client = makeClient([jsonResponse(200, { requestId: "r9", data: [] })], calls);

  await client.milestones.listByJob("job_1");

  assert.equal(calls[0].url, "https://api.semse.test/v1/jobs/job_1/milestones");
});
