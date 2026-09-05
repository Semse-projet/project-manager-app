import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, ForbiddenException, PayloadTooLargeException } from "@nestjs/common";
import { ProductIntelligenceController } from "../dist/modules/product-intelligence/product-intelligence.controller.js";
import { MetricsService } from "../dist/infrastructure/observability/metrics.service.js";

// platform.product-intelligence spec — acceptance criteria not covered by
// product-intelligence-ingest.test.ts (which only unit-tests the service):
// the kill switch actually returns 403 at the controller boundary, a
// rejected batch (400) leaves a visible counter, and an event carrying a
// prop outside its allowlist is rejected, not silently dropped.

async function withEnv(vars: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function makeController() {
  const calls: string[] = [];
  const service = {
    ingest: async () => { calls.push("ingest"); return { accepted: 1, duplicated: false }; },
    getFunnel: async () => { calls.push("getFunnel"); return {}; },
    getEconomicFunnel: async () => { calls.push("getEconomicFunnel"); return {}; },
    runEngines: async () => { calls.push("runEngines"); return {}; },
    runRetention: async () => { calls.push("runRetention"); return {}; },
  };
  const metrics = new MetricsService();
  const controller = new ProductIntelligenceController(service as never, metrics);
  return { controller, service, metrics, calls };
}

function validBatch(overrides: Record<string, unknown> = {}) {
  return {
    batchId: "0b0e6f0a-1111-4d6e-9a10-6f1a2b3c4d5e",
    sentAt: new Date().toISOString(),
    consentClass: "standard",
    session: {
      sessionId: "3f2f6f0a-8a54-4d6e-9a10-6f1a2b3c4d5e",
      anonymousId: "anon_9f8e7d6c",
      userId: null,
    },
    events: [
      { name: "auth.register_view", ts: new Date().toISOString(), route: "/register", props: { hasFrom: true, role: "CLIENT" } },
    ],
    ...overrides,
  };
}

test("PI kill switch: PRODUCT_INTELLIGENCE_ENABLED apagado ⇒ ingest responde 403 sin llamar al servicio", async () => {
  await withEnv({ PRODUCT_INTELLIGENCE_ENABLED: undefined, PI_INGEST_ENABLED: undefined }, async () => {
    const { controller, calls } = makeController();
    await assert.rejects(
      () => controller.ingest({ headers: {} }, validBatch()),
      ForbiddenException,
    );
    assert.equal(calls.length, 0);
  });
});

test("PI kill switch: PI_INGEST_ENABLED=false apaga solo la ingesta, no el resto del módulo", async () => {
  await withEnv({ PRODUCT_INTELLIGENCE_ENABLED: "true", PI_INGEST_ENABLED: "false" }, async () => {
    const { controller, calls } = makeController();
    await assert.rejects(() => controller.ingest({ headers: {} }, validBatch()), ForbiddenException);
    assert.equal(calls.length, 0);

    await controller.funnel({ headers: {} });
    assert.deepEqual(calls, ["getFunnel"]);
  });
});

test("PI kill switch: funnel/economicFunnel/runEngines/runRetention responden 403 con el módulo apagado", async () => {
  await withEnv({ PRODUCT_INTELLIGENCE_ENABLED: undefined }, async () => {
    const { controller } = makeController();
    await assert.rejects(() => controller.funnel({ headers: {} }), ForbiddenException);
    await assert.rejects(() => controller.economicFunnel({ headers: {} }), ForbiddenException);
    await assert.rejects(() => controller.runEngines({ headers: {} }), ForbiddenException);
    await assert.rejects(() => controller.runRetention({ headers: {} }), ForbiddenException);
  });
});

test("PI engines kill switch: PI_ENGINES_ENABLED=false ⇒ 403 aunque el módulo esté prendido", async () => {
  await withEnv({ PRODUCT_INTELLIGENCE_ENABLED: "true", PI_ENGINES_ENABLED: "false" }, async () => {
    const { controller, calls } = makeController();
    await assert.rejects(() => controller.runEngines({ headers: {} }), ForbiddenException);
    assert.equal(calls.length, 0);
  });
});

test("PI ingest: evento con prop fuera de la allowlist ⇒ 400 y queda contado en el metrics counter", async () => {
  await withEnv({ PRODUCT_INTELLIGENCE_ENABLED: "true" }, async () => {
    const { controller, metrics } = makeController();
    const batch = validBatch({
      events: [
        { name: "auth.register_view", ts: new Date().toISOString(), route: "/register", props: { hasFrom: true, notAllowed: "x" } },
      ],
    });

    await assert.rejects(() => controller.ingest({ headers: {} }, batch), BadRequestException);
    assert.match(metrics.renderPrometheus(), /semse_product_intelligence_ingest_rejections_total\{reason="invalid_batch"\} 1/);
  });
});

test("PI ingest: evento no registrado en la allowlist ⇒ 400", async () => {
  await withEnv({ PRODUCT_INTELLIGENCE_ENABLED: "true" }, async () => {
    const { controller } = makeController();
    const batch = validBatch({
      events: [{ name: "unknown.event", ts: new Date().toISOString(), route: "/x", props: {} }],
    });

    await assert.rejects(() => controller.ingest({ headers: {} }, batch), BadRequestException);
  });
});

test("PI ingest: batch por encima de PRODUCT_EVENT_BATCH_MAX ⇒ 413 y queda contado", async () => {
  await withEnv({ PRODUCT_INTELLIGENCE_ENABLED: "true" }, async () => {
    const { controller, metrics } = makeController();
    const events = Array.from({ length: 51 }, () => ({
      name: "auth.register_view",
      ts: new Date().toISOString(),
      route: "/register",
      props: {},
    }));

    await assert.rejects(() => controller.ingest({ headers: {} }, validBatch({ events })), PayloadTooLargeException);
    assert.match(metrics.renderPrometheus(), /semse_product_intelligence_ingest_rejections_total\{reason="batch_too_large"\} 1/);
  });
});

test("PI ingest: batch válido ⇒ 200, delega al servicio, no incrementa el rejection counter", async () => {
  await withEnv({ PRODUCT_INTELLIGENCE_ENABLED: "true" }, async () => {
    const { controller, calls, metrics } = makeController();

    await controller.ingest({ headers: {} }, validBatch());

    assert.deepEqual(calls, ["ingest"]);
    assert.doesNotMatch(metrics.renderPrometheus(), /semse_product_intelligence_ingest_rejections_total\{/);
  });
});
