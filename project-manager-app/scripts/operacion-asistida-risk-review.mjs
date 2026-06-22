import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const now = new Date();
const stamp = now.toISOString().replaceAll(":", "").replaceAll(".", "").replace("T", "_");
const evidenceDir = process.env.SEMSE_BCP_EVIDENCE_DIR ?? join("docs", "bcp", "evidence");
const manifestPath = process.env.SEMSE_BCP_MANIFEST_PATH ?? join(evidenceDir, "manifest.json");
const latestPath = process.env.SEMSE_BCP_RISK_REVIEW_PATH ?? join(evidenceDir, "risk-review-latest.json");
const historicalPath = join(evidenceDir, `risk-review-${stamp}.json`);
const staleMinutes = Number(process.env.SEMSE_BCP_MAX_STALENESS_MINUTES ?? 1440);

async function main() {
  const manifest = JSON.parse(await readFile(join(process.cwd(), manifestPath), "utf8"));
  const review = buildRiskReview(manifest);
  await mkdir(dirname(join(process.cwd(), latestPath)), { recursive: true });
  await writeFile(join(process.cwd(), latestPath), `${JSON.stringify(review, null, 2)}\n`, "utf8");
  await writeFile(join(process.cwd(), historicalPath), `${JSON.stringify(review, null, 2)}\n`, "utf8");

  console.log("[review:operacion-asistida:risk] success", {
    latest: latestPath,
    historical: historicalPath,
    severity: review.summary.maxSeverity,
    openRisks: review.risks.filter((risk) => risk.status === "open").length
  });
}

function buildRiskReview(manifest) {
  const latest = manifest.latest ?? null;
  const history = Array.isArray(manifest.history) ? manifest.history : [];
  const latestAgeMinutes =
    latest ? Math.max(0, Math.round((now.getTime() - new Date(latest.generatedAtIso).getTime()) / 60000)) : null;
  const modeCoverage = Array.from(new Set(history.map((entry) => entry.mode))).sort();
  const risks = [];

  if (!latest) {
    risks.push(risk("critical", "missing_latest_drill", "No existe ultimo drill registrado en el manifiesto."));
  }

  if (latest && latest.status !== "pass") {
    risks.push(risk("critical", "latest_drill_failed", "La ultima corrida del drill no paso."));
  }

  if (latestAgeMinutes !== null && latestAgeMinutes > staleMinutes) {
    risks.push(
      risk(
        "high",
        "stale_latest_drill",
        `La ultima evidencia tiene ${latestAgeMinutes} minutos, por encima del umbral ${staleMinutes}.`
      )
    );
  }

  if (!modeCoverage.includes("local")) {
    risks.push(risk("medium", "missing_local_coverage", "No hay evidencia local en el manifiesto."));
  }

  if (!modeCoverage.includes("api")) {
    risks.push(risk("high", "missing_api_coverage", "No hay evidencia API en el manifiesto."));
  }

  const summary = {
    generatedAtIso: now.toISOString(),
    latestMode: latest?.mode ?? null,
    latestStatus: latest?.status ?? null,
    latestAgeMinutes,
    manifestEntries: history.length,
    modeCoverage,
    maxSeverity: maxSeverity(risks)
  };

  return {
    generatedAtIso: now.toISOString(),
    sourceManifest: manifestPath,
    summary,
    risks: risks.length > 0 ? risks : [risk("none", "no_open_risks", "No se detectaron riesgos abiertos en el manifiesto.", "closed")],
    recommendedActions: buildRecommendedActions(risks)
  };
}

function buildRecommendedActions(risks) {
  if (risks.length === 0) {
    return ["Mantener la cadencia actual de drills local y API."];
  }

  const actions = [];
  if (risks.some((entry) => entry.code === "missing_api_coverage")) {
    actions.push("Ejecutar `npm run verify:operacion-asistida:api-local` en el entorno con Postgres/Redis disponible.");
  }
  if (risks.some((entry) => entry.code === "stale_latest_drill")) {
    actions.push("Programar una corrida nueva del drill para refrescar el manifiesto BCP.");
  }
  if (risks.some((entry) => entry.code === "latest_drill_failed")) {
    actions.push("Abrir incidente operativo y revisar la evidencia historica asociada al ultimo fallo.");
  }
  if (actions.length === 0) {
    actions.push("Revisar el manifiesto y confirmar cobertura de drills local/API.");
  }
  return actions;
}

function maxSeverity(risks) {
  const order = ["none", "low", "medium", "high", "critical"];
  return risks.reduce((current, entry) => (order.indexOf(entry.severity) > order.indexOf(current) ? entry.severity : current), "none");
}

function risk(severity, code, summary, status = "open") {
  return { severity, code, summary, status };
}

main().catch((error) => {
  console.error("[review:operacion-asistida:risk] failed", error);
  process.exit(1);
});
