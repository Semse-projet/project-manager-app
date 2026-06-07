import { BadRequestException, Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { AiModelGatewayService } from "../ai-models/gateway/ai-model-gateway.service.js";
import { BudgetIntelligenceService } from "../intelligence/budget-intelligence.service.js";
import { JobsService } from "../jobs/jobs.service.js";
import { ProjectDraftService, type DraftFields, type ProjectDraftSnapshot } from "./project-draft.service.js";

const CATEGORIES_BLOCK = `
electricidad → instalacion_elec, panel, iluminacion
pintura → interior, exterior, decorativa
pisos → instalacion_piso, pulido, ceramica
plomeria → reparacion, instalacion, destapado
carpinteria → muebles, puertas, remodelacion
jardineria → mantenimiento, diseno, poda
`.trim();

function buildSystemPrompt(currentDraft: ProjectDraftSnapshot | null): string {
  const draftBlock = currentDraft
    ? `Estado actual del borrador:\n${JSON.stringify(currentDraft, null, 2)}`
    : "No hay borrador activo aún.";

  return `Eres un asistente conversacional de SEMSE que ayuda a usuarios a publicar trabajos de construcción y mantenimiento del hogar.

Tu objetivo es recopilar la información necesaria para publicar un trabajo mediante conversación natural en español.

Categorías disponibles:
${CATEGORIES_BLOCK}

${draftBlock}

INSTRUCCIONES IMPORTANTES:
1. Responde siempre en español de forma amigable y natural.
2. Haz una sola pregunta a la vez para recopilar información.
3. Cuando tengas información nueva del usuario, incluye un bloque [DRAFT] con el JSON actualizado ANTES de tu respuesta conversacional.
4. Si no tienes información sobre un campo, usa null en el JSON.
5. El formato EXACTO que debes usar es:

[DRAFT]
{
  "categoryId": "electricidad",
  "subcategoryId": "instalacion_elec",
  "title": "Instalación eléctrica residencial",
  "description": "Descripción del trabajo...",
  "city": "Miami",
  "locationType": "on_site",
  "budgetMin": null,
  "budgetMax": null,
  "urgency": "medium",
  "attachmentsExpected": false
}
[/DRAFT]

Texto de tu respuesta conversacional aquí.

6. Solo incluye el bloque [DRAFT] cuando tengas información nueva o actualizada del usuario.
7. Guía al usuario a través de: categoría → especialidad → título y descripción → ciudad → presupuesto.
8. Si el usuario menciona "fotos", "planos", "archivos", "documentos" o "imágenes", establece "attachmentsExpected": true.`;
}

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type BudgetSuggestionSnapshot = {
  min: number;
  max: number;
  median: number;
  confidence: "high" | "medium" | "low";
  aiNarrative: string;
};

export type AssistantPublishJobInput = {
  message: string;
  draftId?: string;
  sessionId?: string;
  tenantId: string;
  orgId: string;
  userId: string;
  pageRoute?: string;
};

export type AssistantPublishJobOutput = {
  reply: string;
  draftId: string;
  draft: ProjectDraftSnapshot;
  prefillHref: string;
  completion: number;
  sessionId: string;
  readyToFill: boolean;
  budgetSuggestion?: BudgetSuggestionSnapshot;
};

export type AssistantConfirmDraftOutput = {
  draft: ProjectDraftSnapshot;
  prefillHref: string;
};

export type AssistantPublishFromDraftOutput = {
  jobId: string;
  draft: ProjectDraftSnapshot;
  jobUrl: string;
};

function parseDraftBlock(text: string): Partial<DraftFields> | null {
  const match = /\[DRAFT\]([\s\S]*?)\[\/DRAFT\]/i.exec(text);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim()) as Record<string, unknown>;
    return {
      categoryId: typeof parsed.categoryId === "string" ? parsed.categoryId : null,
      subcategoryId: typeof parsed.subcategoryId === "string" ? parsed.subcategoryId : null,
      title: typeof parsed.title === "string" ? parsed.title : null,
      description: typeof parsed.description === "string" ? parsed.description : null,
      city: typeof parsed.city === "string" ? parsed.city : null,
      locationType: typeof parsed.locationType === "string" ? parsed.locationType : null,
      budgetMin: typeof parsed.budgetMin === "number" ? parsed.budgetMin : null,
      budgetMax: typeof parsed.budgetMax === "number" ? parsed.budgetMax : null,
      urgency: typeof parsed.urgency === "string" ? parsed.urgency : null,
      attachmentsExpected: parsed.attachmentsExpected === true,
    };
  } catch {
    return null;
  }
}

function cleanReply(text: string): string {
  return text.replace(/\[DRAFT\][\s\S]*?\[\/DRAFT\]/i, "").trim();
}

function buildPrefillHref(draft: ProjectDraftSnapshot): string {
  const params = new URLSearchParams();
  if (draft.categoryId) params.set("category", draft.categoryId);
  if (draft.subcategoryId) params.set("subcategory", draft.subcategoryId);
  if (draft.title) params.set("title", draft.title);
  if (draft.description) params.set("description", draft.description);
  if (draft.city) params.set("city", draft.city);
  if (draft.locationType) params.set("locationType", draft.locationType);
  if (draft.budgetMin != null) params.set("budgetMin", String(draft.budgetMin));
  if (draft.budgetMax != null) params.set("budgetMax", String(draft.budgetMax));
  if (draft.urgency) params.set("urgency", draft.urgency);
  const qs = params.toString();
  return `/client/jobs/new${qs ? `?${qs}` : ""}`;
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly draftService: ProjectDraftService,
    private readonly gateway: AiModelGatewayService,
    @Optional() private readonly budgetService: BudgetIntelligenceService | null,
    @Optional() private readonly jobsService: JobsService | null,
  ) {}

  async handlePublishJob(input: AssistantPublishJobInput): Promise<AssistantPublishJobOutput> {
    const { message, tenantId, orgId, userId, pageRoute } = input;

    let session = input.sessionId
      ? await this.prisma.conversationSession.findFirst({ where: { id: input.sessionId, tenantId } })
      : null;

    if (!session) {
      session = await this.prisma.conversationSession.create({
        data: { tenantId, userId, flow: "publish_job", pageRoute: pageRoute ?? null, messages: [] },
      });
    }

    let draft = input.draftId ? await this.draftService.getDraft(input.draftId, tenantId) : null;
    if (!draft) {
      draft = await this.draftService.createDraft(tenantId, orgId, userId);
      await this.logAction({ tenantId, userId, sessionId: session.id, draftId: draft.id, actionType: "draft_created", payload: {} });
    }

    const history = Array.isArray(session.messages) ? (session.messages as ConversationMessage[]) : [];
    const systemPrompt = buildSystemPrompt(draft);
    const conversationHistory = history
      .map((m) => `${m.role === "user" ? "Usuario" : "Asistente"}: ${m.content}`)
      .join("\n");
    const fullInput = conversationHistory ? `${conversationHistory}\nUsuario: ${message}` : message;

    let rawResponse = "";
    try {
      const result = await this.gateway.generate({
        taskType: "general_chat",
        input: fullInput,
        systemPrompt,
        maxTokens: 600,
      });
      rawResponse = result.output ?? "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[assistant] LLM call failed: ${msg}`);
      rawResponse = "Entendido, continuemos con tu solicitud. ¿Cuál es la categoría del trabajo que necesitas?";
    }

    const draftFields = parseDraftBlock(rawResponse);
    if (draftFields) {
      const merged: DraftFields = {
        categoryId: draftFields.categoryId ?? draft.categoryId ?? null,
        subcategoryId: draftFields.subcategoryId ?? draft.subcategoryId ?? null,
        title: draftFields.title ?? draft.title ?? null,
        description: draftFields.description ?? draft.description ?? null,
        city: draftFields.city ?? draft.city ?? null,
        locationType: draftFields.locationType ?? draft.locationType ?? null,
        budgetMin: draftFields.budgetMin ?? draft.budgetMin ?? null,
        budgetMax: draftFields.budgetMax ?? draft.budgetMax ?? null,
        urgency: draftFields.urgency ?? draft.urgency ?? null,
        attachmentsExpected: draftFields.attachmentsExpected ?? draft.attachmentsExpected ?? false,
      };
      draft = await this.draftService.updateDraft(draft.id, tenantId, merged);
      await this.logAction({ tenantId, userId, sessionId: session.id, draftId: draft.id, actionType: "fields_updated", payload: draftFields as Record<string, unknown> });
    }

    const cleanText = cleanReply(rawResponse);
    const reply = cleanText || rawResponse;

    const updatedMessages: ConversationMessage[] = [
      ...history,
      { role: "user", content: message },
      { role: "assistant", content: reply },
    ];

    await this.prisma.conversationSession.update({
      where: { id: session.id },
      data: {
        draftId: draft.id,
        messages: updatedMessages as unknown as Parameters<typeof this.prisma.conversationSession.update>[0]["data"]["messages"],
        updatedAt: new Date(),
      },
    });

    let budgetSuggestion: BudgetSuggestionSnapshot | undefined;
    if (draft.completion >= 70 && draft.budgetMin == null && draft.title && draft.description) {
      budgetSuggestion = await this.triggerBudgetSuggestion({ tenantId, draft, userId, sessionId: session.id });
    }

    const prefillHref = buildPrefillHref(draft);

    return {
      reply,
      draftId: draft.id,
      draft,
      prefillHref,
      completion: draft.completion,
      sessionId: session.id,
      readyToFill: draft.completion >= 70,
      budgetSuggestion,
    };
  }

  async confirmDraft(draftId: string, tenantId: string, userId: string): Promise<AssistantConfirmDraftOutput> {
    const draft = await this.draftService.confirmDraft(draftId, tenantId);
    await this.logAction({ tenantId, userId, draftId, actionType: "draft_confirmed", payload: { completion: draft.completion } });
    return { draft, prefillHref: buildPrefillHref(draft) };
  }

  async publishFromDraft(draftId: string, tenantId: string, orgId: string, userId: string, requestId: string): Promise<AssistantPublishFromDraftOutput> {
    const draft = await this.draftService.getDraft(draftId, tenantId);
    if (!draft) throw new BadRequestException("Draft not found");
    if (!draft.title || draft.title.length < 3) throw new BadRequestException("Draft is missing a title");
    if (!draft.description || draft.description.length < 10) throw new BadRequestException("Draft is missing a description");
    if (draft.status === "published" && draft.publishedJobId) {
      return { jobId: draft.publishedJobId, draft, jobUrl: `/client/jobs/${draft.publishedJobId}` };
    }
    if (!this.jobsService) throw new BadRequestException("Job creation service unavailable");

    const locationType = (draft.locationType === "remote" || draft.locationType === "hybrid")
      ? draft.locationType as "remote" | "hybrid"
      : "on_site";

    const job = await this.jobsService.create({
      tenantId,
      orgId,
      userId,
      title: draft.title,
      category: draft.categoryId ?? undefined,
      scope: draft.description,
      budgetType: draft.budgetMin != null ? "range" : undefined,
      budgetMin: draft.budgetMin ?? undefined,
      budgetMax: draft.budgetMax ?? undefined,
      locationType,
      city: draft.city ?? undefined,
      urgency: draft.urgency ?? undefined,
      requestId,
    });

    const published = await this.draftService.markPublished(draftId, tenantId, job.id);
    await this.logAction({ tenantId, userId, draftId, actionType: "job_published", payload: { jobId: job.id } });

    return { jobId: job.id, draft: published, jobUrl: `/client/jobs/${job.id}` };
  }

  private async triggerBudgetSuggestion(input: {
    tenantId: string;
    draft: ProjectDraftSnapshot;
    userId: string;
    sessionId: string;
  }): Promise<BudgetSuggestionSnapshot | undefined> {
    if (!this.budgetService) return undefined;
    try {
      const suggestion = await this.budgetService.suggestBudget({
        tenantId: input.tenantId,
        userId: input.userId,
        title: input.draft.title ?? "",
        scope: input.draft.description ?? "",
        category: input.draft.categoryId ?? undefined,
        location: input.draft.city ?? undefined,
      });
      if (suggestion.min > 0) {
        await this.draftService.updateDraft(input.draft.id, input.tenantId, {
          budgetMin: suggestion.min,
          budgetMax: suggestion.max,
          categoryId: input.draft.categoryId ?? null,
          subcategoryId: input.draft.subcategoryId ?? null,
          title: input.draft.title ?? null,
          description: input.draft.description ?? null,
          city: input.draft.city ?? null,
          locationType: input.draft.locationType ?? null,
          urgency: input.draft.urgency ?? null,
          attachmentsExpected: input.draft.attachmentsExpected,
        });
        await this.logAction({
          tenantId: input.tenantId,
          userId: input.userId,
          sessionId: input.sessionId,
          draftId: input.draft.id,
          actionType: "budget_triggered",
          payload: { min: suggestion.min, max: suggestion.max, confidence: suggestion.confidence },
        });
      }
      return { min: suggestion.min, max: suggestion.max, median: suggestion.median, confidence: suggestion.confidence, aiNarrative: suggestion.aiNarrative };
    } catch (err) {
      this.logger.warn(`[assistant] budget suggestion failed: ${err instanceof Error ? err.message : String(err)}`);
      return undefined;
    }
  }

  private async logAction(entry: {
    tenantId: string;
    userId: string;
    sessionId?: string;
    draftId?: string;
    actionType: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.assistantActionLog.create({
        data: {
          tenantId: entry.tenantId,
          userId: entry.userId,
          sessionId: entry.sessionId ?? null,
          draftId: entry.draftId ?? null,
          actionType: entry.actionType,
          payload: entry.payload as unknown as import("@prisma/client").Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(`[assistant] action log failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export { parseDraftBlock };
