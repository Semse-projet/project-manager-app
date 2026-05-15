import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export type BriefSignalItem = {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  recommendedAction?: string;
  buildOpsProjectId?: string;
  milestoneId?: string;
  createdAt: string;
};

export type PrometeoBriefSection = {
  priority: number;
  severity: string;
  headline: string;
  signals: BriefSignalItem[];
  action: string;
};

export type PrometeoBrief = {
  generatedAt: string;
  tenantId: string;
  openSignalCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  systemStatus: "healthy" | "attention" | "high_risk" | "critical";
  summary: string;
  sections: PrometeoBriefSection[];
  topRecommendation: string | null;
  nextAction: string | null;
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const TYPE_DESCRIPTION: Record<string, string> = {
  EVIDENCE_GAP: "evidencia faltante o rechazada",
  PAYMENT_BLOCKED: "pago bloqueado",
  LOW_CONFIDENCE_ESTIMATE: "estimate con baja confianza",
  CHANGE_ORDER_RECOMMENDED: "change order recomendado",
  DISPUTE_RISK_HIGH: "riesgo de disputa",
};

@Injectable()
export class PrometeoBriefService {
  constructor(private readonly prisma: PrismaService) {}

  async generateBrief(tenantId: string): Promise<PrometeoBrief> {
    const signals = await this.prisma.operationalSignal.findMany({
      where: { tenantId, status: { in: ["open", "acknowledged"] } },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      take: 50,
    });

    const criticalCount = signals.filter((s) => s.severity === "critical").length;
    const highCount = signals.filter((s) => s.severity === "high").length;
    const mediumCount = signals.filter((s) => s.severity === "medium").length;
    const openSignalCount = signals.length;

    const systemStatus = criticalCount > 0
      ? "critical"
      : highCount > 0
      ? "high_risk"
      : openSignalCount > 0
      ? "attention"
      : "healthy";

    // Group by severity for sections
    const bySeverity = new Map<string, typeof signals>();
    for (const sig of signals) {
      if (!bySeverity.has(sig.severity)) bySeverity.set(sig.severity, []);
      bySeverity.get(sig.severity)!.push(sig);
    }

    const sections: PrometeoBriefSection[] = [];

    for (const [severity, group] of [...bySeverity.entries()].sort(
      ([a], [b]) => (SEVERITY_ORDER[a] ?? 9) - (SEVERITY_ORDER[b] ?? 9),
    )) {
      const typeGroups = new Map<string, typeof group>();
      for (const sig of group) {
        if (!typeGroups.has(sig.type)) typeGroups.set(sig.type, []);
        typeGroups.get(sig.type)!.push(sig);
      }

      const typeList = [...typeGroups.entries()]
        .map(([type, sigs]) => `${sigs.length} ${TYPE_DESCRIPTION[type] ?? type.toLowerCase()}`)
        .join(", ");

      const headline =
        severity === "critical"
          ? `${group.length} señal${group.length > 1 ? "es" : ""} crítica${group.length > 1 ? "s" : ""}: ${typeList}`
          : severity === "high"
          ? `${group.length} señal${group.length > 1 ? "es" : ""} de alta prioridad: ${typeList}`
          : `${group.length} señal${group.length > 1 ? "es" : ""} de atención: ${typeList}`;

      const topType = [...typeGroups.entries()].sort(([, a], [, b]) => b.length - a.length)[0];
      const action = topType
        ? (group.find((s) => s.type === topType[0])?.recommendedAction ?? "Revisar señales activas")
        : "Revisar señales activas";

      sections.push({
        priority: sections.length + 1,
        severity,
        headline,
        signals: group.map((s) => ({
          id: s.id,
          type: s.type,
          severity: s.severity,
          title: s.title,
          message: s.message,
          recommendedAction: s.recommendedAction ?? undefined,
          buildOpsProjectId: s.buildOpsProjectId ?? undefined,
          milestoneId: s.milestoneId ?? undefined,
          createdAt: s.createdAt.toISOString(),
        })),
        action,
      });
    }

    // Summary text
    const summary = this.buildSummaryText(openSignalCount, criticalCount, highCount, mediumCount, systemStatus);
    const topRecommendation = sections[0]?.action ?? null;
    const nextAction = this.buildNextAction(systemStatus, criticalCount, highCount, signals);

    return {
      generatedAt: new Date().toISOString(),
      tenantId,
      openSignalCount,
      criticalCount,
      highCount,
      mediumCount,
      systemStatus,
      summary,
      sections,
      topRecommendation,
      nextAction,
    };
  }

  private buildSummaryText(
    total: number,
    critical: number,
    high: number,
    medium: number,
    status: string,
  ): string {
    if (total === 0) {
      return "El ecosistema opera sin señales activas. Todos los milestones y proyectos están dentro de parámetros normales.";
    }
    if (status === "critical") {
      return `Detecté ${total} señal${total > 1 ? "es" : ""} activa${total > 1 ? "s" : ""}, incluyendo ${critical} crítica${critical > 1 ? "s" : ""}. Requiere intervención inmediata.`;
    }
    if (status === "high_risk") {
      return `Detecté ${total} señal${total > 1 ? "es" : ""} activa${total > 1 ? "s" : ""}: ${high} de alta prioridad${medium > 0 ? ` y ${medium} de atención media` : ""}. Revisar antes de proceder con pagos.`;
    }
    return `Detecté ${total} señal${total > 1 ? "es" : ""} activa${total > 1 ? "s" : ""} de atención media. Sistema operando con alertas menores.`;
  }

  private buildNextAction(
    status: string,
    critical: number,
    high: number,
    signals: Array<{ type: string; recommendedAction: string | null }>,
  ): string | null {
    if (status === "healthy") return null;

    const priorityTypes = ["DISPUTE_RISK_HIGH", "PAYMENT_BLOCKED", "EVIDENCE_GAP", "CHANGE_ORDER_RECOMMENDED", "LOW_CONFIDENCE_ESTIMATE"];
    for (const type of priorityTypes) {
      const sig = signals.find((s) => s.type === type && s.recommendedAction);
      if (sig?.recommendedAction) return sig.recommendedAction;
    }

    if (critical > 0) return "Revisar señales críticas en Mission Control.";
    if (high > 0) return "Revisar señales de alta prioridad antes de aprobar pagos.";
    return "Revisar señales activas en Mission Control.";
  }
}
