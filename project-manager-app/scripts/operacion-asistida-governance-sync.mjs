import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const now = new Date();
const stamp = now.toISOString().replaceAll(":", "").replaceAll(".", "").replace("T", "_").replace("Z", "Z");
const root = process.cwd();

const riskReviewPath =
  process.env.SEMSE_BCP_RISK_REVIEW_SOURCE_PATH ?? join("docs", "bcp", "evidence", "risk-review-latest.json");
const legacyAuditPath =
  process.env.SEMSE_WORKSPACE_MEMORY_LEGACY_AUDIT_SOURCE_PATH ??
  join("docs", "bcp", "evidence", "workspace-memory-legacy-sync-latest.json");
const governanceLatestPath =
  process.env.SEMSE_OPERACION_ASISTIDA_GOVERNANCE_LATEST_PATH ??
  join("..", "program", "governance", "coherence", "OPERACION_ASISTIDA_RISK_STATUS_LATEST.md");
const governanceHistoricalPath = join(
  "..",
  "program",
  "status",
  "history",
  "operacion-asistida",
  `OPERACION_ASISTIDA_RISK_STATUS_${stamp}.json`
);
const backlogLatestPath =
  process.env.SEMSE_OPERACION_ASISTIDA_BACKLOG_SYNC_LATEST_PATH ??
  join("..", "program", "execution", "history", "backlogs", "OPERACION_ASISTIDA_RISK_BACKLOG_LATEST.md");

async function main() {
  const riskReview = JSON.parse(await readFile(join(root, riskReviewPath), "utf8"));
  const legacyAudit = await readOptionalJson(legacyAuditPath);
  const governancePacket = buildGovernancePacket(riskReview, legacyAudit);

  await writeJson(governanceHistoricalPath, governancePacket);
  await writeText(governanceLatestPath, renderGovernanceMarkdown(governancePacket));
  await writeText(backlogLatestPath, renderBacklogMarkdown(governancePacket));

  console.log("[review:operacion-asistida:governance] success", {
    riskReview: riskReviewPath,
    governanceLatest: governanceLatestPath,
    governanceHistorical: governanceHistoricalPath,
    backlogLatest: backlogLatestPath,
    status: governancePacket.status,
    backlogItems: governancePacket.backlog.length
  });
}

function buildGovernancePacket(riskReview, legacyAudit) {
  const risks = Array.isArray(riskReview.risks) ? riskReview.risks : [];
  const openRisks = risks.filter((entry) => entry.status !== "closed");
  const maxSeverity = riskReview.summary?.maxSeverity ?? "none";
  const legacyRisk = buildLegacyDebtRisk(legacyAudit);
  if (legacyRisk) {
    openRisks.push(legacyRisk);
  }
  const status = deriveStatus(maxSeverityFrom(openRisks, maxSeverity), openRisks.length);
  const backlog = buildBacklog(openRisks, riskReview.recommendedActions ?? []);

  return {
    generatedAtIso: now.toISOString(),
    sourceRiskReview: riskReviewPath,
    sourceLegacyAudit: legacyAudit ? legacyAuditPath : null,
    status,
    summary: {
      maxSeverity: maxSeverityFrom(openRisks, maxSeverity),
      openRisks: openRisks.length,
      latestMode: riskReview.summary?.latestMode ?? null,
      latestStatus: riskReview.summary?.latestStatus ?? null,
      latestAgeMinutes: riskReview.summary?.latestAgeMinutes ?? null,
      modeCoverage: riskReview.summary?.modeCoverage ?? [],
      legacyPendingBackfillRecords: legacyAudit?.summary?.pendingBackfillRecords ?? null
    },
    risks: openRisks,
    backlog
  };
}

function deriveStatus(maxSeverity, openRisks) {
  if (maxSeverity === "critical" || maxSeverity === "high") {
    return "action-required";
  }
  if (maxSeverity === "medium" || openRisks > 0) {
    return "watch";
  }
  return "healthy";
}

function buildBacklog(openRisks, recommendedActions) {
  if (openRisks.length === 0) {
    return [
      {
        priority: "keep",
        title: "Mantener cadencia local/API del modulo operacion asistida",
        rationale: "No hay riesgos abiertos; el objetivo es sostener la disciplina de evidencia y restore."
      }
    ];
  }

  const items = [];
  for (const risk of openRisks) {
    items.push({
      priority: priorityFromSeverity(risk.severity),
      title: titleFromRisk(risk),
      rationale: risk.summary
    });
  }

  for (const action of recommendedActions) {
    items.push({
      priority: "follow-up",
      title: action,
      rationale: "Accion derivada automaticamente desde la revision de riesgo."
    });
  }

  return dedupeBacklog(items);
}

function priorityFromSeverity(severity) {
  if (severity === "critical") {
    return "p0";
  }
  if (severity === "high") {
    return "p1";
  }
  if (severity === "medium") {
    return "p2";
  }
  return "p3";
}

function titleFromRisk(risk) {
  switch (risk.code) {
    case "missing_latest_drill":
      return "Regenerar evidencia BCP del modulo operacion asistida";
    case "latest_drill_failed":
      return "Investigar y corregir el ultimo drill fallido de operacion asistida";
    case "stale_latest_drill":
      return "Refrescar el manifiesto BCP con una corrida nueva del drill";
    case "missing_local_coverage":
      return "Restaurar cobertura local del drill de operacion asistida";
    case "missing_api_coverage":
      return "Restaurar cobertura API del drill de operacion asistida";
    case "workspace_memory_legacy_debt":
      return "Absorber deuda legacy de workspace_memory antes de apagar la lectura dual";
    default:
      return `Atender riesgo operativo ${risk.code}`;
  }
}

function dedupeBacklog(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.priority}:${item.title}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function renderGovernanceMarkdown(packet) {
  const lines = [
    "# Operacion Asistida Risk Status",
    "",
    `- Fecha: ${packet.generatedAtIso}`,
    `- Estado: ${packet.status}`,
    `- Severidad maxima: ${packet.summary.maxSeverity}`,
    `- Riesgos abiertos: ${packet.summary.openRisks}`,
    `- Ultimo modo: ${packet.summary.latestMode ?? "n/a"}`,
    `- Ultimo estado: ${packet.summary.latestStatus ?? "n/a"}`,
    `- Antiguedad del ultimo drill: ${packet.summary.latestAgeMinutes ?? "n/a"} minutos`,
    `- Cobertura: ${(packet.summary.modeCoverage ?? []).join(", ") || "n/a"}`,
    `- Pendientes legacy de workspace_memory: ${packet.summary.legacyPendingBackfillRecords ?? "n/a"}`,
    "",
    "## Riesgos abiertos",
    ""
  ];

  if (packet.risks.length === 0) {
    lines.push("- No hay riesgos abiertos.");
  } else {
    for (const risk of packet.risks) {
      lines.push(`- [${risk.severity}] ${risk.code}: ${risk.summary}`);
    }
  }

  lines.push("", "## Backlog derivado", "");
  for (const item of packet.backlog) {
    lines.push(`- [${item.priority}] ${item.title}`);
    lines.push(`  ${item.rationale}`);
  }

  return `${lines.join("\n")}\n`;
}

function renderBacklogMarkdown(packet) {
  const lines = [
    "# Operacion Asistida Risk Backlog",
    "",
    `- Fuente: ${riskReviewPath}`,
    `- Fecha: ${packet.generatedAtIso}`,
    `- Estado fuente: ${packet.status}`,
    "",
    "## Items",
    ""
  ];

  for (const item of packet.backlog) {
    lines.push(`- [${item.priority}] ${item.title}`);
    lines.push(`  ${item.rationale}`);
  }

  return `${lines.join("\n")}\n`;
}

async function writeJson(relativePath, value) {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(relativePath, value) {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value, "utf8");
}

async function readOptionalJson(relativePath) {
  try {
    return JSON.parse(await readFile(join(root, relativePath), "utf8"));
  } catch {
    return null;
  }
}

function buildLegacyDebtRisk(legacyAudit) {
  const pendingCount = legacyAudit?.summary?.pendingBackfillRecords ?? 0;
  if (!pendingCount) {
    return null;
  }
  return {
    severity: "medium",
    code: "workspace_memory_legacy_debt",
    summary: `Quedan ${pendingCount} registros legacy por absorber desde KnowledgeFact a WorkspaceMemoryEntry.`,
    status: "open"
  };
}

function maxSeverityFrom(risks, fallback) {
  const order = ["none", "low", "medium", "high", "critical"];
  return risks.reduce(
    (current, entry) => (order.indexOf(entry.severity) > order.indexOf(current) ? entry.severity : current),
    fallback
  );
}

main().catch((error) => {
  console.error("[review:operacion-asistida:governance] failed", error);
  process.exit(1);
});
