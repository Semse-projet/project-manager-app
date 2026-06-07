import type { AiModelCapability } from "./ai-capability.types.js";
import type { AiProviderName, AiProviderMode } from "./ai-provider.types.js";

export type AiCostTier = "very_low" | "low" | "medium" | "high" | "premium";
export type AiPrivacyLevel = "local_only" | "internal" | "standard_external" | "sensitive" | "restricted";

export interface AiModelDefinition {
  slug: string;
  provider: AiProviderName;
  providerMode: AiProviderMode;
  displayName: string;
  modelName: string;
  enabled: boolean;
  capabilities: AiModelCapability[];
  bestFor: string[];
  contextWindowTokens?: number;
  costTier: AiCostTier;
  privacyLevel: AiPrivacyLevel;
  supportsStreaming?: boolean;
  supportsJsonMode?: boolean;
  supportsToolUse?: boolean;
}
