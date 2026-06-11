import { Injectable, Logger } from "@nestjs/common";
import { RecommendationEngineService, type StructuredRecommendation } from "./recommendation-engine.service.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SimulationStatus = "safe" | "review" | "risky";

export type SimulatedPatch = {
  id:           string;
  recommendation: StructuredRecommendation;
  patch: {
    filesToCreate: string[];
    filesToModify: string[];
    estimatedLines: number;
    testCommand:  string;
    safeToApply:  boolean;
  };
  impactAnalysis: {
    status:          SimulationStatus;
    affectedModules: string[];
    breakingRisk:    "none" | "low" | "medium" | "high";
    rollbackable:    boolean;
    notes:           string[];
  };
  previewDiff: string;
  autonomyNote: "Nivel 3 — Simulación: patch generado, humano valida antes de aplicar";
};

export type SimulationReport = {
  generatedAt:  string;
  tenantId:     string;
  patchCount:   number;
  safePatchCount: number;
  patches:      SimulatedPatch[];
  autonomyLevel: 3;
  autonomyPolicy: string;
  guardrails: string[];
};

// ── Guardrails — lo que Level 3 NUNCA toca ───────────────────────────────────

const GUARDRAIL_PATHS = [
  "packages/db/prisma/schema.prisma",
  "packages/db/prisma/migrations/",
  "apps/api/src/infrastructure/auth/",
  "apps/api/src/modules/payments/",
  "apps/api/src/modules/finance/",
  ".env",
  ".env.*",
  "Dockerfile*",
  "railway.json",
  "pnpm-lock.yaml",
];

const GUARDRAIL_PATTERNS = [
  "payment", "auth", "secret", "token", "password", "migration",
  "prisma", "schema", "seed", "production",
];

function isGuardrailed(path: string): boolean {
  const lower = path.toLowerCase();
  return GUARDRAIL_PATHS.some((g) => lower.includes(g.replaceAll("*", ""))) ||
         GUARDRAIL_PATTERNS.some((p) => lower.includes(p));
}

// ── Patch generation rules ────────────────────────────────────────────────────

function generatePatch(rec: StructuredRecommendation): SimulatedPatch {
  const id = `sim-${rec.id}`;

  if (rec.type === "add_tests") {
    const moduleSlug = rec.area.toLowerCase().replace(/[\s/]+/g, "-").replace(/[^a-z0-9-]/g, "");
    const testFile   = `apps/api/test/${moduleSlug}.test.ts`;
    const safeToApply = !isGuardrailed(testFile);

    return {
      id, recommendation: rec,
      patch: {
        filesToCreate:   [testFile],
        filesToModify:   [],
        estimatedLines:  80,
        testCommand:     `node --test ${testFile}`,
        safeToApply,
      },
      impactAnalysis: {
        status:          safeToApply ? "safe" : "review",
        affectedModules: [rec.area],
        breakingRisk:    "none",
        rollbackable:    true,
        notes:           [
          "Archivo de test puro — no modifica código de producción",
          "Solo crea nuevos tests unitarios sin DB ni HTTP",
          `Ejecutar: node --test ${testFile}`,
        ],
      },
      previewDiff: `+++ ${testFile}\n@@ -0,0 +1,80 @@\n+import test from "node:test";\n+import assert from "node:assert/strict";\n+\n+// ${rec.area} — Tests unitarios generados por Simulation Engine\n+// Completar con lógica específica del módulo\n+\n+test("${moduleSlug}.01: contrato de tipos básico", () => {\n+  // TODO: implementar\n+  assert.ok(true);\n+});\n`,
      autonomyNote: "Nivel 3 — Simulación: patch generado, humano valida antes de aplicar",
    };
  }

  if (rec.type === "add_frontend") {
    const moduleSlug = rec.area.toLowerCase().replace(/[\s/]+/g, "-").replace(/[^a-z0-9-]/g, "");
    const pageFile   = `apps/web/app/(app)/admin/${moduleSlug}/page.tsx`;
    const bffFile    = `apps/web/app/api/semse/${moduleSlug}/route.ts`;

    return {
      id, recommendation: rec,
      patch: {
        filesToCreate:   [pageFile, bffFile],
        filesToModify:   ["apps/web/app/(app)/layout.tsx", "apps/web/lib/language-context.tsx"],
        estimatedLines:  200,
        testCommand:     "npx tsc -p apps/web/tsconfig.json --noEmit",
        safeToApply:     true,
      },
      impactAnalysis: {
        status:          "safe",
        affectedModules: [rec.area, "Navigation"],
        breakingRisk:    "none",
        rollbackable:    true,
        notes:           [
          "Nueva página admin — no modifica lógica existente",
          "Requiere BFF route nueva",
          "Agregar link en sidebar y traducciones",
        ],
      },
      previewDiff: `+++ ${pageFile}\n@@ -0,0 +1 @@\n+"use client";\n+// ${rec.area} admin page — generado por Simulation Engine\n+export default function ${rec.area.replace(/\s+/g, "")}Page() {\n+  return <div>TODO: implementar ${rec.area}</div>;\n+}\n`,
      autonomyNote: "Nivel 3 — Simulación: patch generado, humano valida antes de aplicar",
    };
  }

  if (rec.type === "resolve_alert" || rec.type === "fix_risk") {
    return {
      id, recommendation: rec,
      patch: {
        filesToCreate:   [],
        filesToModify:   [],
        estimatedLines:  0,
        testCommand:     "— acción operacional, no código",
        safeToApply:     false,
      },
      impactAnalysis: {
        status:          "review",
        affectedModules: [rec.area],
        breakingRisk:    "low",
        rollbackable:    true,
        notes:           [
          "Acción operacional — requiere intervención humana",
          rec.action,
          "El sistema NO puede ejecutar esta acción automáticamente",
        ],
      },
      previewDiff: `# Acción requerida\n# ${rec.action}\n#\n# Pasos:\n${rec.draftPRScope.map((s) => `# - ${s}`).join("\n")}\n`,
      autonomyNote: "Nivel 3 — Simulación: patch generado, humano valida antes de aplicar",
    };
  }

  // Default: doc / observability
  return {
    id, recommendation: rec,
    patch: {
      filesToCreate:   [],
      filesToModify:   [],
      estimatedLines:  0,
      testCommand:     "— revisar manualmente",
      safeToApply:     false,
    },
    impactAnalysis: {
      status:          "review",
      affectedModules: [rec.area],
      breakingRisk:    "none",
      rollbackable:    true,
      notes:           ["Requiere análisis manual antes de proceder"],
    },
    previewDiff: `# ${rec.draftPRTitle}\n${rec.draftPRScope.map((s) => `# ${s}`).join("\n")}\n`,
    autonomyNote: "Nivel 3 — Simulación: patch generado, humano valida antes de aplicar",
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class SimulationEngineService {
  private readonly logger = new Logger(SimulationEngineService.name);

  constructor(private readonly recommendations: RecommendationEngineService) {}

  async simulate(tenantId: string, limit = 5): Promise<SimulationReport> {
    const report = await this.recommendations.generate(tenantId);
    const topRecs = report.recommendations.slice(0, limit);

    const patches = topRecs.map(generatePatch);
    const safePatchCount = patches.filter((p) => p.patch.safeToApply).length;

    this.logger.log(`[SimulationEngine] generated ${patches.length} patches, ${safePatchCount} safe tenantId=${tenantId}`);

    return {
      generatedAt:    new Date().toISOString(),
      tenantId,
      patchCount:     patches.length,
      safePatchCount,
      patches,
      autonomyLevel:  3,
      autonomyPolicy: "El sistema genera patches simulados para revisión humana. NUNCA los aplica automáticamente. El humano lee, valida y decide qué aplicar.",
      guardrails: [
        "NUNCA modifica: auth, payments, migrations, secrets, .env, Dockerfiles",
        "NUNCA hace push ni deploy automático",
        "NUNCA modifica payment governance ni release logic",
        "Solo genera archivos de test y páginas UI — cero cambios de producción sin aprobación",
        "Cada patch tiene safeToApply=false para operaciones no-code",
      ],
    };
  }

  /** Simulate a single recommendation by ID. */
  async simulateOne(tenantId: string, recId: string): Promise<SimulatedPatch | null> {
    const report = await this.recommendations.generate(tenantId);
    const rec    = report.recommendations.find((r) => r.id === recId);
    if (!rec) return null;
    return generatePatch(rec);
  }
}
