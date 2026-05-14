#!/usr/bin/env node
/**
 * ══════════════════════════════════════════════════════════════════
 * SEMSE NERVOUS SYSTEM — Health Check v2
 * Sistema nervioso del ecosistema SEMSE
 *
 * Opera 100% sobre etiquetas, notas y STATUS.md existentes.
 * NO ejecuta código. NO modifica archivos del proyecto.
 * Solo lee, analiza y reporta — como el sistema nervioso del cuerpo.
 *
 * Uso:
 *   node scripts/semse-health-check.mjs
 *   node scripts/semse-health-check.mjs --verbose
 *   node scripts/semse-health-check.mjs --full      (incluye análisis de visión)
 *   node scripts/semse-health-check.mjs --json      (exporta también JSON)
 *
 * Salida: _governance/reports/YYYY-MM-DD_health.md
 *         _governance/reports/YYYY-MM-DD_health.json (con --json)
 * ══════════════════════════════════════════════════════════════════
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, "..");
const GOV       = join(ROOT, "_governance");
const GOV_STATUS = join(GOV, "status");
const GOV_DIST   = join(GOV, "distillation");
const GOV_LOGS   = join(GOV, "logs");
const REPORTS   = join(GOV, "reports");
const SATELLITES = join(ROOT, "app semse", "_satellites-archive");
const CANONICAL  = join(ROOT, "project-manager-app");
const VISION_DIR = join(ROOT, "vision");
const PROGRAM_DIR = join(ROOT, "program");
const CONSTITUTION_DIR = join(ROOT, "constitution");

const VERBOSE  = process.argv.includes("--verbose");
const FULL     = process.argv.includes("--full");
const JSON_OUT = process.argv.includes("--json");

const now     = new Date();
const dateStr = now.toISOString().split("T")[0];
const timeStr = now.toTimeString().split(" ")[0];

// ─── Colores en consola ───────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  red:   "\x1b[31m",
  green: "\x1b[32m",
  yellow:"\x1b[33m",
  blue:  "\x1b[34m",
  cyan:  "\x1b[36m",
  bold:  "\x1b[1m",
  dim:   "\x1b[2m",
};
const bold  = s => `${C.bold}${s}${C.reset}`;
const red   = s => `${C.red}${s}${C.reset}`;
const green = s => `${C.green}${s}${C.reset}`;
const yellow= s => `${C.yellow}${s}${C.reset}`;
const cyan  = s => `${C.cyan}${s}${C.reset}`;
const dim   = s => `${C.dim}${s}${C.reset}`;

function log(msg)    { if (VERBOSE) console.log(dim(`  [debug] ${msg}`)); }
function step(msg)   { console.log(cyan(`  ▸ ${msg}`)); }
function warn(msg)   { console.log(yellow(`  ⚠  ${msg}`)); }
function err(msg)    { console.log(red(`  ✖  ${msg}`)); }
function ok(msg)     { console.log(green(`  ✔  ${msg}`)); }

// ─── Utilidades ───────────────────────────────────────────────────

function readSafe(path) {
  try { return readFileSync(path, "utf-8"); } catch { return null; }
}

function parseFrontmatter(content) {
  if (!content?.startsWith("---")) return {};
  const end = content.indexOf("\n---", 3);
  if (end === -1) return {};
  const yaml = content.slice(4, end).trim();
  const result = {};
  for (const line of yaml.split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
    result[key] = val;
  }
  return result;
}

function extractSection(content, heading) {
  if (!content) return null;
  const rx = new RegExp(`##\\s+${heading}[\\s\\S]*?(?=\\n##|$)`, "i");
  const m = content.match(rx);
  return m ? m[0].replace(/^##[^\n]+\n/, "").trim() : null;
}

function countMatches(content, pattern) {
  return (content?.match(new RegExp(pattern, "gi")) || []).length;
}

function daysSince(dateString) {
  if (!dateString) return null;
  const d = new Date(dateString);
  return Math.floor((now - d) / (1000 * 60 * 60 * 24));
}

function runCmd(cmd) {
  try { return execSync(cmd, { cwd: CANONICAL, stdio: "pipe" }).toString().trim(); }
  catch { return null; }
}

// ─── 1. Leer satellites ───────────────────────────────────────────

function readSatellites() {
  step("Leyendo satellites...");
  if (!existsSync(SATELLITES)) { warn("Carpeta _satellites-archive no encontrada"); return []; }

  return readdirSync(SATELLITES)
    .filter(e => statSync(join(SATELLITES, e)).isDirectory())
    .map(name => {
      const dir     = join(SATELLITES, name);
      const content = readSafe(join(dir, "STATUS.md"));
      const fm      = parseFrontmatter(content || "");

      if (!content) {
        warn(`${name} no tiene STATUS.md`);
        return { name, hasStatus: false, status: "UNKNOWN", priority: "UNKNOWN",
                 distillationStatus: "UNKNOWN", sprintTarget: null,
                 lastUpdated: null, staleDays: null, blockers: [], warnings: [],
                 pendingItems: [], nextStep: "Crear STATUS.md", collisions: [] };
      }

      const staleDays = daysSince(fm.last_updated);
      const blockers  = (content.match(/🔴[^\n]*/g) || []).map(s => s.replace("🔴 ", "").trim());
      const warnings  = (content.match(/🟡[^\n]*/g) || []).map(s => s.replace("🟡 ", "").trim());
      const pending   = (content.match(/⏳ PENDIENTE[^\n]*/g) || []);
      const nextStep  = extractSection(content, "Siguiente paso concreto") ||
                        extractSection(content, "Siguiente paso") || "No especificado";

      log(`${name}: status=${fm.status}, priority=${fm.priority}, staleDays=${staleDays}`);

      return {
        name,
        hasStatus: true,
        status:             fm.status         || "UNKNOWN",
        distillationStatus: fm.distillation_status || "UNKNOWN",
        priority:           fm.priority       || "UNKNOWN",
        sprintTarget:       fm.sprint_target  || null,
        canonical:          fm.canonical === "true",
        lastUpdated:        fm.last_updated   || null,
        staleDays,
        stale:              staleDays !== null && staleDays > 14,
        blockers,
        warnings,
        pendingItems: pending,
        nextStep: nextStep.split("\n")[0]?.trim() || "No especificado",
        collisions: fm.collisions ? fm.collisions.split(",").map(s => s.trim()).filter(Boolean) : [],
        pendingDistillation: (fm.distillation_status || "").includes("PENDING"),
        fullyDistilled:      (fm.distillation_status || "").includes("COMPLETE"),
        referenceOnly:       (fm.status || "").includes("FROZEN") &&
                             (fm.distillation_status || "") === "NONE",
      };
    });
}

// ─── 2. Leer estado canónico ──────────────────────────────────────

function readCanonicalState() {
  step("Analizando estado del canónico...");

  const ecosys   = readSafe(join(GOV_STATUS, "ECOSYSTEM_STATUS.md")) || "";
  const backlog  = readSafe(join(CONSTITUTION_DIR, "08_SPRINT_BACKLOG.md")) || "";
  const pkgJson  = readSafe(join(CANONICAL, "package.json"));
  const schema   = readSafe(join(CANONICAL, "packages", "db", "prisma", "schema.prisma"));

  // Sprint
  const sprintActual   = ecosys.match(/\*\*Sprint actual:\*\*\s+(.+)/)?.[1]?.trim();
  const sprintSiguiente = ecosys.match(/\*\*Sprint siguiente:\*\*\s+(.+)/)?.[1]?.trim();

  // Cuellos de botella del ECOSYSTEM_STATUS
  const bottlenecks = (ecosys.match(/🔴[^\n]*/g) || []).map(b => b.replace("🔴 ", "").trim());

  // Archivos clave
  const buildExists   = existsSync(join(CANONICAL, "apps", "api", "dist", "main.js"));
  const schemaExists  = !!schema;
  const migrationsDirExists = existsSync(join(CANONICAL, "packages", "db", "prisma", "migrations"));

  // Git status
  const gitBranch    = runCmd("git branch --show-current");
  const gitStatus    = runCmd("git status --porcelain");
  const gitAhead     = runCmd("git rev-list @{u}..HEAD --count 2>/dev/null") || "0";
  const uncommitted  = gitStatus ? gitStatus.split("\n").filter(Boolean).length : 0;

  // TODO/FIXME en código canónico
  const srcDir = join(CANONICAL, "apps", "api", "src");
  let todoCount = 0, fixmeCount = 0;
  if (existsSync(srcDir)) {
    try {
      const res = execSync(`grep -r "TODO\\|FIXME\\|HACK\\|XXX" --include="*.ts" -l "${srcDir}" 2>/dev/null || true`).toString();
      const files = res.trim().split("\n").filter(Boolean);
      todoCount  = files.length;
    } catch { /* ignore */ }
  }

  // Modelos nuevos en schema sin migración
  const hasPendingMigration = schema?.includes("RefreshToken") &&
    (!migrationsDirExists ||
     !readdirSync(join(CANONICAL, "packages", "db", "prisma", "migrations") )
       .some(f => f.includes("refresh_token") || f.includes("sprint21")));

  // Calcular health score del canónico (0-100)
  let healthScore = 100;
  if (!buildExists)        healthScore -= 30;
  if (hasPendingMigration) healthScore -= 15;
  if (uncommitted > 5)     healthScore -= 10;
  if (parseInt(gitAhead) > 3) healthScore -= 5;
  if (bottlenecks.length > 2) healthScore -= 10;
  healthScore = Math.max(0, healthScore);

  log(`Canonical: build=${buildExists}, uncommitted=${uncommitted}, ahead=${gitAhead}, health=${healthScore}`);

  return {
    sprintActual, sprintSiguiente, bottlenecks,
    buildExists, schemaExists, migrationsDirExists,
    hasPendingMigration,
    gitBranch, uncommitted, gitAhead: parseInt(gitAhead) || 0,
    todoCount, healthScore,
    version: pkgJson ? JSON.parse(pkgJson).version : "N/A",
  };
}

// ─── 3. Leer queue y log ──────────────────────────────────────────

function readDistillationData() {
  step("Leyendo queue y log de destilación...");

  const queueContent = readSafe(join(GOV_DIST, "DISTILLATION_QUEUE.md")) || "";
  const logContent   = readSafe(join(GOV_DIST, "DISTILLATION_LOG.md"))   || "";

  const queueItems = [];
  for (const section of queueContent.split(/^###/m).slice(1)) {
    const name   = section.match(/^[^\n]+/)?.[0]?.trim() || "Desconocido";
    const sprint = section.match(/Sprint\s+([\d.]+)/)?.[1];
    const origin = section.match(/\*\*Origen:\*\*\s+`([^`]+)`/)?.[1];
    const dest   = section.match(/\*\*Destino canónico:\*\*\s+`([^`]+)`/)?.[1];
    const estado = section.match(/\*\*Estado:\*\*\s+(.+)/)?.[1]?.trim();
    queueItems.push({ name, sprint, origin, dest, estado });
  }

  const logEntries = (logContent.match(/^###[^\n]+/gm) || []).length;
  const successfulDistillations = countMatches(logContent, "EXITOSA");
  const failedDistillations     = countMatches(logContent, "REVERTIDA|PARCIAL");

  return { queueItems, logEntries, successfulDistillations, failedDistillations };
}

// ─── 4. Análisis de visión y alineación ──────────────────────────

function readVisionAlignment() {
  if (!FULL) return { checked: false };
  step("Analizando alineación con visión...");

  const kernel     = readSafe(join(CONSTITUTION_DIR, "01_KERNEL.md"))            || "";
  const roadmap    = readSafe(join(CONSTITUTION_DIR, "06_EXECUTION_ROADMAP.md")) || "";
  const backlog    = readSafe(join(CONSTITUTION_DIR, "08_SPRINT_BACKLOG.md"))    || "";
  const visionSum  = readSafe(join(VISION_DIR, "VISION_EXECUTIVE_SUMMARY.md")) || "";
  const pillars    = readSafe(join(VISION_DIR, "VISION_PILLARS.md")) || "";

  // Extraer pilares de visión mencionados
  const pillarMentions = (pillars.match(/##\s+[^\n]+/g) || []).map(s => s.replace("## ", "").trim());

  // Verificar si los pilares tienen implementación en el canónico
  const canonicalModules = existsSync(join(CANONICAL, "apps", "api", "src", "modules"))
    ? readdirSync(join(CANONICAL, "apps", "api", "src", "modules"))
    : [];

  const coreModulesInVision = pillarMentions.filter(p =>
    canonicalModules.some(m => p.toLowerCase().includes(m.toLowerCase()))
  );

  // Detectar features mencionadas en visión pero no en backlog
  const visionKeywords = ["marketplace", "escrow", "trust", "agents", "field-ops", "payments", "disputes"];
  const backlogKeywords = visionKeywords.filter(k => backlog.toLowerCase().includes(k));
  const missingInBacklog = visionKeywords.filter(k => !backlog.toLowerCase().includes(k));

  log(`Vision pillars: ${pillarMentions.length}, canonical modules: ${canonicalModules.length}`);

  return {
    checked: true,
    pillarCount: pillarMentions.length,
    pillars: pillarMentions.slice(0, 5),
    canonicalModuleCount: canonicalModules.length,
    canonicalModules,
    visionKeywords: visionKeywords.length,
    coveredInBacklog: backlogKeywords.length,
    missingInBacklog,
    alignmentScore: Math.round((backlogKeywords.length / visionKeywords.length) * 100),
  };
}

// ─── 5. Detectar colisiones ───────────────────────────────────────

function detectCollisions(satellites, queue, canonical) {
  step("Detectando colisiones y conflictos...");
  const collisions = [];

  // C1: Satellite sin STATUS.md
  const noStatus = satellites.filter(s => !s.hasStatus);
  if (noStatus.length > 0) {
    collisions.push({
      id: "C001", type: "MISSING_STATUS", severity: "WARNING",
      message: `${noStatus.length} satellite(s) sin STATUS.md: ${noStatus.map(s => s.name).join(", ")}`,
      action: "Ejecutar: crear STATUS.md con frontmatter YAML en cada satellite indicado",
      affected: noStatus.map(s => s.name),
    });
  }

  // C2: STATUS.md stale (no actualizado en +14 días)
  const stale = satellites.filter(s => s.stale && s.hasStatus);
  if (stale.length > 0) {
    collisions.push({
      id: "C002", type: "STALE_STATUS", severity: "INFO",
      message: `${stale.length} STATUS.md sin actualizar hace +14 días: ${stale.map(s => `${s.name} (${s.staleDays}d)`).join(", ")}`,
      action: "Revisar si el estado del satellite cambió y actualizar last_updated en el frontmatter",
      affected: stale.map(s => s.name),
    });
  }

  // C3: Items en queue sin sprint asignado
  const noSprint = queue.queueItems.filter(i => !i.sprint || i.sprint === "?");
  if (noSprint.length > 0) {
    collisions.push({
      id: "C003", type: "UNSCHEDULED_DISTILLATION", severity: "INFO",
      message: `${noSprint.length} ítem(s) en DISTILLATION_QUEUE sin sprint asignado`,
      action: "Asignar sprint_target en `_governance/distillation/DISTILLATION_QUEUE.md` para cada ítem sin sprint",
      affected: noSprint.map(i => i.name),
    });
  }

  // C4: Migración DB pendiente
  if (canonical.hasPendingMigration) {
    collisions.push({
      id: "C004", type: "PENDING_DB_MIGRATION", severity: "ERROR",
      message: "Schema Prisma tiene modelos nuevos (RefreshToken, BidStatus.WITHDRAWN) sin migración ejecutada",
      action: `cd 'project-manager-app' && pnpm --filter @semse/db prisma migrate dev --name sprint21_refresh_tokens_bid_withdrawn`,
      affected: ["project-manager-app/packages/db"],
    });
  }

  // C5: Build no disponible
  if (!canonical.buildExists) {
    collisions.push({
      id: "C005", type: "NO_BUILD", severity: "ERROR",
      message: "No existe build del canónico — apps/api/dist/main.js no encontrado",
      action: "cd 'project-manager-app' && pnpm build:api",
      affected: ["project-manager-app/apps/api"],
    });
  }

  // C6: Commits sin pushear
  if (canonical.gitAhead > 0) {
    collisions.push({
      id: "C006", type: "UNPUSHED_COMMITS", severity: "WARNING",
      message: `${canonical.gitAhead} commit(s) en rama '${canonical.gitBranch}' sin pushear a remoto`,
      action: "git push cuando el trabajo esté listo y los smokes pasen",
      affected: ["project-manager-app (git)"],
    });
  }

  // C7: Satellite con distillation_status=PENDING pero sin sprint_target
  const pendingNoSprint = satellites.filter(s =>
    s.pendingDistillation && (!s.sprintTarget || s.sprintTarget === "null")
  );
  if (pendingNoSprint.length > 0) {
    collisions.push({
      id: "C007", type: "PENDING_DISTILLATION_NO_SPRINT", severity: "WARNING",
      message: `${pendingNoSprint.length} satellite(s) PENDING_DISTILLATION sin sprint_target en frontmatter`,
      action: "Agregar sprint_target en el frontmatter YAML de STATUS.md",
      affected: pendingNoSprint.map(s => s.name),
    });
  }

  log(`Colisiones detectadas: ${collisions.length}`);
  return collisions;
}

// ─── 6. Calcular health score global ─────────────────────────────

function calculateGlobalHealth(canonical, satellites, collisions, distillation) {
  let score = 100;
  const deductions = [];

  // Por colisiones
  const errors   = collisions.filter(c => c.severity === "ERROR").length;
  const warnings = collisions.filter(c => c.severity === "WARNING").length;
  score -= errors * 15;
  score -= warnings * 5;
  if (errors)   deductions.push(`-${errors * 15} por ${errors} error(es) críticos`);
  if (warnings) deductions.push(`-${warnings * 5} por ${warnings} advertencia(s)`);

  // Por salud del canónico
  const canonicalDiff = 100 - canonical.healthScore;
  if (canonicalDiff > 0) {
    score -= Math.floor(canonicalDiff * 0.3);
    deductions.push(`-${Math.floor(canonicalDiff * 0.3)} por salud del canónico (${canonical.healthScore}/100)`);
  }

  // Por satellites pendientes de destilación de alta prioridad
  const highPriorityPending = satellites.filter(s => s.pendingDistillation && s.priority === "HIGH").length;
  if (highPriorityPending > 0) {
    score -= highPriorityPending * 5;
    deductions.push(`-${highPriorityPending * 5} por ${highPriorityPending} satellite(s) HIGH priority pendientes`);
  }

  return { score: Math.max(0, score), deductions };
}

// ─── 7. Generar recomendaciones ───────────────────────────────────

function generateRecommendations(canonical, satellites, collisions, queue, vision) {
  const recs = [];

  // Prioridad 1: Errores críticos
  for (const c of collisions.filter(c => c.severity === "ERROR")) {
    recs.push({ priority: 1, icon: "🔴", text: `[${c.id}] ${c.message}`, action: c.action });
  }

  // Prioridad 2: Migración DB pendiente (si no está en errores ya)
  if (canonical.hasPendingMigration && !collisions.some(c => c.id === "C004")) {
    recs.push({ priority: 1, icon: "🔴", text: "Migración DB pendiente", action: "pnpm --filter @semse/db prisma migrate dev" });
  }

  // Prioridad 3: Sprint siguiente definido
  if (canonical.sprintSiguiente) {
    const sprintNum = canonical.sprintSiguiente.match(/\d+\.\d+/)?.[0];
    const pendingForSprint = satellites.filter(s => s.sprintTarget === `"${sprintNum}"`);
    if (pendingForSprint.length > 0) {
      recs.push({
        priority: 2, icon: "🟡",
        text: `Antes de Sprint ${sprintNum}: revisar ${pendingForSprint.map(s => s.name).join(", ")} — tienen valor para este sprint`,
        action: `Leer STATUS.md de cada satellite listado antes de empezar Sprint ${sprintNum}`,
      });
    }
  }

  // Prioridad 4: Advertencias
  for (const c of collisions.filter(c => c.severity === "WARNING")) {
    recs.push({ priority: 3, icon: "⚠️", text: `[${c.id}] ${c.message}`, action: c.action });
  }

  // Prioridad 5: Próximas destilaciones
  const nextDistill = satellites.find(s => s.pendingDistillation && s.priority === "HIGH");
  if (nextDistill) {
    recs.push({
      priority: 4, icon: "🟢",
      text: `Destilación planificada: ${nextDistill.name} → Sprint ${nextDistill.sprintTarget}`,
      action: `Leer _satellites-archive/${nextDistill.name}/STATUS.md para ver qué destilar`,
    });
  }

  // Prioridad 6: Alineación visión
  if (vision.checked && vision.missingInBacklog?.length > 0) {
    recs.push({
      priority: 4, icon: "🔵",
      text: `Features de visión sin coverage en backlog: ${vision.missingInBacklog.join(", ")}`,
      action: "Revisar `constitution/08_SPRINT_BACKLOG.md` y agregar tickets para estas áreas",
    });
  }

  return recs.sort((a, b) => a.priority - b.priority);
}

// ─── 8. Generar reporte Markdown ─────────────────────────────────

function generateMarkdownReport(data) {
  const { satellites, canonical, queue, vision, collisions, globalHealth, recommendations } = data;
  const pendingDist = satellites.filter(s => s.pendingDistillation);
  const scoreIcon   = globalHealth.score >= 80 ? "🟢" :
                      globalHealth.score >= 60 ? "🟡" : "🔴";

  const lines = [
    `# SEMSE Nervous System — Health Report`,
    ``,
    `> **Fecha:** ${dateStr} ${timeStr}`,
    `> **Generado por:** semse-health-check.mjs v2`,
    `> **Modo:** ${FULL ? "FULL (análisis de visión incluido)" : "STANDARD"}`,
    `> **Fuente:** etiquetas, STATUS.md y notas del ecosistema — no ejecuta código`,
    ``,
    `---`,
    ``,
    `## 🧠 Score de Salud Global: ${scoreIcon} ${globalHealth.score}/100`,
    ``,
    `| Componente | Score |`,
    `|------------|-------|`,
    `| Canónico (project-manager-app) | ${canonical.healthScore}/100 |`,
    `| Satellites | ${satellites.filter(s => s.hasStatus).length}/${satellites.length} con etiquetas completas |`,
    `| Colisiones críticas | ${collisions.filter(c => c.severity === "ERROR").length} errores, ${collisions.filter(c => c.severity === "WARNING").length} advertencias |`,
    ``,
    globalHealth.deductions.length > 0 ? `**Deducciones:** ${globalHealth.deductions.join(" | ")}` : `**Sin deducciones significativas.**`,
    ``,
    `---`,
    ``,
    `## 1. Estado del Canónico`,
    ``,
    `| Campo | Estado |`,
    `|-------|--------|`,
    `| Versión | ${canonical.version} |`,
    `| Sprint actual | ${canonical.sprintActual || "N/A"} |`,
    `| Sprint siguiente | ${canonical.sprintSiguiente || "N/A"} |`,
    `| Build disponible | ${canonical.buildExists ? "✅ Sí" : "❌ No"} |`,
    `| Migración DB pendiente | ${canonical.hasPendingMigration ? "⚠️ Sí — ejecutar migrate dev" : "✅ No"} |`,
    `| Rama git | ${canonical.gitBranch || "N/A"} |`,
    `| Commits sin pushear | ${canonical.gitAhead > 0 ? `⚠️ ${canonical.gitAhead}` : "✅ 0"} |`,
    `| Archivos sin commit | ${canonical.uncommitted > 0 ? `⚠️ ${canonical.uncommitted}` : "✅ 0"} |`,
    ``,
    canonical.bottlenecks.length > 0 ? `### Cuellos de botella activos\n\n${canonical.bottlenecks.map(b => `- 🔴 ${b}`).join("\n")}\n` : `### Sin cuellos de botella registrados ✅\n`,
    ``,
    `---`,
    ``,
    `## 2. Satellites (${satellites.length} total)`,
    ``,
    `| Satellite | Estado | Prioridad | Sprint destilación | Stale |`,
    `|-----------|--------|-----------|-------------------|-------|`,
    ...satellites.map(s =>
      `| ${s.name} | ${s.status} | ${s.priority} | ${s.sprintTarget || "N/A"} | ${s.stale ? `⚠️ ${s.staleDays}d` : "✅ OK"} |`
    ),
    ``,
    `### Pendientes de destilación (${pendingDist.length})`,
    ``,
    ...pendingDist.map(s => [
      `**${s.name}** [${s.priority}]`,
      `- Sprint objetivo: ${s.sprintTarget || "Sin asignar"}`,
      `- Siguiente paso: ${s.nextStep}`,
      s.blockers.length > 0 ? `- Blockers: ${s.blockers.slice(0, 2).join("; ")}` : null,
      ``,
    ].filter(Boolean).join("\n")),
    ``,
    `---`,
    ``,
    `## 3. Cola de Destilación (${queue.queueItems.length} ítems)`,
    ``,
    ...queue.queueItems.map(i =>
      `- **${i.name.trim()}** → Sprint ${i.sprint || "?"} — ${i.estado || "Sin estado"}`
    ),
    ``,
    queue.logEntries === 0
      ? `> *Historial vacío — primera destilación pendiente*`
      : `> Historial: ${queue.logEntries} destilaciones registradas (${queue.successfulDistillations} exitosas, ${queue.failedDistillations} revertidas)`,
    ``,
    `---`,
    ``,
    `## 4. Colisiones y Conflictos (${collisions.length})`,
    ``,
    collisions.length === 0
      ? `✅ Sin colisiones detectadas.`
      : collisions.map(c => {
          const icon = c.severity === "ERROR" ? "🔴" : c.severity === "WARNING" ? "⚠️" : "ℹ️";
          return [
            `### ${icon} [${c.id}] ${c.type}`,
            `**Problema:** ${c.message}`,
            `**Acción requerida:** \`${c.action}\``,
            c.affected?.length ? `**Afecta:** ${c.affected.join(", ")}` : null,
            ``,
          ].filter(Boolean).join("\n");
        }).join("\n"),
    ``,
    `---`,
    ``,
  ];

  // Sección visión (solo con --full)
  if (vision.checked) {
    lines.push(
      `## 5. Alineación Visión ↔ Ejecución`,
      ``,
      `| Métrica | Valor |`,
      `|---------|-------|`,
      `| Score de alineación | ${vision.alignmentScore}% |`,
      `| Módulos canónicos implementados | ${vision.canonicalModuleCount} |`,
      `| Keywords de visión en backlog | ${vision.coveredInBacklog}/${vision.visionKeywords} |`,
      ``,
      vision.missingInBacklog?.length > 0
        ? `**Features de visión sin cobertura en backlog:** ${vision.missingInBacklog.join(", ")}`
        : `✅ Todas las features clave de visión tienen cobertura en backlog`,
      ``,
      `---`,
      ``,
    );
  }

  lines.push(
    `## ${vision.checked ? "6" : "5"}. Recomendaciones (${recommendations.length})`,
    ``,
    `*Ordenadas por prioridad — basadas únicamente en etiquetas y notas del ecosistema*`,
    ``,
    ...recommendations.map((r, i) =>
      `${i + 1}. ${r.icon} **${r.text}**\n   → ${r.action}\n`
    ),
    `---`,
    ``,
    `## Cómo actuar sobre este reporte`,
    ``,
    `1. Resolver primero los ítems 🔴 (errores críticos)`,
    `2. Leer el STATUS.md del componente antes de tocarlo`,
    `3. Registrar el trabajo en \`_governance/logs/WORK_SESSION_LOG.md\``,
    `4. Actualizar etiquetas después de cada cambio`,
    `5. El próximo health check reflejará automáticamente los cambios`,
    ``,
    `*Para ejecutar manualmente: \`node scripts/semse-health-check.mjs\`*`,
    `*Para análisis completo con visión: \`node scripts/semse-health-check.mjs --full\`*`,
    ``,
    `---`,
    `*Fin del reporte — ${dateStr} ${timeStr}*`,
  );

  return lines.join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${bold("🧠 SEMSE Nervous System — Health Check v2")}`);
  console.log(`${dim(`   ${dateStr} ${timeStr} | Root: ${ROOT}`)}\n`);

  const satellites  = readSatellites();
  const canonical   = readCanonicalState();
  const queue       = readDistillationData();
  const vision      = readVisionAlignment();
  const collisions  = detectCollisions(satellites, queue, canonical);
  const globalHealth = calculateGlobalHealth(canonical, satellites, collisions, queue);
  const recommendations = generateRecommendations(canonical, satellites, collisions, queue, vision);

  // Consola: resumen ejecutivo
  console.log(`\n${bold("📊 RESUMEN EJECUTIVO")}`);
  const scoreIcon = globalHealth.score >= 80 ? green("✔") : globalHealth.score >= 60 ? yellow("⚠") : red("✖");
  console.log(`   ${scoreIcon} Score de salud global: ${bold(String(globalHealth.score))}/100`);
  console.log(`   Canónico — Sprint: ${canonical.sprintActual || "N/A"} | Health: ${canonical.healthScore}/100`);
  console.log(`   Satellites: ${satellites.length} total | ${satellites.filter(s => s.pendingDistillation).length} pendientes de destilación`);
  console.log(`   Cola: ${queue.queueItems.length} ítems | Colisiones: ${collisions.length}`);

  if (collisions.length > 0) {
    console.log(`\n${bold("⚡ COLISIONES:")}`);
    for (const c of collisions) {
      const icon = c.severity === "ERROR" ? red("✖") : yellow("⚠");
      console.log(`   ${icon} [${c.id}] ${c.message}`);
    }
  }

  if (recommendations.length > 0) {
    console.log(`\n${bold("➡  PRÓXIMAS ACCIONES (top 3):")}`);
    for (const r of recommendations.slice(0, 3)) {
      console.log(`   ${r.icon} ${r.text}`);
      console.log(`      ${dim("→ " + r.action)}`);
    }
  }

  // Guardar reporte Markdown
  const reportMd   = generateMarkdownReport({ satellites, canonical, queue, vision, collisions, globalHealth, recommendations });
  const reportPath = join(REPORTS, `${dateStr}_health.md`);
  writeFileSync(reportPath, reportMd, "utf-8");
  ok(`Reporte guardado: _governance/reports/${dateStr}_health.md`);

  // Guardar JSON si --json
  if (JSON_OUT) {
    const reportJson = {
      date: dateStr, time: timeStr,
      globalHealth, canonical, satellites, queue, vision, collisions, recommendations,
    };
    const jsonPath = join(REPORTS, `${dateStr}_health.json`);
    writeFileSync(jsonPath, JSON.stringify(reportJson, null, 2), "utf-8");
    ok(`JSON guardado: _governance/reports/${dateStr}_health.json`);
  }

  console.log(`\n${dim("Para análisis completo con visión: node scripts/semse-health-check.mjs --full")}\n`);
}

main().catch(e => { err(e.message); process.exit(1); });
