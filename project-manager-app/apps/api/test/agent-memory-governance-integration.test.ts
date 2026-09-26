/**
 * C85 — Agent Memory governance, against a real Postgres.
 *
 * Verifies the properties that cannot be trusted from mocked unit tests alone:
 * tenant isolation on every governance mutation (correct/invalidate/supersede/
 * flagConflict), sensitivity-ceiling filtering on retrieval, default exclusion
 * of non-active (superseded/corrected/invalidated) rows, and lineage
 * reconstruction. Skips without DATABASE_URL.
 */
import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "..", "..", "..", ".env") });
loadEnv({ path: path.resolve(__dirname, "..", "..", "..", "packages/db/.env") });

const dbTest = process.env.DATABASE_URL ? test : test.skip;

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function makePrisma() {
  const { PrismaService } = await import("../dist/infrastructure/prisma/prisma.service.js");
  const fakeConfig = { getOrThrow: (key: string) => process.env[key] } as never;
  const prisma = new (PrismaService as new (c: unknown) => InstanceType<typeof PrismaService>)(fakeConfig);
  await prisma.$connect();
  return prisma;
}

async function seedTenant(prisma: { tenant: { create: (args: unknown) => Promise<unknown> } }, tenantId: string) {
  await prisma.tenant.create({ data: { id: tenantId, slug: tenantId, name: `Tenant ${tenantId}` } });
}

dbTest("C85: correct()/invalidate()/supersede()/flagConflict() refuse a mismatched tenantId", async () => {
  const prisma = await makePrisma();
  const { AgentMemoryRepository } = await import("../dist/modules/knowledge/agent-memory.repository.js");
  const repo = new AgentMemoryRepository(prisma as never);

  const tenantA = uid("ten_a");
  const tenantB = uid("ten_b");
  await seedTenant(prisma as never, tenantA);
  await seedTenant(prisma as never, tenantB);

  const mem = await repo.create({
    tenantId: tenantA, orgId: "org_a", agentId: "project-copilot", projectId: "p1",
    type: "fact", content: "Contenido original", summary: "Resumen original",
  });
  const other = await repo.create({
    tenantId: tenantA, orgId: "org_a", agentId: "project-copilot", projectId: "p1",
    type: "fact", content: "Otro", summary: "Otro resumen",
  });

  await assert.rejects(
    () => repo.invalidate({ tenantId: tenantB, id: mem.id, invalidatedBy: "attacker", reason: "cross-tenant probe" }),
    /not found/i,
  );
  await assert.rejects(
    () => repo.correct({ tenantId: tenantB, id: mem.id, correctedBy: "attacker", patch: { content: "hacked" }, reason: "x" }),
    /not found/i,
  );
  await assert.rejects(
    () => repo.supersede({ tenantId: tenantB, oldId: mem.id, newId: other.id }),
    /not found/i,
  );
  await assert.rejects(
    () => repo.flagConflict({ tenantId: tenantB, id: mem.id, conflictsWithId: other.id }),
    /not found/i,
  );

  // Confirm the record was genuinely untouched by the rejected cross-tenant calls.
  const unchanged = await repo.findById({ tenantId: tenantA, id: mem.id });
  assert.equal(unchanged?.status, "active");
  assert.equal(unchanged?.content, "Contenido original");
});

dbTest("C85: invalidate() removes the memory from retrieval without deleting the row", async () => {
  const prisma = await makePrisma();
  const { AgentMemoryRepository } = await import("../dist/modules/knowledge/agent-memory.repository.js");
  const repo = new AgentMemoryRepository(prisma as never);

  const tenantId = uid("ten");
  await seedTenant(prisma as never, tenantId);

  const mem = await repo.create({
    tenantId, orgId: "org_t", agentId: "project-copilot", projectId: "p1",
    type: "decision", content: "Se aprobó el hito 3", summary: "Hito 3 aprobado",
  });

  const before = await repo.listByProject({ tenantId, projectId: "p1" });
  assert.ok(before.some((m) => m.id === mem.id));

  await repo.invalidate({ tenantId, id: mem.id, invalidatedBy: "usr_admin", reason: "dato incorrecto reportado por operador" });

  const after = await repo.listByProject({ tenantId, projectId: "p1" });
  assert.ok(!after.some((m) => m.id === mem.id), "invalidated memory must not surface in default retrieval");

  const withHistory = await repo.listByProject({ tenantId, projectId: "p1", includeInactive: true });
  const row = withHistory.find((m) => m.id === mem.id);
  assert.equal(row?.status, "invalidated");
  assert.equal(row?.invalidationReason, "dato incorrecto reportado por operador");
});

dbTest("C85: correct() never mutates the original row — creates a linked replacement instead", async () => {
  const prisma = await makePrisma();
  const { AgentMemoryRepository } = await import("../dist/modules/knowledge/agent-memory.repository.js");
  const repo = new AgentMemoryRepository(prisma as never);

  const tenantId = uid("ten");
  await seedTenant(prisma as never, tenantId);

  const original = await repo.create({
    tenantId, orgId: "org_t", agentId: "project-copilot", projectId: "p1",
    type: "fact", content: "El worker asignado es usr_123", summary: "Worker asignado: usr_123",
  });

  const replacement = await repo.correct({
    tenantId, id: original.id, correctedBy: "usr_admin",
    patch: { content: "El worker asignado es usr_456", summary: "Worker asignado: usr_456" },
    reason: "usr_123 fue reasignado antes de que se registrara la memoria",
  });

  assert.notEqual(replacement.id, original.id);
  assert.equal(replacement.correctedFromId, original.id);
  assert.equal(replacement.content, "El worker asignado es usr_456");

  const originalAfter = await repo.findById({ tenantId, id: original.id });
  assert.equal(originalAfter?.status, "corrected");
  assert.equal(originalAfter?.content, "El worker asignado es usr_123", "original content must remain untouched for forensic history");
  assert.equal(originalAfter?.supersededById, replacement.id);

  const active = await repo.listByProject({ tenantId, projectId: "p1" });
  assert.ok(!active.some((m) => m.id === original.id));
  assert.ok(active.some((m) => m.id === replacement.id));
});

dbTest("C85: getLineage() reconstructs the correction chain oldest-first", async () => {
  const prisma = await makePrisma();
  const { AgentMemoryRepository } = await import("../dist/modules/knowledge/agent-memory.repository.js");
  const repo = new AgentMemoryRepository(prisma as never);

  const tenantId = uid("ten");
  await seedTenant(prisma as never, tenantId);

  const v1 = await repo.create({
    tenantId, orgId: "org_t", agentId: "project-copilot", projectId: "p1",
    type: "fact", content: "v1", summary: "v1",
  });
  const v2 = await repo.correct({ tenantId, id: v1.id, correctedBy: "usr_a", patch: { content: "v2", summary: "v2" }, reason: "fix 1" });
  const v3 = await repo.correct({ tenantId, id: v2.id, correctedBy: "usr_a", patch: { content: "v3", summary: "v3" }, reason: "fix 2" });

  const lineage = await repo.getLineage({ tenantId, id: v3.id });
  assert.deepEqual(lineage.map((m) => m.content), ["v1", "v2", "v3"]);
});

dbTest("C85: retrieval respects a sensitivity ceiling", async () => {
  const prisma = await makePrisma();
  const { AgentMemoryRepository } = await import("../dist/modules/knowledge/agent-memory.repository.js");
  const repo = new AgentMemoryRepository(prisma as never);

  const tenantId = uid("ten");
  await seedTenant(prisma as never, tenantId);

  await repo.create({
    tenantId, orgId: "org_t", agentId: "project-copilot", projectId: "p1",
    type: "fact", content: "dato público", summary: "dato público", sensitivity: "public",
  });
  await repo.create({
    tenantId, orgId: "org_t", agentId: "project-copilot", projectId: "p1",
    type: "fact", content: "dato confidencial", summary: "dato confidencial", sensitivity: "confidential",
  });

  const restricted = await repo.listByProject({ tenantId, projectId: "p1", maxSensitivity: "public" });
  assert.equal(restricted.length, 1);
  assert.equal(restricted[0]!.sensitivity, "public");

  const unrestricted = await repo.listByProject({ tenantId, projectId: "p1", maxSensitivity: "confidential" });
  assert.equal(unrestricted.length, 2);
});

dbTest("C85: flagConflict() is symmetric and non-destructive", async () => {
  const prisma = await makePrisma();
  const { AgentMemoryRepository } = await import("../dist/modules/knowledge/agent-memory.repository.js");
  const repo = new AgentMemoryRepository(prisma as never);

  const tenantId = uid("ten");
  await seedTenant(prisma as never, tenantId);

  const a = await repo.create({ tenantId, orgId: "org_t", agentId: "a1", projectId: "p1", type: "fact", content: "A dice X", summary: "A" });
  const b = await repo.create({ tenantId, orgId: "org_t", agentId: "a1", projectId: "p1", type: "fact", content: "B dice no-X", summary: "B" });

  await repo.flagConflict({ tenantId, id: a.id, conflictsWithId: b.id });

  const aAfter = await repo.findById({ tenantId, id: a.id });
  const bAfter = await repo.findById({ tenantId, id: b.id });
  assert.ok(aAfter?.conflictsWith.includes(b.id));
  assert.ok(bAfter?.conflictsWith.includes(a.id));
  assert.equal(aAfter?.status, "active", "conflict flagging must not deactivate either memory");
  assert.equal(bAfter?.status, "active");
});

dbTest("C85 (WorkspaceMemoryEntry): tenant isolation + invalidate/correct/lineage mirror AgentMemory", async () => {
  const prisma = await makePrisma();
  const { WorkspaceMemoryRepository } = await import("../dist/modules/knowledge/workspace-memory.repository.js");
  const repo = new WorkspaceMemoryRepository(prisma as never);

  const tenantA = uid("ten_a");
  const tenantB = uid("ten_b");
  await seedTenant(prisma as never, tenantA);
  await seedTenant(prisma as never, tenantB);

  const id = `project:p1:decision:${uid("mem")}`;
  await repo.append({
    id, tenantId: tenantA, orgId: "org_a", createdBy: "usr_a", workspaceId: "project:p1",
    kind: "decision", scope: "task", title: "Hito aprobado", summary: "Resumen",
    tags: [], updatedAtIso: new Date().toISOString(),
  });

  await assert.rejects(
    () => repo.invalidate({ tenantId: tenantB, id, invalidatedBy: "attacker", reason: "probe" }),
    /not found/i,
  );

  const corrected = await repo.correct({
    tenantId: tenantA, id, correctedBy: "usr_admin",
    patch: { summary: "Resumen corregido" },
  });
  assert.equal(corrected.correctedFromId, id);

  const originalAfter = await repo.findById({ tenantId: tenantA, id });
  assert.equal(originalAfter?.status, "corrected");
  assert.equal(originalAfter?.summary, "Resumen", "original summary must remain untouched");

  const lineage = await repo.getLineage({ tenantId: tenantA, id: corrected.id });
  assert.equal(lineage.length, 2);
  assert.equal(lineage[0]!.id, id);
});
