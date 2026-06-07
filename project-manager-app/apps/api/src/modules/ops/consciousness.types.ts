// ── SEMSE Consciousness Index v1 ─────────────────────────────────────────────
// Read-only snapshot of the ecosystem's state, identity, and health.
// MUST NOT modify any data, trigger payments, or touch infrastructure.

export type ModuleStatus = "mature" | "functional" | "partial" | "minimal" | "missing";

export type ModuleHealth = {
  name: string;
  status: ModuleStatus;
  maturityScore: number;   // 0–100
  hasBackend: boolean;
  hasFrontend: boolean;
  hasTests: boolean;
  hasSSE: boolean;
  hasRAG: boolean;
  hasAudit: boolean;
  hasPermissions: boolean;
  notes: string[];
};

export type ServiceHealth = {
  name: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
};

export type LlmProviderStatus = {
  name: string;
  available: boolean;
  isDefault: boolean;
  latencyMs?: number;
  successCount: number;
  failureCount: number;
  role: string;
};

export type RoutingPolicySummary = {
  defaultProvider: string;
  fallbackChain: string[];
  privacyCriticalChain: string[];
  localOnlyChain: string[];
};

export type SignalSummary = {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  topTypes: string[];
};

export type RagStatus = {
  provider: string;
  model: string;
  available: boolean;
  totalDocuments: number;
  totalChunks: number;
  chunksWithEmbeddings: number;
  retrievalMode: string;
};

export type PatternSummary = {
  pattern: string;
  frequency: number;
  lastSeen: string;
  affectedModules: string[];
};

export type ModuleMaturityScore = {
  module: string;
  score: number;
  status: ModuleStatus;
  gaps: string[];
};

export type Risk = {
  severity: "critical" | "high" | "medium" | "low";
  area: string;
  message: string;
  recommendation?: string;
};

export type SemseConsciousnessIndex = {
  generatedAt: string;
  version: "1";

  identity: {
    name: "SEMSE OS";
    purpose: string;
    coreLoop: string[];
    operatingPrinciples: string[];
    autonomyLevel: 0 | 1 | 2 | 3 | 4 | 5;
    autonomyDescription: string;
  };

  body: {
    modules: ModuleHealth[];
    services: ServiceHealth[];
    knownSSEChannels: string[];
    knownSSEEvents: string[];
  };

  memory: {
    ragStatus: RagStatus;
    auditLogActive: boolean;
    operationalSignalsActive: boolean;
    reportsDirectory: string;
    memoryLayers: string[];
  };

  brains: {
    providers: LlmProviderStatus[];
    routingPolicy: RoutingPolicySummary;
    privacyRules: string[];
    totalLLMCalls: number;
    totalFallbacks: number;
  };

  maturity: {
    globalScore: number;
    byModule: ModuleMaturityScore[];
    strongestAreas: string[];
    weakestAreas: string[];
  };

  risks: {
    critical: Risk[];
    high: Risk[];
    medium: Risk[];
    low: Risk[];
  };

  operationalState: {
    openSignals: number;
    criticalSignals: number;
    monetizableFlowReady: boolean;
    monetizableFlowStatus: string;
  };

  recommendations: {
    nextBestActions: string[];
    doNotDoYet: string[];
    strategicWarnings: string[];
  };

  /** Live observation powered by SystemObserverService. */
  observation: {
    observedAt:   string;
    healthScore:  number;
    infraHealthy: boolean;
    alertCount:   number;
    alertSummary: string[];
    patterns:     string[];
    ollamaAvailable: boolean;
    ragMode:      string;
    fromObserver: true;
  };
};
