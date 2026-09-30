import type { AiTaskType } from "../types/ai-task.types.js";
import type { AiModelCapability } from "../types/ai-capability.types.js";
import type { AiPrivacyLevel, AiCostTier } from "../types/ai-model.types.js";

export interface AiGenerateRequest {
  agentId?: string;
  projectId?: string;
  userId?: string;
  threadId?: string;
  taskType: AiTaskType;
  input: string;
  systemPrompt?: string;
  context?: string;
  retrievedContext?: unknown[];
  requiredCapabilities?: AiModelCapability[];
  privacyLevel?: AiPrivacyLevel;
  /** Hard constraint: never resolve to a non-private provider (SPEC-GTW-001). */
  privacyCritical?: boolean;
  /** Hard constraint: never resolve to a non-private provider (SPEC-GTW-001). */
  localOnly?: boolean;
  maxCostTier?: AiCostTier;
  preferredModelSlug?: string;
  forceModelSlug?: string;
  requireJson?: boolean;
  schema?: unknown;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
}
