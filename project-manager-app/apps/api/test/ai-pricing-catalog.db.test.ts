import test from "node:test";
import assert from "node:assert/strict";
import prismaClientPackage from "../../../node_modules/.prisma/client/index.js";
import { AiPricingCatalogService } from "../dist/modules/ai-models/pricing/ai-pricing-catalog.service.js";

// C39 — contra PostgreSQL REAL (migración aplicada): exclusión de intervalos, inmutabilidad,
// concurrencia de altas y auditoría. Se omite sin C39_TEST_DATABASE_URL (CI unitario sin DB).
const url = process.env.C39_TEST_DATABASE_URL;
const skip = !url;
const { PrismaClient } = prismaClientPackage as any;

const ops = { tenantId: "t_c39", userId: "u_c39", roles: ["OPS_ADMIN"] };
const base = (over: Record<string, unknown> = {}) => ({
  provider: "anthropic", modelSlug: "claude-sonnet", providerModelName: "claude-sonnet-x",
  inputPer1K: 0.003, outputPer1K: 0.015, effectiveFrom: "2026-01-01T00:00:00Z",
  sourceUrl: "https://docs.example.com/pricing", sourceCheckedAt: "2026-09-30T00:00:00Z", ...over,
});
const status = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e: any) { return e?.status ?? e?.getStatus?.() ?? 500; } };

test("C39 DB real", { skip }, async (t) => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const svc = new AiPricingCatalogService(prisma as never);
  await prisma.$executeRawUnsafe(`INSERT INTO "Tenant"(id,slug,name,"updatedAt") VALUES ('t_c39','t-c39','c39',now()) ON CONFLICT DO NOTHING`);
  await prisma.$executeRawUnsafe(`INSERT INTO "User"(id,email,"updatedAt") VALUES ('u_c39','c39@example.com',now()) ON CONFLICT DO NOTHING`);
  // el catálogo es inmutable: se aísla con un provider único por ejecución (sin DELETE posible)
  const provider = `prov_${Date.now()}`;
  try {
    await t.test("OPS_ADMIN crea, cierra la vigencia previa y resuelve por fecha", async () => {
      const a = await svc.createPrice(ops, base({ provider }));
      const b = await svc.createPrice(ops, base({ provider, inputPer1K: 0.004, outputPer1K: 0.02, effectiveFrom: "2026-06-01T00:00:00Z" }));
      const key = { provider, modelSlug: "claude-sonnet", providerModelName: "claude-sonnet-x" };
      assert.equal((await svc.findEffective(key, new Date("2026-03-01T00:00:00Z")))?.id, a.id);
      assert.equal((await svc.findEffective(key, new Date("2026-06-01T00:00:00Z")))?.id, b.id);
      assert.equal(await svc.findEffective(key, new Date("2025-12-31T00:00:00Z")), undefined);
      const cost = await svc.resolveCost(key, new Date("2026-03-01T00:00:00Z"), { inputTokens: 2000, outputTokens: 1000 });
      assert.deepEqual(cost, { costUsd: 0.021, costBasis: "catalog", priceId: a.id });
      const unknown = await svc.resolveCost({ ...key, providerModelName: "otro" }, new Date("2026-03-01T00:00:00Z"), { inputTokens: 1, outputTokens: 1 });
      assert.equal(unknown.costUsd, null); assert.equal(unknown.costBasis, "unknown");
      const audits = await prisma.auditLog.findMany({ where: { entityType: "AiModelPrice", entityId: { in: [a.id, b.id] } } });
      assert.equal(audits.length, 2);
      assert.equal(audits[0].tenantId, "t_c39");
      assert.ok(audits.some((x: any) => x.beforeJson?.closedPriceId === a.id)); // el cierre queda auditado
    });

    await t.test("no OPS_ADMIN => 403; payload sin sourceUrl https / v1 con metadata => 400", async () => {
      assert.equal(await status(svc.createPrice({ ...ops, roles: ["CLIENT"] }, base({ provider }))), 403);
      assert.equal(await status(svc.createPrice(ops, base({ provider, sourceUrl: "http://x.example" }))), 400);
      assert.equal(await status(svc.createPrice(ops, base({ provider, metadataJson: { cacheReadPer1K: 1 }, effectiveFrom: "2030-01-01T00:00:00Z" }))), 400);
      assert.equal(await status(svc.createPrice(ops, base({ provider, inputPer1K: -1, effectiveFrom: "2030-01-01T00:00:00Z" }))), 400);
    });

    await t.test("solape con una vigencia cerrada (inicio distinto) => 409 por la exclusión de la base", async () => {
      const p2 = `${provider}_ov`;
      await svc.createPrice(ops, base({ provider: p2, effectiveFrom: "2026-01-01T00:00:00Z", effectiveTo: "2026-04-01T00:00:00Z" }));
      assert.equal(await status(svc.createPrice(ops, base({ provider: p2, effectiveFrom: "2026-02-01T00:00:00Z", effectiveTo: "2026-03-01T00:00:00Z" }))), 409);
      // adyacente [from,to) es válido
      assert.equal(await status(svc.createPrice(ops, base({ provider: p2, effectiveFrom: "2026-04-01T00:00:00Z" }))), 200);
    });

    await t.test("effectiveFrom no posterior a la vigencia abierta => 409", async () => {
      const p3 = `${provider}_open`;
      await svc.createPrice(ops, base({ provider: p3, effectiveFrom: "2026-05-01T00:00:00Z" }));
      assert.equal(await status(svc.createPrice(ops, base({ provider: p3, effectiveFrom: "2026-05-01T00:00:00Z" }))), 409);
      assert.equal(await status(svc.createPrice(ops, base({ provider: p3, effectiveFrom: "2026-04-01T00:00:00Z" }))), 409);
    });

    await t.test("CONCURRENCIA: 8 altas simultáneas de la misma clave y mismo inicio => exactamente 1 gana", async () => {
      const p4 = `${provider}_conc`;
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) => status(svc.createPrice(ops, base({ provider: p4, inputPer1K: 0.001 * (i + 1), effectiveFrom: "2026-07-01T00:00:00Z" })))),
      );
      assert.equal(results.filter((s) => s === 200).length, 1, `resultados: ${results.join(",")}`);
      assert.equal(results.filter((s) => s === 409).length, 7);
      assert.equal(await prisma.aiModelPrice.count({ where: { provider: p4 } }), 1);
    });

    await t.test("inmutabilidad en la base: UPDATE de precio, reabrir y DELETE fallan", async () => {
      const row = await prisma.aiModelPrice.findFirst({ where: { provider } , orderBy: { effectiveFrom: "asc" } });
      await assert.rejects(prisma.aiModelPrice.update({ where: { id: row.id }, data: { inputPer1K: 9 } }), /immutable/);
      await assert.rejects(prisma.aiModelPrice.update({ where: { id: row.id }, data: { effectiveTo: null } }), /immutable/);
      await assert.rejects(prisma.aiModelPrice.delete({ where: { id: row.id } }), /immutable/);
    });

    await t.test("el log guarda priceId/costBasis y la FK impide referenciar un precio inexistente", async () => {
      const row = await prisma.aiModelPrice.findFirst({ where: { provider } });
      await prisma.aiInteractionLog.create({ data: { id: `log_${Date.now()}`, taskType: "x", provider, modelSlug: "s", priceId: row.id, costBasis: "catalog", estimatedCostUsd: 0.01 } });
      await assert.rejects(prisma.aiInteractionLog.create({ data: { id: `log2_${Date.now()}`, taskType: "x", provider, modelSlug: "s", priceId: "no-existe", costBasis: "catalog" } }), /Foreign key|foreign key/);
      const unknownLog = await prisma.aiInteractionLog.create({ data: { id: `log3_${Date.now()}`, taskType: "x", provider, modelSlug: "s", costBasis: "unknown" } });
      assert.equal(unknownLog.estimatedCostUsd, null); // unknown => NULL, nunca 0
    });
  } finally {
    await prisma.$disconnect();
  }
});
