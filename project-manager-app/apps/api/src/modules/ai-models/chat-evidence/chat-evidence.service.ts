import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { isOpsAdmin, type ScopeActor } from "../../../common/resource-scope.js";
import { ResourceScopeResolver } from "../../../common/resource-scope.resolver.js";
import { MAX_EVIDENCE_ITEMS, MAX_RISK_REASONS, type EvidenceContextItem } from "./evidence-context.js";

/** Evidencia lista para el contexto del chat: solo campos derivados. NUNCA lleva `bucketKey` ni `fileUrl`. */
export type ChatEvidenceItem = EvidenceContextItem & { analysisStatus: string; analyzable: boolean };

export type ChatEvidenceListing = { items: ChatEvidenceItem[]; total: number; remaining: number };

export const CHAT_EVIDENCE_SCOPE_RESOLVER = "CHAT_EVIDENCE_SCOPE_RESOLVER";

const EMPTY: ChatEvidenceListing = { items: [], total: 0, remaining: 0 };

type EvidenceRow = {
  id: string;
  kind: string;
  bucketKey: string | null;
  capturedAt: Date | null;
  createdAt: Date;
  project?: { job?: { title?: string | null } | null } | null;
  milestone?: { title?: string | null } | null;
};

type AnalysisRow = {
  evidenceId: string;
  status: string;
  qualityScore: number | null;
  riskLevel: string | null;
  riskReasons: unknown;
  requiresHumanReview: boolean;
  recommendedAction: string | null;
};

/**
 * Lista las evidencias pendientes de revisión del ACTOR (spec `prometeo.chat-evidence`, §3.3). Solo lectura.
 *
 * Alcance: `OPS_ADMIN` ⇒ su tenant; resto ⇒ proyectos donde su organización participa (misma fuente que el contexto
 * operativo, 0.45); sin organización o si el listado falla ⇒ vacío, nunca el tenant completo.
 */
@Injectable()
export class ChatEvidenceService {
  private readonly logger = new Logger(ChatEvidenceService.name);
  private readonly scope: Pick<ResourceScopeResolver, "listAccessibleProjectIds">;

  constructor(
    private readonly prisma: PrismaService,
    // Token explícito: sin él Nest vería un parámetro de tipo `Object`. No se registra en producción (se usa el resolvedor real); solo las pruebas lo inyectan.
    @Optional() @Inject(CHAT_EVIDENCE_SCOPE_RESOLVER) scope?: Pick<ResourceScopeResolver, "listAccessibleProjectIds">,
  ) {
    this.scope = scope ?? new ResourceScopeResolver(prisma);
  }

  async listPending(actor: ScopeActor): Promise<ChatEvidenceListing> {
    if (!actor.tenantId) return EMPTY;
    let projectFilter: { projectId: { in: string[] } } | Record<string, never>;
    if (isOpsAdmin(actor)) {
      projectFilter = {};
    } else {
      if (!actor.orgId) return EMPTY;
      try {
        const projectIds = await this.scope.listAccessibleProjectIds(actor.tenantId, actor.orgId);
        if (projectIds.length === 0) return EMPTY;
        projectFilter = { projectId: { in: projectIds } };
      } catch (error) {
        this.logger.warn(`[chat-evidence] no se pudo acotar por participación; lista vacía: ${error instanceof Error ? error.message : String(error)}`);
        return EMPTY;
      }
    }

    const where = { tenantId: actor.tenantId, validationStatus: "pending", ...projectFilter };
    const [total, rows] = await Promise.all([
      this.prisma.evidence.count({ where }),
      this.prisma.evidence.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: MAX_EVIDENCE_ITEMS,
        // `bucketKey` se selecciona SOLO para calcular `hasImage`; nunca sale de este servicio.
        select: {
          id: true,
          kind: true,
          bucketKey: true,
          capturedAt: true,
          createdAt: true,
          project: { select: { job: { select: { title: true } } } },
          milestone: { select: { title: true } },
        },
      }) as Promise<EvidenceRow[]>,
    ]);
    if (rows.length === 0) return { items: [], total, remaining: 0 };

    // El análisis se consulta SOLO para evidencias ya acotadas al alcance del actor (`VisionAnalysis` no tiene `tenantId`).
    const analyses = (await this.prisma.visionAnalysis.findMany({
      where: { evidenceId: { in: rows.map((row) => row.id) } },
      select: {
        evidenceId: true,
        status: true,
        qualityScore: true,
        riskLevel: true,
        riskReasons: true,
        requiresHumanReview: true,
        recommendedAction: true,
      },
    })) as AnalysisRow[];
    const byEvidence = new Map(analyses.map((analysis) => [analysis.evidenceId, analysis]));

    const items = rows.map((row): ChatEvidenceItem => {
      const analysis = byEvidence.get(row.id);
      const hasImage = row.kind === "PHOTO" && typeof row.bucketKey === "string" && row.bucketKey.length > 0;
      return {
        id: row.id,
        kind: row.kind,
        effectiveAt: (row.capturedAt ?? row.createdAt).toISOString(),
        jobTitle: row.project?.job?.title ?? null,
        milestoneTitle: row.milestone?.title ?? null,
        analysisStatus: analysis?.status ?? "none",
        qualityScore: analysis?.qualityScore ?? null,
        riskLevel: analysis?.riskLevel ?? null,
        riskReasons: Array.isArray(analysis?.riskReasons)
          ? (analysis!.riskReasons as unknown[]).filter((reason): reason is string => typeof reason === "string").slice(0, MAX_RISK_REASONS)
          : [],
        requiresHumanReview: analysis?.requiresHumanReview ?? null,
        recommendedAction: analysis?.recommendedAction ?? null,
        analyzable: hasImage && analysis?.status !== "completed",
      };
    });
    return { items, total, remaining: Math.max(0, total - items.length) };
  }
}
