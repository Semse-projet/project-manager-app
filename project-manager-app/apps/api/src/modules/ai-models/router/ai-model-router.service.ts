import { Injectable } from "@nestjs/common";
import type { AiGenerateRequest } from "../dto/ai-generate-request.dto.js";
import { getEnabledModels } from "../registry/model-registry.js";

export type AiModelRoute = {
  primaryModelSlug: string;
  fallbackModelSlug?: string;
  validatorModelSlug?: string;
  reason: string;
};

@Injectable()
export class AiModelRouterService {
  selectRoute(request: AiGenerateRequest): AiModelRoute {
    const enabled = new Set(getEnabledModels().map((m) => m.slug));
    const has = (slug: string) => enabled.has(slug);

    // Forced model
    if (request.forceModelSlug) {
      return { primaryModelSlug: request.forceModelSlug, reason: "Forced model." };
    }

    // Privacy: local only
    if (request.privacyLevel === "local_only") {
      return { primaryModelSlug: "ollama-local", reason: "Local-only privacy." };
    }

    const { taskType } = request;

    // Construction contracts + long-context docs → Kimi (or Claude fallback)
    if (taskType === "construction_contract_analysis" || taskType === "submittal_review" || taskType === "permit_compliance") {
      const primary = has("kimi-k2") ? "kimi-k2" : "claude-sonnet";
      const fallback = primary === "kimi-k2" ? "claude-sonnet" : "openai-gpt4";
      return { primaryModelSlug: primary, fallbackModelSlug: fallback, validatorModelSlug: "claude-sonnet", reason: "Construction docs benefit from long context." };
    }

    // Planning, risk, estimates → DeepSeek Reasoner (or Claude)
    if (taskType === "project_planning" || taskType === "risk_analysis" || taskType === "estimate_review" || taskType === "bid_analysis") {
      const primary = has("deepseek-reasoner") ? "deepseek-reasoner" : "claude-sonnet";
      const fallback = primary === "deepseek-reasoner" ? "claude-sonnet" : "openai-gpt4";
      return { primaryModelSlug: primary, fallbackModelSlug: fallback, validatorModelSlug: "claude-sonnet", reason: "Planning/risk tasks benefit from reasoning." };
    }

    // Code generation
    if (taskType === "code_generation") {
      const primary = has("deepseek-reasoner") ? "deepseek-reasoner" : "claude-sonnet";
      return { primaryModelSlug: primary, fallbackModelSlug: "claude-sonnet", reason: "Code generation routed to reasoning model." };
    }

    // Architecture review → Claude
    if (taskType === "architecture_review") {
      return { primaryModelSlug: "claude-sonnet", fallbackModelSlug: has("openai-gpt4") ? "openai-gpt4" : "claude-sonnet", reason: "Architecture review requires premium reasoning." };
    }

    // RAG answers → current active LLM (Claude)
    if (taskType === "rag_answer") {
      return { primaryModelSlug: "claude-sonnet", reason: "RAG answers via primary reasoning model." };
    }

    // Document summaries → DeepSeek Chat (cheap) or Kimi (long)
    if (taskType === "document_summary" || taskType === "field_report_generation") {
      const primary = has("deepseek-chat") ? "deepseek-chat" : has("kimi-k2") ? "kimi-k2" : "claude-sonnet";
      return { primaryModelSlug: primary, fallbackModelSlug: "claude-sonnet", reason: "Summarization routed to cost-efficient model." };
    }

    // RFI / field ops
    if (taskType === "rfi_generation" || taskType === "predictive_maintenance") {
      const primary = has("kimi-k2") ? "kimi-k2" : "claude-sonnet";
      return { primaryModelSlug: primary, fallbackModelSlug: "claude-sonnet", reason: "Field tasks benefit from document analysis." };
    }

    // Evaluation / training data
    if (taskType === "model_evaluation" || taskType === "training_data_generation") {
      return { primaryModelSlug: "claude-sonnet", fallbackModelSlug: has("openai-gpt4") ? "openai-gpt4" : "claude-sonnet", reason: "Evaluation requires high-quality reasoning." };
    }

    // General chat → DeepSeek Chat (cost-efficient) or Claude
    const defaultPrimary = has("deepseek-chat") ? "deepseek-chat" : "claude-sonnet";
    return { primaryModelSlug: defaultPrimary, fallbackModelSlug: "claude-sonnet", reason: "Default route: cost-efficient model." };
  }
}
