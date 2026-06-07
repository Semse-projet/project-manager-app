import { Injectable, Logger, Optional } from "@nestjs/common";
import { LLMOrchestrator } from "../../infrastructure/llm/orchestrator.js";
import { getAgentProfile } from "../../infrastructure/llm/agent-profiles.js";
import { z } from "zod";
import { PrometeoService } from "./prometeo.service.js";

// ── Schema ────────────────────────────────────────────────────────────────────

const TradeGuideSchema = z.object({
  answer:         z.string(),
  steps:          z.array(z.string()).optional(),
  warnings:       z.array(z.string()).optional(),
  evidenceNeeded: z.array(z.string()).optional(),
  nextAction:     z.string().optional(),
  confidence:     z.number().min(0).max(1),
  insufficientContext: z.boolean().optional(),
});

export type TradeGuideResult = z.infer<typeof TradeGuideSchema> & {
  citations: Array<{ documentId: string; documentTitle: string; excerpt: string }>;
  provider:   string;
  model?:     string;
  fallbackUsed: boolean;
  trade:      string;
};

const TRADE_LABELS: Record<string, string> = {
  electrical: "electricidad", plumbing: "plomería", drywall: "drywall",
  painting: "pintura", carpentry: "carpintería", hvac: "HVAC",
  siding: "siding", demolition: "demolición", cleaning: "limpieza",
  bathroom: "baños", kitchen: "cocinas", windows_doors: "ventanas/puertas",
  general: "construcción general",
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class TradeGuideService {
  private readonly logger = new Logger(TradeGuideService.name);

  constructor(
    private readonly rag: PrometeoService,
    @Optional() private readonly llm?: LLMOrchestrator,
  ) {}

  async guide(input: {
    question:    string;
    trade:       string;
    tenantId:    string;
    projectId?:  string;
    locale?:     "es" | "en";
  }): Promise<TradeGuideResult> {
    const locale = input.locale ?? "es";
    const tradeLabel = TRADE_LABELS[input.trade] ?? input.trade;

    // 1. Retrieve context from trade library
    const ctx = await this.rag.retrieveContext({
      query:     input.question,
      tenantId:  input.tenantId,
      projectId: input.projectId,
      trade:     input.trade,
      topK:      5,
    });

    // 2. No documents → return insufficientContext
    if (!ctx.available) {
      return {
        answer: locale === "es"
          ? `No hay documentos de ${tradeLabel} indexados en Prometeo todavía. Ingesta manuales o guías de ${tradeLabel} para que pueda responder.`
          : `No documents for ${input.trade} are indexed in Prometeo yet. Please ingest manuals or guides for this trade.`,
        steps: [], warnings: [], evidenceNeeded: [], nextAction: undefined,
        confidence: 0, insufficientContext: true,
        citations: [], provider: "rules", fallbackUsed: false, trade: input.trade,
      };
    }

    // 3. Build prompt
    const systemPrompt = locale === "es"
      ? `Eres el guía técnico de SEMSE para trabajos de ${tradeLabel}. Responde usando SOLO el contexto documental proporcionado. Incluye pasos prácticos, advertencias de seguridad y evidencia requerida para SEMSE. No reemplaces inspecciones locales ni licencias profesionales. Cita la fuente cuando sea posible.`
      : `You are SEMSE technical guide for ${input.trade} work. Answer using ONLY the provided document context. Include practical steps, safety warnings and evidence required for SEMSE. Do not replace local inspections or professional licenses. Cite sources when possible.`;

    const userMessage = [
      ctx.contextBlock,
      `---`,
      locale === "es" ? `Pregunta: ${input.question}` : `Question: ${input.question}`,
      ``,
      locale === "es"
        ? `Responde en JSON: {"answer":"...","steps":["paso 1","paso 2"],"warnings":["advertencia"],"evidenceNeeded":["evidencia SEMSE requerida"],"nextAction":"...","confidence":0.0-1.0,"insufficientContext":false}`
        : `Answer in JSON: {"answer":"...","steps":["step 1"],"warnings":["warning"],"evidenceNeeded":["SEMSE evidence needed"],"nextAction":"...","confidence":0.0-1.0,"insufficientContext":false}`,
    ].join("\n");

    // 4. LLM call — uses public_training profile (not strictly privacyCritical, but local-first)
    let result: z.infer<typeof TradeGuideSchema> | null = null;
    let provider = "rules"; let model: string | undefined; let fallbackUsed = false;

    if (this.llm) {
      try {
        const res = await this.llm.chat({
          systemPrompt,
          history: [],
          userMessage,
          context: {
            ...getAgentProfile("prometeo-chat"),
            agentName: `trade-guide:${input.trade}`,
            source: "trade-guide",
          },
        });
        provider = res.provider; model = res.model; fallbackUsed = res.metadata.fallbackUsed;

        const match = res.text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            const parsed = TradeGuideSchema.safeParse(JSON.parse(match[0]));
            if (parsed.success) result = parsed.data;
          } catch { /* fall through to rules */ }
        }
        if (!result) { result = { answer: res.text, confidence: 0.5 }; }
      } catch (err) {
        this.logger.warn(`[TradeGuide] LLM failed: ${(err as Error).message}`);
        provider = "rules"; fallbackUsed = true;
      }
    }

    // 5. Fallback: summarize top chunk
    if (!result) {
      const topChunk = ctx.citations[0];
      result = {
        answer: locale === "es"
          ? `Del manual "${topChunk?.documentTitle ?? "documento"}": ${topChunk?.excerpt ?? "Sin extracto disponible"}`
          : `From manual "${topChunk?.documentTitle ?? "document"}": ${topChunk?.excerpt ?? "No excerpt available"}`,
        confidence: 0.4,
      };
    }

    return {
      ...result,
      citations:    ctx.citations,
      provider,
      model,
      fallbackUsed,
      trade:        input.trade,
    };
  }
}
