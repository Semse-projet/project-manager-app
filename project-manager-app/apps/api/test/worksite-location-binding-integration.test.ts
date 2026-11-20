/**
 * OPEN-18 — integridad en PostgreSQL real (docs/specs/core/worksite-location-binding.spec.md §9).
 * Escribe solo en bases aisladas de loopback (CI o opt-in local). Comprueba lo que la fixture
 * en memoria no puede: el índice único del vínculo activo, los CHECK de la migración y la
 * carrera de dos inicios que consumen la misma decisión AUTO_START_ALLOWED.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { LaborEngineRepository } from "../dist/modules/labor-engine/labor-engine.repository.js";

function allowedDisposableDb(): boolean {
  if (!process.env.DATABASE_URL) return false;
  let url: URL;
  try { url = new URL(process.env.DATABASE_URL); }
  catch { return false; }
  if (!["postgresql:", "postgres:"].includes(url.protocol)
      || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      || url.port !== "5433") return false;
  const database = decodeURIComponent(url.pathname.slice(1));
  if (process.env.GITHUB_ACTIONS === "true") {
    return process.env.CI === "true" && url.hostname === "127.0.0.1"
      && url.username === "semse" && database === "semse";
  }
  return process.env.SEMSE_ALLOW_DISPOSABLE_WORKSITE_BINDING_DB === "1"
    && /^semse_(test|e2e)(?:_|$)/.test(database);
}
const dbAllowed = allowedDisposableDb();
if ((process.env.GITHUB_ACTIONS === "true" && !dbAllowed)
  || (process.env.SEMSE_ALLOW_DISPOSABLE_WORKSITE_BINDING_DB === "1" && !dbAllowed)) {
  throw new Error("Worksite binding integration requires isolated loopback PostgreSQL :5433 and a disposable DB");
}
const dbTest = dbAllowed ? test : test.skip;
const prisma = new PrismaClient();
const repository = new LaborEngineRepository(prisma as never, { async ensureActorContext() { /* synthetic */ } } as never);
const uid = (prefix: string) => prefix + "_" + randomUUID().replaceAll("-", "").slice(0, 20);

async function fixture() {
  const tenantId = uid("ten_wsb");
  const orgId = uid("org_wsb");
  const ids = await prisma.$transaction(async (tx) => {
    await tx.tenant.create({ data: { id: tenantId, slug: tenantId, name: "Disposable OPEN-18 Test" } });
    await tx.org.create({ data: { id: orgId, tenantId, type: "PRO", name: "Org OPEN-18" } });
    const job = await tx.job.create({ data: { tenantId, clientOrgId: orgId, title: "Job OPEN-18", scope: "test" } });
    const fp = await tx.freeProject.create({ data: { tenantId, createdBy: "user_wsb", name: "Proyecto OPEN-18" } });
    const ws = await tx.worksite.create({ data: { tenantId, orgId, name: "Obra OPEN-18", createdBy: "user_wsb" } });
    return { jobId: job.id, freeProjectId: fp.id, worksiteId: ws.id };
  });
  return {
    tenantId,
    orgId,
    ...ids,
    async cleanup() {
      await prisma.timeEntry.deleteMany({ where: { tenantId } });
      await prisma.geofenceEvent.deleteMany({ where: { tenantId } });
      await prisma.worksiteBinding.deleteMany({ where: { tenantId } });
      await prisma.worksite.deleteMany({ where: { tenantId } });
      await prisma.freeProject.deleteMany({ where: { tenantId } });
      await prisma.job.deleteMany({ where: { tenantId } });
      await prisma.org.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
  };
}

const errorText = (e: unknown) => `${(e as { code?: string }).code ?? ""} ${(e as Error).message ?? ""}`;

dbTest("PG-01 un solo vínculo ACTIVE por objetivo; terminado, el objetivo se puede volver a vincular", async () => {
  const f = await fixture();
  try {
    const key = `${f.tenantId}:JOB:${f.jobId}`;
    const base = { tenantId: f.tenantId, orgId: f.orgId, worksiteId: f.worksiteId, kind: "JOB", jobId: f.jobId, createdBy: "user_wsb" };
    const first = await prisma.worksiteBinding.create({ data: { ...base, activeTargetKey: key } });
    await assert.rejects(prisma.worksiteBinding.create({ data: { ...base, activeTargetKey: key } }), (e) => errorText(e).includes("P2002"));
    await prisma.worksiteBinding.update({ where: { id: first.id }, data: { status: "ENDED", activeTargetKey: null, endedAt: new Date() } });
    const second = await prisma.worksiteBinding.create({ data: { ...base, activeTargetKey: key } });
    assert.notEqual(second.id, first.id);
  } finally {
    await f.cleanup();
  }
});

dbTest("PG-02 los CHECK rechazan objetivo incoherente con kind, ACTIVE sin clave, ENDED con clave y radio fuera de 50–1000 m", async () => {
  const f = await fixture();
  try {
    const base = { tenantId: f.tenantId, orgId: f.orgId, worksiteId: f.worksiteId, createdBy: "user_wsb" };
    const isCheck = (e: unknown) => /check constraint|23514/i.test(errorText(e));
    await assert.rejects(
      prisma.worksiteBinding.create({ data: { ...base, kind: "JOB", freeProjectId: f.freeProjectId, activeTargetKey: uid("k") } }),
      isCheck
    );
    await assert.rejects(
      prisma.worksiteBinding.create({ data: { ...base, kind: "JOB", jobId: f.jobId, freeProjectId: f.freeProjectId, activeTargetKey: uid("k") } }),
      isCheck
    );
    await assert.rejects(prisma.worksiteBinding.create({ data: { ...base, kind: "JOB", jobId: f.jobId } }), isCheck);
    await assert.rejects(
      prisma.worksiteBinding.create({ data: { ...base, kind: "JOB", jobId: f.jobId, status: "ENDED", activeTargetKey: uid("k") } }),
      isCheck
    );
    await assert.rejects(prisma.worksite.update({ where: { id: f.worksiteId }, data: { radiusMeters: 20 } }), isCheck);
    await assert.rejects(prisma.worksite.update({ where: { id: f.worksiteId }, data: { radiusMeters: 5000 } }), isCheck);
    const ok = await prisma.worksite.update({ where: { id: f.worksiteId }, data: { radiusMeters: 150 } });
    assert.equal(ok.radiusMeters, 150);
  } finally {
    await f.cleanup();
  }
});

dbTest("PG-03 dos inicios simultáneos con la misma decisión AUTO_START_ALLOWED: uno gana, el otro 409 y sin TimeEntry extra", async () => {
  const f = await fixture();
  try {
    const event = await prisma.geofenceEvent.create({
      data: {
        tenantId: f.tenantId, orgId: f.orgId, userId: "user_wsb", eventId: uid("evt"), type: "ARRIVAL",
        worksiteId: f.worksiteId, decision: "AUTO_START_ALLOWED", reason: "test", mode: "AUTO", policyVersion: 1,
        accuracyBucket: "GOOD", occurredAt: new Date()
      }
    });
    const entry = {
      tenantId: f.tenantId, orgId: f.orgId, createdBy: "user_wsb", purpose: "job_linked", jobId: f.jobId,
      checkInLatitude: 19.43, checkInLongitude: -99.13, checkInMethod: "proximity_auto"
    };
    const decision = { geofenceEventId: event.id, notBefore: new Date(Date.now() - 10 * 60_000) };
    const results = await Promise.allSettled([
      repository.startRealtimeEntryConsumingDecision(entry, decision),
      repository.startRealtimeEntryConsumingDecision(entry, decision)
    ]);
    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    assert.equal(won.length, 1);
    assert.equal(lost.length, 1);
    assert.equal((lost[0].reason as { status?: number }).status ?? (lost[0].reason as { getStatus?: () => number }).getStatus?.(), 409);
    const entries = await prisma.timeEntry.findMany({ where: { tenantId: f.tenantId } });
    assert.equal(entries.length, 1);
    const stored = await prisma.geofenceEvent.findUnique({ where: { id: event.id } });
    assert.equal(stored?.consumedByTimeEntryId, entries[0].id);
  } finally {
    await f.cleanup();
  }
});

dbTest("PG-04 una decisión vencida o no AUTO_START_ALLOWED no se consume y no deja TimeEntry", async () => {
  const f = await fixture();
  try {
    const mk = (decision: string, createdAt: Date) => prisma.geofenceEvent.create({
      data: {
        tenantId: f.tenantId, orgId: f.orgId, userId: "user_wsb", eventId: uid("evt"), type: "ARRIVAL",
        worksiteId: f.worksiteId, decision, reason: "test", mode: "AUTO", policyVersion: 1,
        accuracyBucket: "GOOD", occurredAt: createdAt, createdAt
      }
    });
    const old = await mk("AUTO_START_ALLOWED", new Date(Date.now() - 11 * 60_000));
    const prompt = await mk("PROMPT", new Date());
    const entry = { tenantId: f.tenantId, orgId: f.orgId, createdBy: "user_wsb", purpose: "job_linked", jobId: f.jobId };
    const notBefore = new Date(Date.now() - 10 * 60_000);
    await assert.rejects(repository.startRealtimeEntryConsumingDecision(entry, { geofenceEventId: old.id, notBefore }));
    await assert.rejects(repository.startRealtimeEntryConsumingDecision(entry, { geofenceEventId: prompt.id, notBefore }));
    assert.equal(await prisma.timeEntry.count({ where: { tenantId: f.tenantId } }), 0);
  } finally {
    await f.cleanup();
  }
});

dbTest("PG-05 si la revalidación dentro de la transacción rechaza (revocación concurrente), no se consume la decisión ni queda TimeEntry", async () => {
  const f = await fixture();
  try {
    const event = await prisma.geofenceEvent.create({
      data: {
        tenantId: f.tenantId, orgId: f.orgId, userId: "user_wsb", eventId: uid("evt"), type: "ARRIVAL",
        worksiteId: f.worksiteId, decision: "AUTO_START_ALLOWED", reason: "test", mode: "AUTO", policyVersion: 1,
        accuracyBucket: "GOOD", occurredAt: new Date()
      }
    });
    const entry = { tenantId: f.tenantId, orgId: f.orgId, createdBy: "user_wsb", purpose: "job_linked", jobId: f.jobId };
    await assert.rejects(repository.startRealtimeEntryConsumingDecision(entry, {
      geofenceEventId: event.id,
      notBefore: new Date(Date.now() - 10 * 60_000),
      revalidate: async (tx: any) => {
        // La revalidación lee dentro de la transacción; aquí simula que el acceso ya no vale.
        const stillActive = await tx.worksiteBinding.count({ where: { tenantId: f.tenantId, status: "ACTIVE" } });
        if (stillActive === 0) throw Object.assign(new Error("revoked"), { status: 409 });
      }
    }), (e) => (e as { status?: number }).status === 409);
    assert.equal(await prisma.timeEntry.count({ where: { tenantId: f.tenantId } }), 0);
    const stored = await prisma.geofenceEvent.findUnique({ where: { id: event.id } });
    assert.equal(stored?.consumedByTimeEntryId, null);
  } finally {
    await f.cleanup();
  }
});

test.after(async () => {
  await prisma.$disconnect();
});
