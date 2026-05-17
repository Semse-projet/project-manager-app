import { Injectable, Logger, Optional } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { LLMOrchestrator } from "../../infrastructure/llm/orchestrator.js";
import { getAgentProfile } from "../../infrastructure/llm/agent-profiles.js";
import { OperationalSignalsService } from "./operational-signals.service.js";

// ── Zod schema for LLM structured output ──────────────────────────────────────

export const EvidenceReviewLLMSchema = z.object({
  reviewStatus: z.enum([
    "approved_suggestion",
    "needs_reupload",
    "missing_context",
    "possible_mismatch",
    "rejected_suggestion",
    "manual_review_required",
  ]),
  confidence:         z.number().min(0).max(1),
  riskLevel:          z.enum(["low", "medium", "high", "critical"]),
  findings:           z.array(z.string()),
  requiredActions:    z.array(z.string()),
  recommendedAction:  z.string(),
  disputeRisk:        z.boolean(),
  auditReason:        z.string(),
});

export type EvidenceReviewLLMOutput = z.infer<typeof EvidenceReviewLLMSchema>;

export type EvidenceReviewResult = EvidenceReviewLLMOutput & {
  evidenceItemId:    string;
  milestoneId:       string;
  statusBefore:      string;
  label:             string;
  kind:              string;
  privacyMode:       "privacyCritical";
  provider:          string;
  model?:            string;
  fallbackUsed:      boolean;
  structuredOutputValid: boolean;
  rawOutputStored?:  boolean;
  reviewedAt:        string;
};

// ── Fallback rule-based review (when LLM unavailable) ────────────────────────

function rulesBasedReview(
  status: string,
  label: string,
  description: string | null,
): EvidenceReviewLLMOutput {
  if (status === "approved") {
    return {
      reviewStatus: "approved_suggestion",
      confidence: 0.7,
      riskLevel: "low",
      findings: [`Evidence item '${label}' has already been approved`],
      requiredActions: [],
      recommendedAction: "No action needed",
      disputeRisk: false,
      auditReason: "Evidence item status is approved — rule-based review",
    };
  }
  if (status === "rejected") {
    return {
      reviewStatus: "rejected_suggestion",
      confidence: 0.8,
      riskLevel: "high",
      findings: [`Evidence item '${label}' was previously rejected`],
      requiredActions: [`Reupload evidence for: ${label}`],
      recommendedAction: "Request reupload",
      disputeRisk: true,
      auditReason: "Evidence item was rejected — rule-based review",
    };
  }
  if (status === "missing") {
    return {
      reviewStatus: "needs_reupload",
      confidence: 0.9,
      riskLevel: "medium",
      findings: [`Evidence item '${label}' has not been submitted`],
      requiredActions: [`Upload evidence for: ${label}`, description ? `Required: ${description}` : ""].filter(Boolean),
      recommendedAction: "Request upload",
      disputeRisk: false,
      auditReason: "Evidence item is missing — rule-based review",
    };
  }
  // submitted
  return {
    reviewStatus: "manual_review_required",
    confidence: 0.5,
    riskLevel: "medium",
    findings: [`Evidence item '${label}' is submitted and awaiting review`],
    requiredActions: ["Human reviewer must verify this evidence"],
    recommendedAction: "Manual review required",
    disputeRisk: false,
    auditReason: "LLM not available — rule-based fallback, manual review recommended",
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class EvidenceReviewService {
  private readonly logger = new Logger(EvidenceReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly llm?: LLMOrchestrator,
    @Optional() private readonly signals?: OperationalSignalsService,
  ) {}

  async runReview(input: {
    evidenceItemId: string;
    tenantId:       string;
    reviewedById:   string;
    locale?:        "es" | "en";
    forceRulesOnly?: boolean;
  }): Promise<EvidenceReviewResult> {

    // ── 1. Load evidence item with milestone context ───────────────────────
    const item = await this.prisma.milestoneEvidenceItem.findUnique({
      where: { id: input.evidenceItemId },
    });

    if (!item) throw new Error(`EvidenceItem ${input.evidenceItemId} not found`);

    // Verify tenant via milestone → project
    const milestoneBase = await this.prisma.milestone.findFirst({
      where: { id: item.milestoneId, project: { tenantId: input.tenantId } },
      select: { id: true, title: true },
    });
    if (!milestoneBase) throw new Error("Forbidden");

    // Load sibling evidence items for context
    const siblingItems = await this.prisma.milestoneEvidenceItem.findMany({
      where: { milestoneId: item.milestoneId },
      select: { id: true, status: true, required: true },
    });

    const totalRequired = siblingItems.filter((e) => e.required).length;
    const approvedRequired = siblingItems.filter((e) => e.required && e.status === "approved").length;
    const milestoneTitle = milestoneBase.title;

    // ── 2. Run LLM or rules-based review ─────────────────────────────────
    const isEs = (input.locale ?? "es") === "es";
    let llmResult: EvidenceReviewLLMOutput | null = null;
    let provider = "rules";
    let model: string | undefined;
    let fallbackUsed = false;
    let structuredOutputValid = false;

    if (!input.forceRulesOnly && this.llm) {
      const prompt = this.buildPrompt(
        item,
        { title: milestoneTitle ?? null },
        approvedRequired,
        totalRequired,
        isEs,
      );

      try {
        const res = await this.llm.chat({
          systemPrompt: isEs
            ? "Eres el agente revisor de evidencia de SEMSE. Analiza si la evidencia de un milestone es suficiente."
            : "You are SEMSE evidence review agent. Analyze if milestone evidence is sufficient.",
          history: [],
          userMessage: prompt,
          context: {
            ...getAgentProfile("evidence-analyzer"),
            agentName: "evidence-review",
            source: "evidence-review-agent",
          },
        });

        provider = res.provider;
        model = res.model;
        fallbackUsed = res.metadata.fallbackUsed;

        // Parse and validate LLM output
        const parsed = this.parseStructured(res.text, EvidenceReviewLLMSchema);
        if (parsed.success) {
          llmResult = parsed.data;
          structuredOutputValid = true;
        } else {
          // Retry with simpler prompt
          this.logger.warn(`[EvidenceReview] First attempt invalid JSON — retrying`);
          const simplePrompt = this.buildSimplePrompt(item, isEs);
          const res2 = await this.llm.chat({
            systemPrompt: "Respond ONLY with valid JSON.",
            history: [],
            userMessage: simplePrompt,
            context: {
              ...getAgentProfile("evidence-analyzer"),
              agentName: "evidence-review:retry",
              source: "evidence-review-agent",
            },
          });
          const parsed2 = this.parseStructured(res2.text, EvidenceReviewLLMSchema);
          if (parsed2.success) {
            llmResult = parsed2.data;
            structuredOutputValid = true;
          } else {
            this.logger.warn(`[EvidenceReview] Retry also invalid — falling back to rules`);
          }
        }
      } catch (err) {
        this.logger.warn(`[EvidenceReview] LLM failed: ${(err as Error).message} — using rules fallback`);
        fallbackUsed = true;
        provider = "rules";
      }
    }

    // ── 3. Use rules if LLM failed or unavailable ─────────────────────────
    const reviewOutput = llmResult ?? rulesBasedReview(item.status, item.label, item.description);

    // ── 4. Persist review in reviewNote ──────────────────────────────────
    const reviewedAt = new Date();
    const reviewNoteJson = JSON.stringify({
      __agentReview: {
        ...reviewOutput,
        provider,
        model,
        fallbackUsed,
        structuredOutputValid,
        reviewedBy: "evidence-review-agent",
        reviewedById: input.reviewedById,
        reviewedAt: reviewedAt.toISOString(),
      },
    });

    await this.prisma.milestoneEvidenceItem.update({
      where: { id: input.evidenceItemId },
      data: {
        reviewNote:   reviewNoteJson,
        reviewedById: input.reviewedById,
        reviewedAt:   reviewedAt,
      },
    });

    // ── 5. Create Mission Control signal if high/critical risk ────────────
    if (
      this.signals &&
      (reviewOutput.riskLevel === "high" || reviewOutput.riskLevel === "critical") &&
      reviewOutput.disputeRisk
    ) {
      await this.signals.upsertSignal({
        tenantId:       input.tenantId,
        type:           "EVIDENCE_GAP",
        severity:       reviewOutput.riskLevel === "critical" ? "critical" : "high",
        title:          `Evidence review: ${reviewOutput.reviewStatus.replace(/_/g, " ")}`,
        message:        `Evidence item '${item.label}': ${reviewOutput.auditReason}`,
        recommendedAction: reviewOutput.requiredActions[0],
        sourceAgent:    "EvidenceReviewAgent",
        entityType:     "MilestoneEvidenceItem",
        entityId:       item.id,
        milestoneId:    item.milestoneId,
        metadataJson:   { reviewStatus: reviewOutput.reviewStatus, confidence: reviewOutput.confidence },
      }).catch((signalErr: unknown) => {
        this.logger.warn(`[EvidenceReview] Could not create signal: ${(signalErr as Error).message}`);
      });
    }

    return {
      ...reviewOutput,
      evidenceItemId:       item.id,
      milestoneId:          item.milestoneId,
      statusBefore:         item.status,
      label:                item.label,
      kind:                 item.kind,
      privacyMode:          "privacyCritical",
      provider,
      model,
      fallbackUsed,
      structuredOutputValid,
      reviewedAt:           reviewedAt.toISOString(),
    };
  }

  async getLastReview(evidenceItemId: string, tenantId: string): Promise<EvidenceReviewResult | null> {
    const item = await this.prisma.milestoneEvidenceItem.findUnique({
      where: { id: evidenceItemId },
    });
    if (!item) return null;

    // Verify tenant via milestone → project
    const milestone = await this.prisma.milestone.findFirst({
      where: { id: item.milestoneId, project: { tenantId } },
      select: { id: true },
    });
    if (!milestone) return null;
    if (!item.reviewNote) return null;

    try {
      const parsed = JSON.parse(item.reviewNote);
      if (parsed.__agentReview) {
        return { ...parsed.__agentReview, evidenceItemId: item.id, milestoneId: item.milestoneId };
      }
    } catch { /* invalid JSON */ }
    return null;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private buildPrompt(
    item: { label: string; description: string | null; kind: string; phase: string; status: string; required: boolean },
    milestone: { title?: string | null },
    approvedRequired: number,
    totalRequired: number,
    isEs: boolean,
  ): string {
    if (isEs) {
      return [
        `Eres el revisor de evidencia de SEMSE. Analiza si esta evidencia es suficiente para el milestone.`,
        ``,
        `MILESTONE: ${(milestone as { title?: string | null }).title ?? "Sin título"}`,
        `EVIDENCIA REQUERIDA: ${item.label} (${item.kind}, fase: ${item.phase}, requerida: ${item.required})`,
        `DESCRIPCIÓN: ${item.description ?? "Sin descripción"}`,
        `ESTADO ACTUAL: ${item.status}`,
        `PROGRESO: ${approvedRequired}/${totalRequired} items requeridos aprobados`,
        ``,
        `Responde SOLO con este JSON (sin texto adicional):`,
        `{`,
        `  "reviewStatus": "approved_suggestion|needs_reupload|missing_context|possible_mismatch|rejected_suggestion|manual_review_required",`,
        `  "confidence": 0.0-1.0,`,
        `  "riskLevel": "low|medium|high|critical",`,
        `  "findings": ["hallazgo 1", "hallazgo 2"],`,
        `  "requiredActions": ["acción 1"],`,
        `  "recommendedAction": "acción principal",`,
        `  "disputeRisk": true/false,`,
        `  "auditReason": "razón auditable"`,
        `}`,
      ].join("\n");
    }
    return [
      `You are the SEMSE evidence reviewer. Analyze if this evidence is sufficient for the milestone.`,
      ``,
      `MILESTONE: ${(milestone as { title?: string | null }).title ?? "Untitled"}`,
      `REQUIRED EVIDENCE: ${item.label} (${item.kind}, phase: ${item.phase}, required: ${item.required})`,
      `DESCRIPTION: ${item.description ?? "No description"}`,
      `CURRENT STATUS: ${item.status}`,
      `PROGRESS: ${approvedRequired}/${totalRequired} required items approved`,
      ``,
      `Respond ONLY with this JSON (no extra text):`,
      `{"reviewStatus":"approved_suggestion|needs_reupload|missing_context|possible_mismatch|rejected_suggestion|manual_review_required","confidence":0.0,"riskLevel":"low|medium|high|critical","findings":["finding"],"requiredActions":["action"],"recommendedAction":"action","disputeRisk":false,"auditReason":"reason"}`,
    ].join("\n");
  }

  private buildSimplePrompt(
    item: { label: string; status: string; required: boolean },
    isEs: boolean,
  ): string {
    if (isEs) {
      return `Evidencia "${item.label}", estado: ${item.status}, requerida: ${item.required}. Responde SOLO con JSON: {"reviewStatus":"needs_reupload","confidence":0.7,"riskLevel":"medium","findings":["descripción"],"requiredActions":["acción"],"recommendedAction":"acción","disputeRisk":false,"auditReason":"razón"}`;
    }
    return `Evidence "${item.label}", status: ${item.status}, required: ${item.required}. Respond ONLY with JSON: {"reviewStatus":"needs_reupload","confidence":0.7,"riskLevel":"medium","findings":["finding"],"requiredActions":["action"],"recommendedAction":"action","disputeRisk":false,"auditReason":"reason"}`;
  }

  private parseStructured<T>(
    raw: string,
    schema: z.ZodType<T>,
  ): { success: true; data: T } | { success: false; error: string } {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { success: false, error: "no JSON object found" };
    try {
      const parsed = JSON.parse(match[0]);
      const result = schema.safeParse(parsed);
      if (result.success) return { success: true, data: result.data };
      return { success: false, error: result.error.message };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
