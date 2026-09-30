import type { AiGenerateRequest } from "../dto/ai-generate-request.dto.js";

/**
 * Model slugs allowed to see privacy-restricted data: providers that run on
 * SEMSE-owned infrastructure. Everything else (Anthropic, OpenAI, DeepSeek,
 * Kimi, GLM-cloud) is external. See SPEC-GTW-001 §5 (product decision
 * 2026-08-14: GLM-Ollama is PRIVATE, GLM-cloud is not).
 */
export const PRIVATE_MODEL_SLUGS: ReadonlySet<string> = new Set(["ollama-local", "glm-ollama"]);

type PrivacyFields = Pick<AiGenerateRequest, "privacyLevel" | "privacyCritical" | "localOnly">;

/** True when the request must never leave private infrastructure. */
export function requiresPrivateProvider(request: PrivacyFields): boolean {
  return (
    request.privacyCritical === true ||
    request.localOnly === true ||
    request.privacyLevel === "local_only" ||
    request.privacyLevel === "sensitive" ||
    request.privacyLevel === "restricted"
  );
}

export function isPrivateModelSlug(slug: string): boolean {
  return PRIVATE_MODEL_SLUGS.has(slug);
}
