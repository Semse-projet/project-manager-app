import test from "node:test";
import assert from "node:assert/strict";
import { ProductIntelligenceService } from "../dist/modules/product-intelligence/product-intelligence.service.js";
import type { ProductEventBatch } from "@semse/schemas";

function makeBatch(overrides: Partial<ProductEventBatch> = {}): ProductEventBatch {
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
      {
        name: "auth.register_view",
        ts: new Date().toISOString(),
        route: "/register",
        props: { hasFrom: true, role: "CLIENT" },
      },
    ],
    ...overrides,
  };
}

type Call = { model: string; op: string; args: unknown };

function makeFakePrisma(state: { existingBatch?: boolean } = {}) {
  const calls: Call[] = [];
  const record = (model: string, op: string) => async (args: unknown) => {
    calls.push({ model, op, args });
    if (model === "productIngestBatch" && op === "findUnique") {
      return state.existingBatch ? { batchId: "x" } : null;
    }
    if (op === "deleteMany") return { count: 3 };
    return {};
  };
  const tx = {
    productIngestBatch: { create: record("productIngestBatch", "create") },
    productSession: { upsert: record("productSession", "upsert") },
    productEvent: { createMany: record("productEvent", "createMany") },
  };
  const prisma = {
    productIngestBatch: {
      findUnique: record("productIngestBatch", "findUnique"),
      deleteMany: record("productIngestBatch", "deleteMany"),
    },
    productEvent: { deleteMany: record("productEvent", "deleteMany") },
    productSession: { deleteMany: record("productSession", "deleteMany") },
    frictionSignal: { deleteMany: record("frictionSignal", "deleteMany") },
    $transaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx),
  };
  return { prisma, calls };
}

test("ingest inserta batch, sesión y eventos", async () => {
  const { prisma, calls } = makeFakePrisma();
  const service = new ProductIntelligenceService(prisma as never);
  const result = await service.ingest("tenant_default", makeBatch());
  assert.deepEqual(result, { accepted: 1, duplicated: false });
  const ops = calls.map((c) => `${c.model}.${c.op}`);
  assert.ok(ops.includes("productIngestBatch.create"));
  assert.ok(ops.includes("productSession.upsert"));
  assert.ok(ops.includes("productEvent.createMany"));
});

test("ingest con batchId ya procesado devuelve duplicated sin escribir", async () => {
  const { prisma, calls } = makeFakePrisma({ existingBatch: true });
  const service = new ProductIntelligenceService(prisma as never);
  const result = await service.ingest("tenant_default", makeBatch());
  assert.deepEqual(result, { accepted: 0, duplicated: true });
  assert.equal(calls.filter((c) => c.op !== "findUnique").length, 0);
});

test("ingest re-redacta PII server-side (defensa en profundidad)", async () => {
  const { prisma, calls } = makeFakePrisma();
  const service = new ProductIntelligenceService(prisma as never);
  await service.ingest(
    "tenant_default",
    makeBatch({
      events: [
        {
          name: "auth.context_recovered",
          ts: new Date().toISOString(),
          route: "/login",
          props: { target: "contactar a maria@ejemplo.com al 555-123-4567" },
        },
      ],
    }),
  );
  const createMany = calls.find((c) => c.op === "createMany");
  const data = (createMany?.args as { data: Array<{ propsJson: Record<string, unknown> }> }).data;
  const target = String(data[0].propsJson.target);
  assert.ok(!target.includes("maria@ejemplo.com"), target);
  assert.ok(!target.includes("555-123-4567"), target);
});

test("carrera P2002 en el ledger se trata como duplicado", async () => {
  const { prisma } = makeFakePrisma();
  (prisma as { $transaction: unknown }).$transaction = async () => {
    const err = new Error("unique") as Error & { code: string };
    err.code = "P2002";
    throw err;
  };
  const service = new ProductIntelligenceService(prisma as never);
  const result = await service.ingest("tenant_default", makeBatch());
  assert.deepEqual(result, { accepted: 0, duplicated: true });
});

test("runRetention borra por ventanas 30/90 días", async () => {
  const { prisma, calls } = makeFakePrisma();
  const service = new ProductIntelligenceService(prisma as never);
  const result = await service.runRetention();
  assert.deepEqual(result, {
    productEventsDeleted: 3,
    productSessionsDeleted: 3,
    frictionSignalsDeleted: 3,
    ingestBatchesDeleted: 3,
  });
  const cutoffs = calls
    .filter((c) => c.op === "deleteMany")
    .map((c) => c.args as { where: Record<string, { lt: Date }> });
  assert.equal(cutoffs.length, 4);
  const now = Date.now();
  const eventCutoff = cutoffs[0].where.createdAt.lt.getTime();
  assert.ok(Math.abs(now - eventCutoff - 30 * 86_400_000) < 60_000);
  const signalCutoff = cutoffs[2].where.createdAt.lt.getTime();
  assert.ok(Math.abs(now - signalCutoff - 90 * 86_400_000) < 60_000);
});

test("getEconomicFunnel calcula etapas, conversión y medianas", async () => {
  const base = Date.now() - 5 * 86_400_000;
  const jobRows = [
    {
      createdAt: new Date(base),
      bids: [{ createdAt: new Date(base + 2 * 3_600_000) }],
      contract: { createdAt: new Date(base + 24 * 3_600_000) },
      escrow: { createdAt: new Date(base + 30 * 3_600_000), status: "RELEASED" },
    },
    {
      createdAt: new Date(base),
      bids: [{ createdAt: new Date(base + 4 * 3_600_000) }],
      contract: null,
      escrow: null,
    },
    { createdAt: new Date(base), bids: [], contract: null, escrow: null },
    { createdAt: new Date(base), bids: [], contract: null, escrow: null },
  ];
  const prisma = { job: { findMany: async () => jobRows } };
  const service = new ProductIntelligenceService(prisma as never);
  const funnel = await service.getEconomicFunnel("tenant_default", 30);

  const byStage = Object.fromEntries(funnel.stages.map((s) => [s.stage, s]));
  assert.equal(byStage.job_created.count, 4);
  assert.equal(byStage.first_bid.count, 2);
  assert.equal(byStage.first_bid.conversionPct, 50);
  assert.equal(byStage.first_bid.medianHoursFromJob, 3); // mediana de 2h y 4h
  assert.equal(byStage.contract.count, 1);
  assert.equal(byStage.escrow_funded.count, 1);
  assert.equal(byStage.payment_released.count, 1);
});

test("getEconomicFunnel con cero jobs no divide por cero", async () => {
  const prisma = { job: { findMany: async () => [] } };
  const service = new ProductIntelligenceService(prisma as never);
  const funnel = await service.getEconomicFunnel("tenant_default", 30);
  assert.equal(funnel.stages[0].count, 0);
  assert.equal(funnel.stages[0].conversionPct, 0);
  assert.ok(funnel.stages.every((s) => Number.isFinite(s.conversionPct)));
});
