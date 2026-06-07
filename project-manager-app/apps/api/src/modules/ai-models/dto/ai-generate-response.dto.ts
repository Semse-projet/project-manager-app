export interface AiGenerateResponse {
  output: string;
  provider: string;
  modelSlug: string;
  modelName: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
  latencyMs?: number;
  routeReason?: string;
  fallbackUsed?: boolean;
  validatorUsed?: boolean;
  raw?: unknown;
  success: boolean;
  errorMessage?: string;
}
