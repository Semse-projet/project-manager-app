import test from "node:test";
import assert from "node:assert/strict";
import { createProductEventsClient, redactValue, sanitizeRoute } from "../src/index.ts";
import { productEventBatchSchema } from "../../schemas/src/product-events.schema.ts";

const SESSION = {
  sessionId: "3f2f6f0a-8a54-4d6e-9a10-6f1a2b3c4d5e",
  anonymousId: "anon_9f8e7d6c5b4a",
};

function makeClient(overrides: Record<string, unknown> = {}, captured: unknown[] = []) {
  return createProductEventsClient({
    enabled: true,
    endpoint: "https://example.test/ingest",
    consentClass: "standard",
    ...SESSION,
    fetchImpl: (async (_url: unknown, init: { body: string }) => {
      captured.push(JSON.parse(init.body));
      return { ok: true, status: 200 } as Response;
    }) as unknown as typeof fetch,
    ...overrides,
  });
}

test("kill switch: enabled=false hace todo no-op", async () => {
  const captured: unknown[] = [];
  const client = makeClient({ enabled: false }, captured);
  assert.equal(client.track("auth.login_view", { hasFrom: true }), "dropped_disabled");
  const result = await client.flush();
  assert.deepEqual(result, { sent: 0, ok: true });
  assert.equal(captured.length, 0);
});

test("evento desconocido y props fuera de allowlist se descartan", async () => {
  const captured: any[] = [];
  const client = makeClient({}, captured);
  assert.equal(client.track("evil.exfiltrate", { email: "a@b.com" }), "dropped_unknown_event");
  assert.equal(client.track("auth.register_view", { hasFrom: true, password: "hunter2" }), "queued");
  await client.flush();
  assert.equal(captured.length, 1);
  const event = captured[0].events[0];
  assert.deepEqual(Object.keys(event.props), ["hasFrom"]);
});

test("consentClass=restricted solo deja pasar eventos esenciales y anula userId", async () => {
  const captured: any[] = [];
  const client = makeClient({ consentClass: "restricted", userId: "user_1" }, captured);
  assert.equal(client.track("auth.login_view", {}), "dropped_consent");
  assert.equal(client.track("app.error_view", { route: "/x", status: 500 }), "queued");
  await client.flush();
  assert.equal(captured[0].session.userId, null);
  assert.equal(captured[0].events.length, 1);
});

test("redacción: emails, teléfonos y direcciones nunca salen en props", async () => {
  const captured: any[] = [];
  const client = makeClient({}, captured);
  client.track("auth.context_recovered", {
    target: "escribe a juan@x.com o al 555-123-4567 desde 4064 Hals circle",
  });
  await client.flush();
  const value = captured[0].events[0].props.target as string;
  assert.ok(!value.includes("juan@x.com"), value);
  assert.ok(!value.includes("555-123-4567"), value);
  assert.ok(!value.includes("4064"), value);
});

test("reintento reutiliza el mismo batchId (idempotencia)", async () => {
  const bodies: any[] = [];
  let fail = true;
  const client = createProductEventsClient({
    enabled: true,
    endpoint: "https://example.test/ingest",
    consentClass: "standard",
    ...SESSION,
    fetchImpl: (async (_url: unknown, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      if (fail) return { ok: false, status: 503 } as Response;
      return { ok: true, status: 200 } as Response;
    }) as unknown as typeof fetch,
  });
  client.track("auth.login_view", { hasFrom: false });
  const first = await client.flush();
  assert.equal(first.ok, false);
  fail = false;
  const second = await client.flush();
  assert.equal(second.ok, true);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].batchId, bodies[1].batchId);
});

test("los batches emitidos cumplen el schema compartido", async () => {
  const captured: any[] = [];
  const client = makeClient({}, captured);
  client.track("wizard.published", { category: "painting", durationMs: 12000 }, "/client/jobs/new?title=secreto#x");
  await client.flush();
  const parsed = productEventBatchSchema.safeParse(captured[0]);
  assert.ok(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues));
  assert.equal(captured[0].events[0].route, "/client/jobs/new");
});

test("redactValue y sanitizeRoute directos", () => {
  assert.ok(!redactValue("mi tel 555 123 4567").includes("4567"));
  assert.equal(sanitizeRoute("/pro/juan?email=a@b.com"), "/pro/juan");
  assert.ok(redactValue("presupuesto 3500 - 5000").includes("3500"));
});
