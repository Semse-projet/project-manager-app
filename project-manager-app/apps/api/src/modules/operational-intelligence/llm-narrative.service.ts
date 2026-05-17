import { Injectable, Logger, Optional } from "@nestjs/common";
import { z } from "zod";
import { getAgentProfile, type AgentProfileName } from "../../infrastructure/llm/agent-profiles.js";
import { LLMOrchestrator } from "../../infrastructure/llm/orchestrator.js";

// ── Zod schemas (structured output validation) ────────────────────────────────

export const ChangeOrderSchema = z.object({
  detected:        z.boolean(),
  title:           z.string().optional(),
  reason:          z.string().optional(),
  risk:            z.enum(["low", "medium", "high"]).optional(),
  suggestedAction: z.string().optional(),
});

export type ChangeOrderCandidateDetection = z.infer<typeof ChangeOrderSchema>;

export type StructuredOutputResult<T> = {
  data: T;
  structuredOutputValid: boolean;
  rawOutput?: string;
  parseError?: string;
  retried: boolean;
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type EvidenceReadinessInput = {
  milestoneTitle: string;
  milestoneStatus: string;
  paymentReadiness: string;
  evidenceReadiness: string;
  missingLabels: string[];
  rejectedLabels: string[];
  trade?: string;
};

export type RiskNarrativeInput = {
  riskLevel: string;
  riskScore?: number;
  signals: Array<{ type: string; severity: string; title: string; message: string }>;
  projectContext?: string;
};

export type MissionControlNarrativeInput = {
  systemStatus: string;
  openSignalCount: number;
  criticalCount: number;
  highCount: number;
  topSignals: Array<{ type: string; severity: string; title: string }>;
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class LLMNarrativeService {
  private readonly logger = new Logger(LLMNarrativeService.name);
  private readonly enabled: boolean;

  constructor(@Optional() private readonly llm?: LLMOrchestrator) {
    this.enabled = !!llm && llm.hasLLMProvider;
    if (!this.enabled) {
      this.logger.log("[LLMNarrative] disabled — no LLM provider available");
    }
  }

  // ── Evidence analysis ──────────────────────────────────────────────────────

  async explainEvidenceReadiness(input: EvidenceReadinessInput): Promise<string | null> {
    if (!this.isReady()) return null;

    const prompt = [
      `Eres el asistente operacional de SEMSE, un sistema para proyectos de construcción.`,
      `Analiza el estado de un milestone y explica en 2-3 oraciones qué falta y por qué el pago no puede liberarse.`,
      `Sé directo, claro y útil. No uses tecnicismos innecesarios.`,
      ``,
      `Milestone: "${input.milestoneTitle}"`,
      `Estado: ${input.milestoneStatus}`,
      `Payment readiness: ${input.paymentReadiness}`,
      `Evidence readiness: ${input.evidenceReadiness}`,
      input.missingLabels.length > 0 ? `Evidencia faltante: ${input.missingLabels.join(", ")}` : "",
      input.rejectedLabels.length > 0 ? `Evidencia rechazada: ${input.rejectedLabels.join(", ")}` : "",
      input.trade ? `Trade: ${input.trade}` : "",
      ``,
      `Genera solo la explicación. Sin bullet points ni encabezados.`,
    ].filter(Boolean).join("\n");

    return this.safeChat(prompt, "evidence-analyzer");
  }

  // ── Change order detection ─────────────────────────────────────────────────

  async detectChangeOrderCandidate(
    scopeOriginal: string,
    newMessage: string,
  ): Promise<StructuredOutputResult<ChangeOrderCandidateDetection>> {
    const fallback: ChangeOrderCandidateDetection = { detected: false };
    if (!this.isReady()) {
      return { data: fallback, structuredOutputValid: false, retried: false, parseError: "LLM not available" };
    }

    const makePrompt = (strict: boolean) => [
      `Eres el detector de change orders de SEMSE. Determina si el nuevo mensaje implica`,
      `trabajo adicional fuera del scope original del contrato.`,
      ``,
      `SCOPE ORIGINAL:`,
      scopeOriginal,
      ``,
      `NUEVO MENSAJE:`,
      newMessage,
      ``,
      strict
        ? `Responde ÚNICAMENTE con este JSON exacto, sin texto extra, sin markdown:`
        : `Responde SOLO con JSON válido siguiendo este formato:`,
      `{"detected": true, "title": "título corto", "reason": "explicación", "risk": "low|medium|high", "suggestedAction": "acción"}`,
      `O si no hay change order: {"detected": false}`,
      strict ? `NO agregues nada más. Solo el JSON.` : "",
    ].filter(Boolean).join("\n");

    const raw = await this.safeChat(makePrompt(false), "change-order-detector");
    const first = this.parseStructured(raw, ChangeOrderSchema);

    if (first.structuredOutputValid) {
      return { ...first, retried: false };
    }

    // Retry once with stricter prompt
    this.logger.warn(`[LLMNarrative] ChangeOrder JSON inválido, reintentando con prompt estricto...`);
    const raw2 = await this.safeChat(makePrompt(true), "change-order-detector");
    const second = this.parseStructured(raw2, ChangeOrderSchema);

    return {
      ...second,
      retried: true,
      rawOutput: second.structuredOutputValid ? undefined : (raw2 ?? undefined),
    };
  }

  // ── Risk narrative ─────────────────────────────────────────────────────────

  async generateRiskNarrative(input: RiskNarrativeInput): Promise<string | null> {
    if (!this.isReady()) return null;

    const signalSummary = input.signals
      .slice(0, 5)
      .map((s) => `- [${s.severity.toUpperCase()}] ${s.title}: ${s.message}`)
      .join("\n");

    const prompt = [
      `Eres el analista de riesgo operacional de SEMSE.`,
      `Genera un párrafo corto (3-4 oraciones) explicando el riesgo actual del proyecto en lenguaje claro para un supervisor.`,
      ``,
      `Nivel de riesgo: ${input.riskLevel}`,
      input.riskScore != null ? `Score de riesgo: ${input.riskScore}/100` : "",
      input.projectContext ? `Contexto: ${input.projectContext}` : "",
      ``,
      `Señales activas:`,
      signalSummary,
      ``,
      `Genera solo el párrafo de análisis.`,
    ].filter(Boolean).join("\n");

    return this.safeChat(prompt, "risk-narrator");
  }

  // ── Mission Control narrative ──────────────────────────────────────────────

  async generateMissionControlNarrative(input: MissionControlNarrativeInput): Promise<string | null> {
    if (!this.isReady()) return null;

    const topList = input.topSignals
      .slice(0, 3)
      .map((s) => `${s.title} (${s.severity})`)
      .join(", ");

    const prompt = [
      `Eres el briefing de Mission Control de SEMSE, sistema operativo de construcción.`,
      `Genera un resumen ejecutivo de 2-3 oraciones sobre el estado operacional actual.`,
      `Sé claro, directo y enfocado en acción. Sin emojis ni bullet points.`,
      ``,
      `Estado del sistema: ${input.systemStatus}`,
      `Señales totales: ${input.openSignalCount} (${input.criticalCount} críticas, ${input.highCount} altas)`,
      topList ? `Señales principales: ${topList}` : "",
      ``,
      `Genera solo el resumen ejecutivo.`,
    ].filter(Boolean).join("\n");

    return this.safeChat(prompt, "mission-control");
  }

  // ── Intake text interpretation ─────────────────────────────────────────────

  async interpretIntakeText(
    userText: string,
    expectedFields: string[],
  ): Promise<Record<string, unknown> | null> {
    if (!this.isReady()) return null;

    const prompt = [
      `Eres el intérprete de intake de SEMSE. Extrae datos estructurados de la descripción del cliente.`,
      ``,
      `DESCRIPCIÓN DEL CLIENTE:`,
      userText,
      ``,
      `CAMPOS A EXTRAER (los que puedas inferir):`,
      expectedFields.join(", "),
      ``,
      `Responde SOLO con JSON válido. Si no puedes inferir un campo, omítelo.`,
      `Ejemplo: {"trade": "painting", "rooms": 3, "missingFields": ["squareFeet"]}`,
    ].join("\n");

    const raw = await this.safeChat(prompt, "intake-interpreter");
    return this.parseJson<Record<string, unknown> | null>(raw, null);
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private isReady(): boolean {
    return this.enabled && !!this.llm;
  }

  private async safeChat(userMessage: string, profileName: AgentProfileName): Promise<string | null> {
    try {
      const ctx = getAgentProfile(profileName as Parameters<typeof getAgentProfile>[0]);
      const res = await this.llm!.chat({
        systemPrompt: "Eres el asistente operacional de SEMSE. Responde de forma concisa y útil.",
        history: [],
        userMessage,
        context: ctx,
      });
      return res.text?.trim() || null;
    } catch (err) {
      this.logger.warn(`[LLMNarrative] safeChat failed profile=${profileName}: ${(err as Error)?.message ?? String(err)}`);
      return null;
    }
  }

  private parseStructured<T>(
    raw: string | null,
    schema: z.ZodType<T>,
  ): StructuredOutputResult<T> {
    const fallback = { structuredOutputValid: false, retried: false } as Omit<StructuredOutputResult<T>, "data">;
    if (!raw) {
      return { ...fallback, data: undefined as unknown as T, parseError: "empty response", rawOutput: undefined };
    }
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return { ...fallback, data: undefined as unknown as T, parseError: "no JSON object found", rawOutput: raw.slice(0, 300) };
    }
    try {
      const parsed = JSON.parse(match[0]);
      const result = schema.safeParse(parsed);
      if (result.success) {
        return { data: result.data, structuredOutputValid: true, retried: false };
      }
      return {
        ...fallback,
        data: parsed as T,
        structuredOutputValid: false,
        parseError: result.error.message,
        rawOutput: match[0].slice(0, 300),
      };
    } catch (err) {
      return {
        ...fallback,
        data: undefined as unknown as T,
        parseError: `JSON.parse failed: ${(err as Error).message}`,
        rawOutput: match[0].slice(0, 300),
      };
    }
  }

  private parseJson<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return fallback;
      return JSON.parse(match[0]) as T;
    } catch {
      return fallback;
    }
  }
}
