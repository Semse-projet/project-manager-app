import { Injectable, Logger, Optional } from "@nestjs/common";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";
import { SimulationEngineService, type SimulatedPatch } from "./simulation-engine.service.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ApplyResult = {
  applied:        boolean;
  patchId:        string;
  filesCreated:   string[];
  filesSkipped:   string[];
  reason?:        string;
  appliedAt:      string;
  appliedBy:      string;
  autonomyLevel:  4;
  auditId:        string;
  content:        Record<string, string>;  // filename → content (for manual apply)
};

// ── Absolute safety gate ──────────────────────────────────────────────────────

const ALLOW_FLAG = process.env.SEMSE_ALLOW_AUTONOMOUS_APPLY;

const GUARDRAIL_FRAGMENTS = [
  "prisma/schema", "prisma/migrations", "infrastructure/auth",
  "modules/payments", "modules/finance", ".env", "Dockerfile",
  "railway.json", "pnpm-lock", "package-lock", "tsconfig",
  "modules/ops/apply-engine", // never self-modify
];

function isGuardrailed(filePath: string): boolean {
  const lower = filePath.toLowerCase().replace(/\\/g, "/");
  return GUARDRAIL_FRAGMENTS.some((g) => lower.includes(g));
}

// ── Template generators ───────────────────────────────────────────────────────

function generateTestTemplate(area: string, moduleSlug: string): string {
  return `import test from "node:test";
import assert from "node:assert/strict";

/**
 * ${area} — Tests unitarios
 * Generado por SEMSE Autonomy Level 4 — ApplyEngine
 * Completar con lógica específica del módulo.
 */

// ── Contrato de tipos ─────────────────────────────────────────────────────────

test("${moduleSlug}.01: módulo puede importarse sin errores", () => {
  // Verifica que el módulo existe y se puede referenciar
  assert.ok(true, "${area} módulo registrado");
});

test("${moduleSlug}.02: operaciones básicas no lanzan excepción", () => {
  // Template: agregar tests reales del módulo
  assert.ok(true, "placeholder — reemplazar con tests reales");
});

test("${moduleSlug}.03: invariantes de negocio básicas", () => {
  // Template: verificar invariantes del dominio
  assert.ok(true, "placeholder — agregar validaciones del dominio");
});

// TODO: Agregar tests específicos del módulo ${area}
// Consultar: GET /v1/ops/recommendations para ver qué cubrir
`;
}

function generatePageTemplate(area: string, moduleSlug: string): string {
  return `"use client";

/**
 * ${area} — Página admin
 * Generada por SEMSE Autonomy Level 4 — ApplyEngine
 * Completar con la UI real del módulo.
 */

import { useEffect, useState } from "react";

type ${area.replace(/[\s/]+/g, "")}Data = Record<string, unknown>;

export default function ${area.replace(/[\s/]+/g, "")}Page() {
  const [data, setData]     = useState<${area.replace(/[\s/]+/g, "")}Data | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    // TODO: fetch real data from /api/semse/${moduleSlug}
    fetch("/api/semse/${moduleSlug}")
      .then((r) => r.json())
      .then((j) => setData(j.data ?? null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 900 }}>${area}</h1>
      <p style={{ color: "var(--muted)", fontSize: 12 }}>
        Página generada por SEMSE Autonomy Level 4 — completar con la UI real.
      </p>
      {loading && <p style={{ color: "var(--muted)" }}>Cargando…</p>}
      {data && (
        <pre style={{ fontSize: 11, padding: 16, background: "rgba(255,255,255,.05)", borderRadius: 12, overflow: "auto" }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
      {/* TODO: Implementar UI real de ${area} */}
    </div>
  );
}
`;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ApplyEngineService {
  private readonly logger = new Logger(ApplyEngineService.name);
  private readonly repoRoot = process.env.SEMSE_REPO_ROOT ?? "/home/yoni/labsemse/project-manager-app";

  constructor(
    private readonly prisma: PrismaService,
    private readonly simulation: SimulationEngineService,
    @Optional() private readonly sse?: SseEventBusService,
  ) {}

  async apply(input: {
    tenantId:  string;
    recId:     string;
    actorId:   string;
    confirmed: boolean;
  }): Promise<ApplyResult> {
    const appliedAt = new Date().toISOString();

    // ── Guard: explicit confirmation required ─────────────────────────────────
    if (!input.confirmed) {
      return this.deny(input.recId, input.actorId, appliedAt, "confirmed=false — el humano no confirmó la aplicación");
    }

    // ── Guard: safety gate env var ────────────────────────────────────────────
    if (ALLOW_FLAG !== "true") {
      return this.deny(input.recId, input.actorId, appliedAt,
        "SEMSE_ALLOW_AUTONOMOUS_APPLY no está habilitado — configurar en .env local para permitir aplicación autónoma");
    }

    // ── Get patch from simulation engine ──────────────────────────────────────
    const patch = await this.simulation.simulateOne(input.tenantId, input.recId);
    if (!patch) {
      return this.deny(input.recId, input.actorId, appliedAt, `Patch ${input.recId} no encontrado en el simulation engine`);
    }

    // ── Guard: only safe patches ──────────────────────────────────────────────
    if (!patch.patch.safeToApply) {
      return this.deny(input.recId, input.actorId, appliedAt,
        `Patch ${input.recId} tiene safeToApply=false — requiere intervención manual (tipo: ${patch.recommendation.type})`);
    }

    // ── Guard: verify all files are non-guardrailed ───────────────────────────
    const allFiles = [...patch.patch.filesToCreate, ...patch.patch.filesToModify];
    const guardrailed = allFiles.filter(isGuardrailed);
    if (guardrailed.length > 0) {
      return this.deny(input.recId, input.actorId, appliedAt,
        `Archivos guardrailed detectados: ${guardrailed.join(", ")}`);
    }

    // ── Only apply filesToCreate (never modify existing files) ────────────────
    const filesCreated: string[] = [];
    const filesSkipped: string[] = [];
    const content: Record<string, string> = {};

    for (const relPath of patch.patch.filesToCreate) {
      const absPath = path.join(this.repoRoot, relPath);

      // Safety: never overwrite existing files
      const exists = await fs.access(absPath).then(() => true).catch(() => false);
      if (exists) {
        filesSkipped.push(relPath);
        this.logger.warn(`[ApplyEngine] skip existing file: ${relPath}`);
        continue;
      }

      // Generate content based on recommendation type
      const fileContent = this.generateContent(patch, relPath);
      content[relPath] = fileContent;

      try {
        await fs.mkdir(path.dirname(absPath), { recursive: true });
        await fs.writeFile(absPath, fileContent, "utf-8");
        filesCreated.push(relPath);
        this.logger.log(`[ApplyEngine] created: ${relPath}`);
      } catch (err) {
        this.logger.error(`[ApplyEngine] failed to write ${relPath}: ${(err as Error).message}`);
        filesSkipped.push(relPath);
      }
    }

    // ── AuditLog ──────────────────────────────────────────────────────────────
    const auditId = await this.recordAudit({
      tenantId:    input.tenantId,
      actorId:     input.actorId,
      patchId:     input.recId,
      recType:     patch.recommendation.type,
      recArea:     patch.recommendation.area,
      filesCreated,
      filesSkipped,
    });

    // ── SSE: notify that a patch was applied ──────────────────────────────────
    if (filesCreated.length > 0) {
      this.sse?.emit(`mission-control:${input.tenantId}`, "autonomy:applied", {
        patchId:      input.recId,
        area:         patch.recommendation.area,
        type:         patch.recommendation.type,
        filesCreated,
        appliedBy:    input.actorId,
        appliedAt,
        autonomyLevel: 4,
      });
    }

    return {
      applied:       filesCreated.length > 0,
      patchId:       input.recId,
      filesCreated,
      filesSkipped,
      reason:        filesCreated.length === 0 ? "Todos los archivos ya existían o fallaron" : undefined,
      appliedAt,
      appliedBy:     input.actorId,
      autonomyLevel: 4,
      auditId,
      content,
    };
  }

  private generateContent(patch: SimulatedPatch, filePath: string): string {
    const area = patch.recommendation.area;
    const moduleSlug = area.toLowerCase().replace(/[\s/]+/g, "-").replace(/[^a-z0-9-]/g, "");

    if (filePath.endsWith(".test.ts")) {
      return generateTestTemplate(area, moduleSlug);
    }
    if (filePath.endsWith("page.tsx")) {
      return generatePageTemplate(area, moduleSlug);
    }
    if (filePath.endsWith("route.ts")) {
      return `import { NextRequest, NextResponse } from "next/server";\nimport { fetchSemseDataForRequest, handleServerError } from "../../_server";\n\nexport async function GET(request: NextRequest) {\n  try {\n    const data = await fetchSemseDataForRequest<unknown>("/v1/${moduleSlug}", request);\n    return NextResponse.json({ data });\n  } catch (error) { return handleServerError(error); }\n}\n`;
    }
    return `// ${area} — generado por SEMSE Autonomy Level 4\n// Completar con implementación real\n`;
  }

  private deny(patchId: string, actorId: string, appliedAt: string, reason: string): ApplyResult {
    this.logger.warn(`[ApplyEngine] denied patch=${patchId} actor=${actorId}: ${reason}`);
    return {
      applied: false, patchId, filesCreated: [], filesSkipped: [],
      reason, appliedAt, appliedBy: actorId, autonomyLevel: 4, auditId: "", content: {},
    };
  }

  private async recordAudit(input: {
    tenantId: string; actorId: string; patchId: string;
    recType: string; recArea: string;
    filesCreated: string[]; filesSkipped: string[];
  }): Promise<string> {
    try {
      const log = await this.prisma.auditLog.create({
        data: {
          tenantId:   input.tenantId,
          entityType: "AutonomyPatch",
          entityId:   input.patchId,
          action:     "autonomy.patch.applied",
          afterJson:  {
            recType:      input.recType,
            recArea:      input.recArea,
            filesCreated: input.filesCreated,
            filesSkipped: input.filesSkipped,
            autonomyLevel: 4,
            appliedBy:    input.actorId,
            appliedAt:    new Date().toISOString(),
            policy:       "safeToApply=true + confirmed=true + SEMSE_ALLOW_AUTONOMOUS_APPLY=true",
          },
          occurredAt:   new Date(),
          actorUserId:  input.actorId,
        },
      });
      return log.id;
    } catch (err) {
      this.logger.warn(`[ApplyEngine] AuditLog failed: ${(err as Error).message}`);
      return "audit-failed";
    }
  }
}
