import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { config as loadEnv } from "dotenv";
import prismaClientPackage from "../node_modules/.prisma/client/index.js";

const { PrismaClient } = prismaClientPackage;

if (!process.env.DATABASE_URL) {
  loadEnv({ path: join(process.cwd(), ".env") });
  loadEnv({ path: join(process.cwd(), "packages", "db", ".env"), override: false });
}

const now = new Date();
const stamp = now.toISOString().replaceAll(":", "").replaceAll(".", "").replace("T", "_").replace("Z", "Z");
const evidenceDir = process.env.SEMSE_BCP_EVIDENCE_DIR ?? join("docs", "bcp", "evidence");
const latestPath =
  process.env.SEMSE_WORKSPACE_MEMORY_LEGACY_SYNC_REPORT_PATH ??
  join(evidenceDir, "workspace-memory-legacy-sync-latest.json");
const historicalPath = join(evidenceDir, `workspace-memory-legacy-sync-${stamp}.json`);
const applyChanges = process.env.SEMSE_WORKSPACE_MEMORY_LEGACY_APPLY === "true";

async function main() {
  const prisma = new PrismaClient({ log: ["error"] });

  try {
    const facts = await prisma.knowledgeFact.findMany({
      where: {
        predicate: {
          startsWith: "workspace_memory."
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 5000
    });

    const parsed = facts
      .map((fact) => parseFact(fact))
      .filter((record) => record !== null);

    const uniqueParsed = dedupeById(parsed);
    const existingEntries = await prisma.workspaceMemoryEntry.findMany({
      where: {
        id: {
          in: uniqueParsed.map((record) => record.id)
        }
      },
      select: {
        id: true
      }
    });

    const existingIds = new Set(existingEntries.map((entry) => entry.id));
    const pending = uniqueParsed.filter((record) => !existingIds.has(record.id));
    let migrated = 0;

    if (applyChanges) {
      for (const record of pending) {
        await prisma.workspaceMemoryEntry.upsert({
          where: { id: record.id },
          create: toEntryCreate(record),
          update: toEntryUpdate(record)
        });
        migrated += 1;
      }
    }

    const report = {
      generatedAtIso: now.toISOString(),
      mode: applyChanges ? "apply" : "dry-run",
      summary: {
        legacyFacts: facts.length,
        parsableLegacyFacts: parsed.length,
        uniqueLegacyRecords: uniqueParsed.length,
        existingDedicatedRecords: existingIds.size,
        pendingBackfillRecords: pending.length,
        migratedRecords: migrated
      },
      pendingSample: pending.slice(0, 20).map((record) => ({
        id: record.id,
        tenantId: record.tenantId,
        workspaceId: record.workspaceId,
        runId: record.runId ?? null,
        taskId: record.taskId ?? null,
        updatedAtIso: record.updatedAtIso
      })),
      recommendations: buildRecommendations({ pendingCount: pending.length, applyChanges, migrated })
    };

    await mkdir(dirname(join(process.cwd(), latestPath)), { recursive: true });
    await writeFile(join(process.cwd(), latestPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(join(process.cwd(), historicalPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");

    console.log("[audit:operacion-asistida:workspace-memory-legacy] success", {
      latest: latestPath,
      historical: historicalPath,
      mode: report.mode,
      pendingBackfillRecords: pending.length,
      migratedRecords: migrated
    });
  } finally {
    await prisma.$disconnect();
  }
}

function parseFact(fact) {
  try {
    const payload = JSON.parse(fact.object);
    if (!payload || typeof payload !== "object" || typeof payload.id !== "string") {
      return null;
    }
    if (typeof payload.workspaceId !== "string" || typeof payload.tenantId !== "string") {
      return null;
    }
    return {
      id: payload.id,
      tenantId: payload.tenantId ?? fact.tenantId,
      orgId: payload.orgId ?? "org_legacy_unknown",
      createdBy: payload.createdBy ?? fact.createdBy,
      workspaceId: payload.workspaceId,
      repoId: payload.repoId ?? null,
      runId: payload.runId ?? null,
      taskId: payload.taskId ?? null,
      kind: payload.kind ?? "runtime_fact",
      scope: payload.scope ?? "workspace",
      title: payload.title ?? "Recovered legacy workspace memory",
      summary: payload.summary ?? payload.title ?? "Recovered legacy workspace memory",
      body: payload.body ?? null,
      tags: Array.isArray(payload.tags) ? payload.tags.filter((tag) => typeof tag === "string") : [],
      sourceRef: payload.sourceRef ?? null,
      updatedAtIso: typeof payload.updatedAtIso === "string" ? payload.updatedAtIso : fact.createdAt.toISOString()
    };
  } catch {
    return null;
  }
}

function dedupeById(records) {
  const latestById = new Map();
  for (const record of records) {
    const current = latestById.get(record.id);
    if (!current || record.updatedAtIso > current.updatedAtIso) {
      latestById.set(record.id, record);
    }
  }
  return Array.from(latestById.values());
}

function toEntryCreate(record) {
  return {
    id: record.id,
    tenantId: record.tenantId,
    orgId: record.orgId,
    createdBy: record.createdBy,
    workspaceId: record.workspaceId,
    repoId: record.repoId,
    runId: record.runId,
    taskId: record.taskId,
    kind: record.kind,
    scope: record.scope,
    title: record.title,
    summary: record.summary,
    body: record.body,
    tags: record.tags,
    sourceRef: record.sourceRef
  };
}

function toEntryUpdate(record) {
  return {
    orgId: record.orgId,
    createdBy: record.createdBy,
    repoId: record.repoId,
    runId: record.runId,
    taskId: record.taskId,
    kind: record.kind,
    scope: record.scope,
    title: record.title,
    summary: record.summary,
    body: record.body,
    tags: record.tags,
    sourceRef: record.sourceRef
  };
}

function buildRecommendations({ pendingCount, applyChanges, migrated }) {
  if (pendingCount === 0) {
    return [
      "No hay registros legacy pendientes de absorber. Ya se puede planificar el retiro gradual de la lectura desde KnowledgeFact."
    ];
  }
  if (!applyChanges) {
    return [
      "Ejecutar con SEMSE_WORKSPACE_MEMORY_LEGACY_APPLY=true para absorber registros legacy faltantes.",
      "Mantener la lectura dual hasta que el pendingBackfillRecords llegue a cero."
    ];
  }
  return [
    `Se migraron ${migrated} registros. Repetir la auditoria en dry-run para confirmar que pendingBackfillRecords quedo en cero.`,
    "Cuando el audit confirme cero pendientes, planificar el apagado gradual del reader legacy."
  ];
}

main().catch((error) => {
  console.error("[audit:operacion-asistida:workspace-memory-legacy] failed", error);
  process.exit(1);
});
