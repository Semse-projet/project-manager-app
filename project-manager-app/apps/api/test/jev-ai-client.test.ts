import test from "node:test";
import assert from "node:assert/strict";
import {
  JevAiClient,
  JevAiError,
  parseModelsResponse,
  parseRetryAfter,
  parseSystemOneResponse,
} from "../dist/modules/ai-models/decision/jev-ai.client.js";

const KEY = "test-key-not-a-secret";
const URGENT = { urgent: { type: "noul" as const, instructions: "Does this message need urgent support?" } };

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function recordingFetch(respond: (call: number) => Response | Promise<Response>) {
  const calls: { url: string; init: any }[] = [];
  const fetchImpl = (async (url: string, init: any) => {
    calls.push({ url, init });
    return respond(calls.length);
  }) as any;
  return { calls, fetchImpl };
}

test("systemOne: sends the documented request and reads answers.urgent.noul + usage", async () => {
  const { calls, fetchImpl } = recordingFetch(() =>
    json({
      model: "jev-1.13.0",
      answers: { urgent: { type: "noul", noul: 0.91 } },
      usage: { input_tokens: 41, output_tokens: 0, reasoning_tokens: 0, cached_tokens: 0, n_calls: 1, n_retries: 0, latency: 0.18 },
    }),
  );
  const client = new JevAiClient({ apiKey: KEY, timeoutMs: 500 }, fetchImpl);
  const result = await client.systemOne({ state: "My payment failed. Please help.", questions: URGENT });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://jev-ai.pro/api/v1/systemone");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.authorization, `Bearer ${KEY}`);
  assert.equal(calls[0].init.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    model: "jev-latest",
    state: "My payment failed. Please help.",
    questions: { urgent: { type: "noul", instructions: "Does this message need urgent support?" } },
  });
  assert.equal(result.answers.urgent.noul, 0.91);
  assert.equal(result.model, "jev-1.13.0");
  assert.deepEqual(result.usage, { input_tokens: 41, output_tokens: 0, reasoning_tokens: 0, cached_tokens: 0, n_calls: 1, n_retries: 0, latency: 0.18 });
});

test("typed answers: choice and score are validated against the question asked", () => {
  const questions = {
    route: { type: "choice" as const, instructions: "Which team?", criteria: { billing: "money", tech: "bugs" } },
    severity: { type: "score" as const, instructions: "How severe, 1-5?" },
    urgent: URGENT.urgent,
  };
  const parsed = parseSystemOneResponse(
    questions,
    {
      answers: {
        route: { type: "choice", choice: "billing", probabilities: { billing: 0.8, tech: 0.2 }, confidence: 0.77 },
        severity: { type: "score", score: 4, probabilities: { "3": 0.2, "4": 0.7, "5": 0.1 }, confidence: 0.7 },
        urgent: { type: "noul", noul: 0.6 },
      },
      usage: { input_tokens: 90 },
    },
    "jev-latest",
  );
  assert.equal(parsed.model, "jev-latest", "falls back to the requested model id");
  assert.equal(parsed.answers.route.choice, "billing");
  assert.equal(parsed.answers.route.confidence, 0.77);
  assert.equal(parsed.answers.severity.score, 4);
  assert.equal(parsed.answers.urgent.noul, 0.6);

  const bad: Array<[string, unknown]> = [
    ["noul out of range", { urgent: { type: "noul", noul: 1.2 } }],
    ["noul missing", { urgent: { type: "noul", value: 0.5 } }],
    ["type mismatch", { urgent: { type: "choice", choice: "yes" } }],
    ["answer missing", {}],
  ];
  for (const [label, answers] of bad) {
    assert.throws(() => parseSystemOneResponse(URGENT, { answers }, "jev-latest"), (e: any) => e instanceof JevAiError && e.kind === "invalid_response", label);
  }
  assert.throws(
    () => parseSystemOneResponse({ route: questions.route }, { answers: { route: { type: "choice", choice: "escrow", probabilities: {} } } }, "m"),
    (e: any) => e.kind === "invalid_response",
    "a choice outside the offered criteria is rejected",
  );
  assert.throws(() => parseSystemOneResponse(URGENT, { detail: "x" }, "m"), (e: any) => e.kind === "invalid_response");
});

test("HTTP errors are typed, useful and never leak the key", async () => {
  const cases: Array<[number, unknown, string, boolean]> = [
    [401, { detail: { error_type: "authentication_error", message: "Cannot authenticate with the server." } }, "unauthorized", false],
    [402, { error: { type: "insufficient_credits", message: "No credits remaining." } }, "payment_required", false],
    [422, { detail: { error_type: "validation_error", message: "Question 'urgent' exceeds the model input limit." } }, "invalid_request", false],
    [502, null, "bad_gateway", true],
    [504, null, "gateway_timeout", true],
    [500, null, "server_error", true],
    [404, null, "http_error", false],
  ];
  for (const [status, body, kind, uncertain] of cases) {
    const { calls, fetchImpl } = recordingFetch(() => (body === null ? new Response("upstream", { status }) : json(body, status)));
    const client = new JevAiClient({ apiKey: KEY, timeoutMs: 500 }, fetchImpl);
    await assert.rejects(client.systemOne({ state: "s", questions: URGENT }), (e: any) => {
      assert.ok(e instanceof JevAiError);
      assert.equal(e.kind, kind, `status ${status}`);
      assert.equal(e.status, status);
      assert.equal(e.outcomeUncertain, uncertain, `status ${status} uncertainty`);
      assert.equal(e.retryable, false);
      assert.doesNotMatch(e.message, new RegExp(KEY));
      return true;
    });
    assert.equal(calls.length, 1, `status ${status} is never retried automatically`);
  }

  const { fetchImpl } = recordingFetch(() => json({ detail: { error_type: "authentication_error", message: "Cannot authenticate with the server." } }, 401));
  await assert.rejects(new JevAiClient({ apiKey: KEY, timeoutMs: 500 }, fetchImpl).systemOne({ state: "s", questions: URGENT }), (e: any) =>
    /401/.test(e.message) && /JEV_AI_API_KEY/.test(e.message) && e.errorType === "authentication_error");
});

test("missing key fails locally without any network call", async () => {
  const { calls, fetchImpl } = recordingFetch(() => json({}));
  const client = new JevAiClient({ apiKey: null, timeoutMs: 500 }, fetchImpl);
  await assert.rejects(client.systemOne({ state: "s", questions: URGENT }), (e: any) => e.kind === "not_configured");
  await assert.rejects(client.listModels(), (e: any) => e.kind === "not_configured");
  assert.equal(calls.length, 0);
});

test("timeouts and network failures on POST are uncertain and not retried", async () => {
  const hang = recordingFetch(() => new Promise<Response>(() => {}));
  const hangingFetch = ((url: string, init: any) => {
    hang.fetchImpl(url, init);
    return new Promise((_r, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  }) as any;
  await assert.rejects(new JevAiClient({ apiKey: KEY, timeoutMs: 30 }, hangingFetch).systemOne({ state: "s", questions: URGENT }), (e: any) =>
    e.kind === "timeout" && e.outcomeUncertain === true && e.retryable === false);
  assert.equal(hang.calls.length, 1);

  let networkCalls = 0;
  const broken = (async () => { networkCalls++; throw new TypeError("fetch failed"); }) as any;
  await assert.rejects(new JevAiClient({ apiKey: KEY, timeoutMs: 500 }, broken).systemOne({ state: "s", questions: URGENT }), (e: any) =>
    e.kind === "network" && e.outcomeUncertain === true);
  assert.equal(networkCalls, 1);
});

test("429 honours Retry-After: local cooldown, then calls resume", async () => {
  let now = 1_000_000;
  const { calls, fetchImpl } = recordingFetch((n) =>
    n === 1 ? json({ detail: { error_type: "rate_limit_error" } }, 429, { "retry-after": "7" }) : json({ answers: { urgent: { noul: 0.2 } } }),
  );
  const client = new JevAiClient({ apiKey: KEY, timeoutMs: 500 }, fetchImpl, () => now);

  await assert.rejects(client.systemOne({ state: "s", questions: URGENT }), (e: any) =>
    e.kind === "rate_limited" && e.status === 429 && e.retryAfterMs === 7000 && e.retryable === true && e.outcomeUncertain === false);
  now += 3000;
  await assert.rejects(client.systemOne({ state: "s", questions: URGENT }), (e: any) => e.kind === "rate_limited" && e.retryAfterMs === 4000);
  assert.equal(calls.length, 1, "no request is sent while Retry-After is pending");
  now += 4000;
  const result = await client.systemOne({ state: "s", questions: URGENT });
  assert.equal(result.answers.urgent.noul, 0.2);
  assert.equal(calls.length, 2);
});

test("429 retry is opt-in, happens once, and only within the caller's budget", async () => {
  const slept: number[] = [];
  let now = 0;
  const sleep = async (ms: number) => { slept.push(ms); now += ms; };

  const ok = recordingFetch((n) => (n === 1 ? json({}, 429, { "retry-after": "1" }) : json({ answers: { urgent: { type: "noul", noul: 0.4 } } })));
  const withBudget = new JevAiClient({ apiKey: KEY, timeoutMs: 500, maxRateLimitRetryMs: 2000 }, ok.fetchImpl, () => now, sleep);
  assert.equal((await withBudget.systemOne({ state: "s", questions: URGENT })).answers.urgent.noul, 0.4);
  assert.deepEqual(slept, [1000]);
  assert.equal(ok.calls.length, 2);

  const twice = recordingFetch(() => json({}, 429, { "retry-after": "1" }));
  await assert.rejects(new JevAiClient({ apiKey: KEY, timeoutMs: 500, maxRateLimitRetryMs: 2000 }, twice.fetchImpl, () => now, sleep)
    .systemOne({ state: "s", questions: URGENT }), (e: any) => e.kind === "rate_limited");
  assert.equal(twice.calls.length, 2, "at most one retry");

  const tooLong = recordingFetch(() => json({}, 429, { "retry-after": "30" }));
  await assert.rejects(new JevAiClient({ apiKey: KEY, timeoutMs: 500, maxRateLimitRetryMs: 2000 }, tooLong.fetchImpl, () => now, sleep)
    .systemOne({ state: "s", questions: URGENT }), (e: any) => e.retryAfterMs === 30_000);
  assert.equal(tooLong.calls.length, 1, "Retry-After beyond the budget is returned to the caller");
});

test("parseRetryAfter: seconds, HTTP date, garbage", () => {
  assert.equal(parseRetryAfter("2"), 2000);
  assert.equal(parseRetryAfter("Wed, 21 Oct 2026 07:28:05 GMT", Date.parse("Wed, 21 Oct 2026 07:28:00 GMT")), 5000);
  assert.equal(parseRetryAfter("soon"), undefined);
  assert.equal(parseRetryAfter(null), undefined);
});

test("listModels: GET /api/v1/models returns only the connected models Jev AI reports", async () => {
  const { calls, fetchImpl } = recordingFetch(() =>
    json({ data: [{ id: "jev-latest" }, { id: "laya-english", connected: true }, { id: "laya-multilingual", connected: false }] }),
  );
  const models = await new JevAiClient({ apiKey: KEY, timeoutMs: 500 }, fetchImpl).listModels();
  assert.deepEqual(models, ["jev-latest", "laya-english"]);
  assert.equal(calls[0].url, "https://jev-ai.pro/api/v1/models");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[0].init.headers.authorization, `Bearer ${KEY}`);

  assert.deepEqual(parseModelsResponse(["jev-latest", "jev-latest"]), ["jev-latest"]);
  assert.deepEqual(parseModelsResponse({ models: [{ name: "laya-english" }] }), ["laya-english"]);
  assert.throws(() => parseModelsResponse({ ok: true }), (e: any) => e.kind === "invalid_response");
});

test("Laya: per-question input limit is checked before sending", async () => {
  const { calls, fetchImpl } = recordingFetch(() => json({ answers: { urgent: { type: "noul", noul: 0.5 } } }));
  const client = new JevAiClient({ apiKey: KEY, timeoutMs: 500 }, fetchImpl);
  const longState = "word ".repeat(700); // ~1,167 estimated tokens

  await assert.rejects(client.systemOne({ model: "laya-english", state: longState, questions: URGENT }), (e: any) =>
    e.kind === "input_too_long" && /laya-english allows 512/.test(e.message));
  await assert.rejects(client.systemOne({ model: "laya-multilingual", state: longState, questions: URGENT }), (e: any) =>
    e.kind === "input_too_long" && /1024/.test(e.message));
  assert.equal(calls.length, 0);

  await client.systemOne({ model: "laya-english", state: "My payment failed. Please help.", questions: URGENT });
  await client.systemOne({ model: "jev-latest", state: longState, questions: URGENT });
  assert.equal(calls.length, 2, "short Laya input and non-Laya models are sent");
  assert.equal(JSON.parse(calls[0].init.body).model, "laya-english");
});
