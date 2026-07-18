import type { OperatorContext } from "@semse/shared";
import type { VerificationReport } from "./verification.js";

export const runtimeAgentRoles = [
  "pricing",
  "job-planner",
  "trust-match",
  "evidence-coach",
  "risk",
  "dispute",
  "orchestrator",
  "ecv",
  "field-ops",
  "project-copilot",
  "technical-agent",
  "legal-agent",
  "financial-agent",
  "qa-agent",
  "browser-agent",
  "forge",
] as const;

export type RuntimeAgentRole = (typeof runtimeAgentRoles)[number];

export const agentRiskLevels = ["low", "medium", "high", "critical"] as const;
export type AgentRiskLevel = (typeof agentRiskLevels)[number];

export const agentPolicyDecisions = ["allow", "deny", "require_approval"] as const;
export type AgentPolicyDecision = (typeof agentPolicyDecisions)[number];

export const approvalStatuses = ["pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof approvalStatuses)[number];

export type RuntimeEnvironment = "api" | "worker" | "web" | "test";

export type AgentToolCategory =
  | "context"
  | "memory"
  | "decision"
  | "audit"
  | "event"
  | "approval"
  | "runtime"
  | "verification";

export type AgentToolName =
  | "context.read.job"
  | "context.read.market"
  | "context.read.evidence"
  | "context.read.dispute"
  | "context.read.trust"
  | "memory.read.agent"
  | "decision.recommend"
  | "decision.plan"
  | "decision.classify_risk"
  | "audit.record.agent"
  | "event.emit.domain"
  | "approval.request.human"
  | "runtime.complete_run"
  | "verify.typecheck"
  | "verify.lint"
  | "verify.unit_tests"
  | "verify.build"
  | "verify.schema"
  | "verify.custom";

export type AgentContextSource =
  | "event"
  | "job"
  | "market"
  | "evidence"
  | "dispute"
  | "trust"
  | "agent_memory";

export type AgentTargetKind = "agent" | "job" | "milestone" | "payment" | "dispute" | "policy" | "runtime" | "memory";

export type RuntimeAgentInput = Record<string, unknown> & {
  eventType?: string;
  eventPayload?: Record<string, unknown>;
  operatorContext?: OperatorContext;
};

export type AgentToolDefinition = {
  name: AgentToolName;
  category: AgentToolCategory;
  description: string;
  actionType: string;
  targetKind: AgentTargetKind;
  inherentRisk: AgentRiskLevel;
};

export type AgentApprovalRule = {
  id: string;
  whenActionIn?: string[];
  whenToolIn?: AgentToolName[];
  whenRiskAtLeast?: AgentRiskLevel;
  reason: string;
  approvalMode: "ops_admin" | "dual_control";
};

export type AgentCapabilityManifest = {
  allowedTools: AgentToolName[];
  allowedActions: string[];
  allowedContextSources: AgentContextSource[];
  allowedInputKeys: string[];
  maxRiskLevel: AgentRiskLevel;
  networkScopes: string[];
  fileScopes: string[];
  approvalRules: AgentApprovalRule[];
};

export type RuntimeAgentManifest = {
  id: string;
  role: RuntimeAgentRole;
  name: string;
  version: string;
  status: "active" | "preview" | "disabled";
  description: string;
  capabilities: AgentCapabilityManifest;
  metadata: {
    owner: string;
    tags: string[];
    defaultModel: string;
  };
};

export type AgentRiskAssessment = {
  riskLevel: AgentRiskLevel;
  riskScore: number;
  reasons: string[];
  tags: string[];
};

export type AgentPolicyInput = {
  agentType: RuntimeAgentRole;
  actionType: string;
  toolName?: AgentToolName;
  target?: string;
  targetKind?: AgentTargetKind;
  requestedContextSources?: AgentContextSource[];
  environment?: RuntimeEnvironment;
  triggerType?: "manual" | "event" | "schedule";
};

export type AgentPolicyResult = {
  decision: AgentPolicyDecision;
  reason: string;
  riskScore: number;
  riskLevel: AgentRiskLevel;
  violatedPolicies: string[];
  requiredApprovals: string[];
  auditTags: string[];
};

export type AgentToolPolicyResult = AgentPolicyResult & {
  toolName: AgentToolName;
};

export type AgentApprovalRequest = {
  id: string;
  runId: string;
  correlationId: string;
  agentType: RuntimeAgentRole;
  title: string;
  reason: string;
  status: ApprovalStatus;
  riskLevel: AgentRiskLevel;
  riskScore: number;
  requestedAt: string;
  policyDecision: AgentPolicyDecision;
  requiredApprovals: string[];
  contextSummary?: string;
};

export type AgentAuditEvent = {
  type: string;
  status: "ok" | "warn" | "error";
  timestamp: string;
  detail: Record<string, unknown>;
};

export type RuntimeAgentResult = {
  actionType: string;
  summary: string;
  confidence: number;
  requiresHumanReview: boolean;
  payload: Record<string, unknown>;
};

export type GovernedAgentExecutionResult = RuntimeAgentResult & {
  policy: AgentPolicyResult;
  toolDecisions: AgentToolPolicyResult[];
  risk: AgentRiskAssessment;
  approvalRequests: AgentApprovalRequest[];
  auditTrail: AgentAuditEvent[];
  manifest: RuntimeAgentManifest;
  contextEnvelope: {
    allowedSources: AgentContextSource[];
    data: Record<string, unknown>;
  };
  /** SPEC-AGT-001: reporte del verification loop (solo runs de escritura). */
  verification?: VerificationReport;
};

export const agentToolRegistry: Record<AgentToolName, AgentToolDefinition> = {
  "context.read.job": {
    name: "context.read.job",
    category: "context",
    description: "Read scoped job context for pricing and planning.",
    actionType: "context.read",
    targetKind: "job",
    inherentRisk: "low"
  },
  "context.read.market": {
    name: "context.read.market",
    category: "context",
    description: "Read market context and pricing anchors.",
    actionType: "context.read",
    targetKind: "job",
    inherentRisk: "low"
  },
  "context.read.evidence": {
    name: "context.read.evidence",
    category: "context",
    description: "Read milestone evidence package for review.",
    actionType: "context.read",
    targetKind: "milestone",
    inherentRisk: "medium"
  },
  "context.read.dispute": {
    name: "context.read.dispute",
    category: "context",
    description: "Read dispute context and evidence summary.",
    actionType: "context.read",
    targetKind: "dispute",
    inherentRisk: "high"
  },
  "context.read.trust": {
    name: "context.read.trust",
    category: "context",
    description: "Read trust and reputation signals.",
    actionType: "context.read",
    targetKind: "job",
    inherentRisk: "medium"
  },
  "memory.read.agent": {
    name: "memory.read.agent",
    category: "memory",
    description: "Read scoped durable agent memory.",
    actionType: "memory.read",
    targetKind: "memory",
    inherentRisk: "medium"
  },
  "decision.recommend": {
    name: "decision.recommend",
    category: "decision",
    description: "Produce a governed recommendation for downstream review.",
    actionType: "decision.recommend",
    targetKind: "runtime",
    inherentRisk: "medium"
  },
  "decision.plan": {
    name: "decision.plan",
    category: "decision",
    description: "Produce a plan or milestone structure.",
    actionType: "decision.plan",
    targetKind: "job",
    inherentRisk: "medium"
  },
  "decision.classify_risk": {
    name: "decision.classify_risk",
    category: "decision",
    description: "Classify risk and escalate when needed.",
    actionType: "decision.classify_risk",
    targetKind: "policy",
    inherentRisk: "high"
  },
  "audit.record.agent": {
    name: "audit.record.agent",
    category: "audit",
    description: "Record a structured audit artifact for the agent run.",
    actionType: "audit.record",
    targetKind: "runtime",
    inherentRisk: "low"
  },
  "event.emit.domain": {
    name: "event.emit.domain",
    category: "event",
    description: "Emit a controlled domain event back into the platform.",
    actionType: "event.emit",
    targetKind: "runtime",
    inherentRisk: "high"
  },
  "approval.request.human": {
    name: "approval.request.human",
    category: "approval",
    description: "Open a human approval request for sensitive actions.",
    actionType: "approval.request",
    targetKind: "policy",
    inherentRisk: "high"
  },
  "runtime.complete_run": {
    name: "runtime.complete_run",
    category: "runtime",
    description: "Persist a completed run result into SEMSE runtime.",
    actionType: "runtime.complete",
    targetKind: "runtime",
    inherentRisk: "medium"
  },
  // SPEC-AGT-001 §2.2 — verificadores del verification loop. Riesgo low,
  // sin approval: son los mismos comandos de CI ejecutados vía spawnSync.
  "verify.typecheck": {
    name: "verify.typecheck",
    category: "verification",
    description: "Run tsc --noEmit over the affected workspace.",
    actionType: "verify.run",
    targetKind: "runtime",
    inherentRisk: "low"
  },
  "verify.lint": {
    name: "verify.lint",
    category: "verification",
    description: "Run the workspace lint command.",
    actionType: "verify.run",
    targetKind: "runtime",
    inherentRisk: "low"
  },
  "verify.unit_tests": {
    name: "verify.unit_tests",
    category: "verification",
    description: "Run the workspace unit test suite.",
    actionType: "verify.run",
    targetKind: "runtime",
    inherentRisk: "low"
  },
  "verify.build": {
    name: "verify.build",
    category: "verification",
    description: "Run the workspace build command.",
    actionType: "verify.run",
    targetKind: "runtime",
    inherentRisk: "low"
  },
  "verify.schema": {
    name: "verify.schema",
    category: "verification",
    description: "Validate output contracts against packages/schemas.",
    actionType: "verify.run",
    targetKind: "runtime",
    inherentRisk: "low"
  },
  "verify.custom": {
    name: "verify.custom",
    category: "verification",
    description: "Injectable verification hook (same pattern as setDelegateImpl).",
    actionType: "verify.run",
    targetKind: "runtime",
    inherentRisk: "low"
  }
};

const mediumApprovalRule: AgentApprovalRule = {
  id: "rule.human.review.high_risk",
  whenRiskAtLeast: "high",
  reason: "High-risk outputs require human review before downstream action.",
  approvalMode: "ops_admin"
};

export const runtimeAgentManifests: Record<RuntimeAgentRole, RuntimeAgentManifest> = {
  pricing: {
    id: "agt_pricing_v1",
    role: "pricing",
    name: "PricingAgent",
    version: "1.0.0",
    status: "active",
    description: "Produces governed pricing baselines from scoped job context.",
    capabilities: {
      allowedTools: ["context.read.job", "context.read.market", "decision.recommend", "audit.record.agent", "runtime.complete_run"],
      allowedActions: ["runtime.execute", "context.read", "decision.recommend", "audit.record", "runtime.complete"],
      allowedContextSources: ["event", "job", "market"],
      allowedInputKeys: ["eventType", "eventPayload", "title", "scope", "budgetMin", "budgetMax", "budgetCents", "complexity", "location"],
      maxRiskLevel: "high",
      networkScopes: [],
      fileScopes: [],
      approvalRules: []
    },
    metadata: {
      owner: "semse-runtime",
      tags: ["pricing", "market", "baseline"],
      defaultModel: "gpt-4o-mini"
    }
  },
  "job-planner": {
    id: "agt_job_planner_v1",
    role: "job-planner",
    name: "JobPlannerAgent",
    version: "1.0.0",
    status: "active",
    description: "Builds milestone plans from scoped job context.",
    capabilities: {
      allowedTools: ["context.read.job", "decision.plan", "audit.record.agent", "runtime.complete_run"],
      allowedActions: ["runtime.execute", "context.read", "decision.plan", "audit.record", "runtime.complete"],
      allowedContextSources: ["event", "job"],
      allowedInputKeys: ["eventType", "eventPayload", "title", "scope", "budgetMin", "budgetMax", "budgetCents", "deadline"],
      maxRiskLevel: "high",
      networkScopes: [],
      fileScopes: [],
      approvalRules: []
    },
    metadata: {
      owner: "semse-runtime",
      tags: ["planning", "milestones", "jobs"],
      defaultModel: "gpt-4o-mini"
    }
  },
  "trust-match": {
    id: "agt_trust_match_v1",
    role: "trust-match",
    name: "TrustMatchAgent",
    version: "1.0.0",
    status: "preview",
    description: "Scores candidate matches from trust signals and job context.",
    capabilities: {
      allowedTools: ["context.read.job", "context.read.trust", "decision.recommend", "audit.record.agent", "runtime.complete_run"],
      allowedActions: ["runtime.execute", "context.read", "decision.recommend", "audit.record", "runtime.complete"],
      allowedContextSources: ["event", "job", "trust"],
      allowedInputKeys: ["eventType", "eventPayload", "jobId", "category", "budgetCents", "location"],
      maxRiskLevel: "high",
      networkScopes: [],
      fileScopes: [],
      approvalRules: [mediumApprovalRule]
    },
    metadata: {
      owner: "semse-trust",
      tags: ["matching", "trust", "marketplace"],
      defaultModel: "gpt-4o-mini"
    }
  },
  "evidence-coach": {
    id: "agt_evidence_coach_v1",
    role: "evidence-coach",
    name: "EvidenceAgent",
    version: "1.0.0",
    status: "active",
    description: "Reviews evidence completeness and suggests missing artifacts.",
    capabilities: {
      allowedTools: ["context.read.evidence", "decision.recommend", "audit.record.agent", "runtime.complete_run"],
      allowedActions: ["runtime.execute", "context.read", "decision.recommend", "audit.record", "runtime.complete"],
      allowedContextSources: ["event", "evidence"],
      allowedInputKeys: ["eventType", "eventPayload", "milestoneId", "evidenceCount", "checklistComplete", "uploadedFiles"],
      maxRiskLevel: "high",
      networkScopes: [],
      fileScopes: [],
      approvalRules: []
    },
    metadata: {
      owner: "semse-evidence",
      tags: ["evidence", "milestones", "quality"],
      defaultModel: "gpt-4o-mini"
    }
  },
  risk: {
    id: "agt_risk_v1",
    role: "risk",
    name: "RiskAgent",
    version: "1.0.0",
    status: "active",
    description: "Scores operational risk and suggests escalation.",
    capabilities: {
      allowedTools: ["context.read.job", "context.read.trust", "decision.classify_risk", "audit.record.agent", "approval.request.human", "runtime.complete_run"],
      allowedActions: ["runtime.execute", "context.read", "decision.classify_risk", "approval.request", "audit.record", "runtime.complete"],
      allowedContextSources: ["event", "job", "trust"],
      allowedInputKeys: ["eventType", "eventPayload", "scope", "budgetMin", "budgetMax", "budgetCents", "actorId", "context"],
      maxRiskLevel: "high",
      networkScopes: [],
      fileScopes: [],
      approvalRules: [mediumApprovalRule]
    },
    metadata: {
      owner: "semse-trust",
      tags: ["risk", "policy", "ops"],
      defaultModel: "gpt-4o-mini"
    }
  },
  dispute: {
    id: "agt_dispute_v1",
    role: "dispute",
    name: "ComplianceAgent",
    version: "1.0.0",
    status: "active",
    description: "Generates dispute triage recommendations under human review.",
    capabilities: {
      allowedTools: ["context.read.dispute", "decision.recommend", "approval.request.human", "audit.record.agent", "runtime.complete_run"],
      allowedActions: ["runtime.execute", "context.read", "decision.recommend", "approval.request", "audit.record", "runtime.complete"],
      allowedContextSources: ["event", "dispute", "evidence"],
      allowedInputKeys: ["eventType", "eventPayload", "reason", "severity", "milestoneValueCents", "timeline", "evidence"],
      maxRiskLevel: "high",
      networkScopes: [],
      fileScopes: [],
      approvalRules: [mediumApprovalRule]
    },
    metadata: {
      owner: "semse-trust",
      tags: ["dispute", "review", "human-loop"],
      defaultModel: "gpt-4o-mini"
    }
  },
  orchestrator: {
    id: "agt_orchestrator_v1",
    role: "orchestrator",
    name: "OrchestratorAgent",
    version: "1.0.0",
    status: "preview",
    description: "Coordinates multiple agents and emits governed follow-up actions.",
    capabilities: {
      allowedTools: ["context.read.job", "context.read.evidence", "context.read.dispute", "context.read.trust", "memory.read.agent", "decision.plan", "decision.recommend", "decision.classify_risk", "event.emit.domain", "approval.request.human", "audit.record.agent", "runtime.complete_run"],
      allowedActions: ["runtime.execute", "context.read", "memory.read", "decision.plan", "decision.recommend", "decision.classify_risk", "event.emit", "approval.request", "audit.record", "runtime.complete"],
      allowedContextSources: ["event", "job", "evidence", "dispute", "trust", "agent_memory"],
      allowedInputKeys: ["eventType", "eventPayload", "task", "context", "jobId", "milestoneId", "disputeId"],
      maxRiskLevel: "critical",
      networkScopes: [],
      fileScopes: [],
      approvalRules: [
        {
          id: "rule.orchestrator.emit",
          whenToolIn: ["event.emit.domain"],
          reason: "The orchestrator may not emit downstream events without explicit approval.",
          approvalMode: "ops_admin"
        }
      ]
    },
    metadata: {
      owner: "semse-runtime",
      tags: ["orchestration", "multi-agent", "preview"],
      defaultModel: "gpt-4o-mini"
    }
  },
  ecv: {
    id: "agt_ecv_v1",
    role: "ecv",
    name: "ComplianceAgent",
    version: "1.0.0",
    status: "preview",
    description: "Validates agent decisions against policy, ethics and governance constraints.",
    capabilities: {
      allowedTools: ["memory.read.agent", "decision.classify_risk", "approval.request.human", "audit.record.agent", "runtime.complete_run"],
      allowedActions: ["runtime.execute", "memory.read", "decision.classify_risk", "approval.request", "audit.record", "runtime.complete"],
      allowedContextSources: ["event", "agent_memory"],
      allowedInputKeys: ["eventType", "eventPayload", "agentRole", "response", "context"],
      maxRiskLevel: "critical",
      networkScopes: [],
      fileScopes: [],
      approvalRules: [mediumApprovalRule]
    },
    metadata: {
      owner: "semse-governance",
      tags: ["policy", "compliance", "ethics"],
      defaultModel: "gpt-4o-mini"
    }
  },

  "field-ops": {
    id: "field-ops", role: "field-ops",
    name: "FieldOpsAgent",
    version: "1.0.0",
    status: "active",
    description: "Inspects project milestones and evidence documentation for field operations quality.",
    capabilities: {
      allowedTools: ["memory.read.agent", "audit.record.agent", "runtime.complete_run"],
      allowedActions: ["runtime.execute", "memory.read", "audit.record", "runtime.complete"],
      allowedContextSources: ["job", "evidence"],
      allowedInputKeys: ["projectId", "jobId", "context"],
      maxRiskLevel: "medium",
      networkScopes: [],
      fileScopes: [],
      approvalRules: []
    },
    metadata: { owner: "semse-field", tags: ["field-ops", "evidence", "milestone"], defaultModel: "claude-sonnet-4-6" }
  },

  "project-copilot": {
    id: "project-copilot", role: "project-copilot",
    name: "ProjectCopilotAgent",
    version: "2.0.0",
    status: "active",
    description: "AI copilot for project management — plans, evidence, disputes, escrow and coordination.",
    capabilities: {
      allowedTools: ["memory.read.agent", "memory.read.agent", "audit.record.agent", "runtime.complete_run"],
      allowedActions: ["runtime.execute", "memory.read", "memory.write", "audit.record", "runtime.complete"],
      allowedContextSources: ["job", "evidence", "dispute"],
      allowedInputKeys: ["projectId", "jobId", "message", "threadId", "context"],
      maxRiskLevel: "critical",
      networkScopes: [],
      fileScopes: [],
      approvalRules: [mediumApprovalRule]
    },
    metadata: { owner: "semse-agents", tags: ["copilot", "coordinator", "plan"], defaultModel: "claude-sonnet-4-6" }
  },

  "technical-agent": {
    id: "technical-agent", role: "technical-agent",
    name: "TechnicalAgent",
    version: "1.0.0",
    status: "active",
    description: "Prometeo specialized agent — validates technical documentation, scope and manual compliance.",
    capabilities: {
      allowedTools: ["memory.read.agent", "audit.record.agent", "runtime.complete_run"],
      allowedActions: ["runtime.execute", "memory.read", "audit.record", "runtime.complete"],
      allowedContextSources: ["job", "evidence"],
      allowedInputKeys: ["projectId", "jobId", "context"],
      maxRiskLevel: "medium",
      networkScopes: [],
      fileScopes: [],
      approvalRules: []
    },
    metadata: { owner: "semse-prometeo", tags: ["technical", "scope", "documentation"], defaultModel: "claude-sonnet-4-6" }
  },

  "legal-agent": {
    id: "legal-agent", role: "legal-agent",
    name: "LegalAgent",
    version: "1.0.0",
    status: "active",
    description: "Prometeo specialized agent — validates contracts, detects legal risks and dispute exposure.",
    capabilities: {
      allowedTools: ["memory.read.agent", "audit.record.agent", "runtime.complete_run"],
      allowedActions: ["runtime.execute", "memory.read", "audit.record", "runtime.complete"],
      allowedContextSources: ["job", "dispute"],
      allowedInputKeys: ["projectId", "jobId", "context"],
      maxRiskLevel: "high",
      networkScopes: [],
      fileScopes: [],
      approvalRules: [mediumApprovalRule]
    },
    metadata: { owner: "semse-prometeo", tags: ["legal", "contract", "dispute"], defaultModel: "claude-sonnet-4-6" }
  },

  "financial-agent": {
    id: "financial-agent", role: "financial-agent",
    name: "FinancialAgent",
    version: "1.0.0",
    status: "active",
    description: "Prometeo specialized agent — monitors escrow, milestone payments and financial health.",
    capabilities: {
      allowedTools: ["memory.read.agent", "audit.record.agent", "runtime.complete_run"],
      allowedActions: ["runtime.execute", "memory.read", "audit.record", "runtime.complete"],
      allowedContextSources: ["job"],
      allowedInputKeys: ["projectId", "jobId", "context"],
      maxRiskLevel: "high",
      networkScopes: [],
      fileScopes: [],
      approvalRules: [mediumApprovalRule]
    },
    metadata: { owner: "semse-prometeo", tags: ["financial", "escrow", "payment"], defaultModel: "claude-sonnet-4-6" }
  },

  "qa-agent": {
    id: "qa-agent", role: "qa-agent",
    name: "QaAgent",
    version: "1.0.0",
    status: "active",
    description: "Prometeo specialized agent — scores evidence quality and validates milestone readiness.",
    capabilities: {
      allowedTools: ["memory.read.agent", "audit.record.agent", "runtime.complete_run"],
      allowedActions: ["runtime.execute", "memory.read", "audit.record", "runtime.complete"],
      allowedContextSources: ["job", "evidence"],
      allowedInputKeys: ["projectId", "jobId", "context"],
      maxRiskLevel: "medium",
      networkScopes: [],
      fileScopes: [],
      approvalRules: []
    },
    metadata: { owner: "semse-prometeo", tags: ["qa", "evidence", "quality"], defaultModel: "claude-sonnet-4-6" }
  },

  "browser-agent": {
    id: "browser-agent", role: "browser-agent",
    name: "BrowserAgent",
    version: "1.0.0",
    status: "active",
    description: "Inspects web landing pages and applications via Chromium, capturing console logs, screenshots, and extracting text.",
    capabilities: {
      allowedTools: ["memory.read.agent", "audit.record.agent", "runtime.complete_run"],
      allowedActions: ["runtime.execute", "memory.read", "audit.record", "runtime.complete"],
      allowedContextSources: ["event"],
      allowedInputKeys: ["url", "includeScreenshot", "includeText", "includeAiSummary", "projectId", "milestoneId", "context"],
      maxRiskLevel: "medium",
      networkScopes: ["*"],
      fileScopes: [],
      approvalRules: []
    },
    metadata: { owner: "semse-prometeo", tags: ["browser", "qa", "observability"], defaultModel: "claude-sonnet-4-6" }
  },
  forge: {
    id: "agt_forge_v1",
    role: "forge",
    name: "SEMSE Forge Agent",
    version: "1.0.0",
    status: "preview",
    description: "Executes SEMSE Forge task packets under engineering policy and returns governed recommendations.",
    capabilities: {
      allowedTools: ["context.read.job", "decision.plan", "decision.recommend", "audit.record.agent", "runtime.complete_run"],
      allowedActions: ["runtime.execute", "context.read", "decision.plan", "decision.recommend", "audit.record", "runtime.complete"],
      allowedContextSources: ["event"],
      allowedInputKeys: ["forgeRunId", "taskId", "task", "action", "proposedFiles", "operatorContext", "environment"],
      maxRiskLevel: "critical",
      networkScopes: ["github.com/Semse-projet/project-manager-app"],
      fileScopes: ["docs/specs/**", ".semse-sdd/**", "packages/**", "apps/**", "tests/**", "scripts/**"],
      approvalRules: []
    },
    metadata: { owner: "semse-core", tags: ["forge", "sdd", "engineering"], defaultModel: "claude-sonnet-4-6" }
  }
};

export function getRuntimeAgentManifest(agentType: RuntimeAgentRole): RuntimeAgentManifest {
  return runtimeAgentManifests[agentType];
}

function riskWeight(level: AgentRiskLevel): number {
  switch (level) {
    case "low":
      return 1;
    case "medium":
      return 2;
    case "high":
      return 3;
    case "critical":
      return 4;
  }
}

function maxRiskScore(level: AgentRiskLevel): number {
  switch (level) {
    case "low":
      return 0.34;
    case "medium":
      return 0.59;
    case "high":
      return 0.84;
    case "critical":
      return 1;
  }
}

export function resolveAllowedContextEnvelope(agentType: RuntimeAgentRole, input: RuntimeAgentInput): {
  allowedSources: AgentContextSource[];
  data: Record<string, unknown>;
} {
  const manifest = getRuntimeAgentManifest(agentType);
  const envelope: Record<string, unknown> = {};

  for (const key of manifest.capabilities.allowedInputKeys) {
    if (key in input) {
      envelope[key] = input[key];
    }
  }

  return {
    allowedSources: manifest.capabilities.allowedContextSources,
    data: envelope
  };
}

export function derivePlannedTools(agentType: RuntimeAgentRole): AgentToolName[] {
  switch (agentType) {
    case "pricing":
      return ["context.read.job", "context.read.market", "decision.recommend", "audit.record.agent", "runtime.complete_run"];
    case "job-planner":
      return ["context.read.job", "decision.plan", "audit.record.agent", "runtime.complete_run"];
    case "trust-match":
      return ["context.read.job", "context.read.trust", "decision.recommend", "audit.record.agent", "runtime.complete_run"];
    case "evidence-coach":
      return ["context.read.evidence", "decision.recommend", "audit.record.agent", "runtime.complete_run"];
    case "risk":
      return ["context.read.job", "context.read.trust", "decision.classify_risk", "audit.record.agent", "runtime.complete_run"];
    case "dispute":
      return ["context.read.dispute", "decision.recommend", "approval.request.human", "audit.record.agent", "runtime.complete_run"];
    case "orchestrator":
      return ["context.read.job", "context.read.evidence", "context.read.dispute", "decision.plan", "decision.classify_risk", "audit.record.agent", "runtime.complete_run"];
    case "ecv":
      return ["memory.read.agent", "decision.classify_risk", "approval.request.human", "audit.record.agent", "runtime.complete_run"];
    case "field-ops":
    case "technical-agent":
    case "qa-agent":
      return ["context.read.evidence", "decision.recommend", "audit.record.agent", "runtime.complete_run"];
    case "project-copilot":
    case "legal-agent":
    case "financial-agent":
      return ["context.read.job", "decision.recommend", "audit.record.agent", "runtime.complete_run"];
    case "forge":
      return ["decision.plan", "decision.recommend", "audit.record.agent", "runtime.complete_run"];
    default:
      return ["audit.record.agent", "runtime.complete_run"];
  }
}

export function classifyAgentRisk(input: {
  actionType: string;
  toolName?: AgentToolName;
  target?: string;
  targetKind?: AgentTargetKind;
  environment?: RuntimeEnvironment;
}): AgentRiskAssessment {
  let score = 0.18;
  const reasons: string[] = [];
  const tags: string[] = [];

  if (input.toolName) {
    const tool = agentToolRegistry[input.toolName];
    score += maxRiskScore(tool.inherentRisk) * 0.45;
    tags.push(`tool:${tool.name}`);
    reasons.push(`tool ${tool.name} carries ${tool.inherentRisk} inherent risk`);
  }

  if (/approval|emit|policy|classify_risk/.test(input.actionType)) {
    score += 0.22;
    tags.push(`action:${input.actionType}`);
    reasons.push(`action ${input.actionType} affects governed control flow`);
  } else if (/plan|recommend|complete/.test(input.actionType)) {
    score += 0.1;
    tags.push(`action:${input.actionType}`);
  } else {
    score += 0.04;
  }

  const target = (input.target ?? "").toLowerCase();
  if (target.includes("auth") || target.includes("payment") || target.includes("escrow") || target.includes("policy") || target.includes("runtime")) {
    score += 0.28;
    tags.push("target:sensitive");
    reasons.push("target touches a sensitive subsystem");
  } else if (target.includes("dispute") || target.includes("risk")) {
    score += 0.18;
    tags.push("target:review");
  }

  if (input.targetKind === "policy" || input.targetKind === "runtime") {
    score += 0.14;
  }

  if (input.environment === "web") {
    score += 0.04;
  }

  const riskScore = Math.min(1, Number(score.toFixed(3)));
  const riskLevel =
    riskScore >= 0.85 ? "critical"
      : riskScore >= 0.6 ? "high"
        : riskScore >= 0.35 ? "medium"
          : "low";

  return {
    riskLevel,
    riskScore,
    reasons,
    tags
  };
}

function shouldRequireApproval(rule: AgentApprovalRule, input: AgentPolicyInput, risk: AgentRiskAssessment): boolean {
  if (rule.whenActionIn && !rule.whenActionIn.includes(input.actionType)) {
    return false;
  }
  if (rule.whenToolIn && (!input.toolName || !rule.whenToolIn.includes(input.toolName))) {
    return false;
  }
  if (rule.whenRiskAtLeast && riskWeight(risk.riskLevel) < riskWeight(rule.whenRiskAtLeast)) {
    return false;
  }
  return true;
}

export function evaluateAgentPolicy(input: AgentPolicyInput): AgentPolicyResult {
  const manifest = getRuntimeAgentManifest(input.agentType);
  const risk = classifyAgentRisk(input);
  const violatedPolicies: string[] = [];
  const requiredApprovals: string[] = [];
  const auditTags = [`agent:${input.agentType}`, `risk:${risk.riskLevel}`];

  if (manifest.status === "disabled") {
    return {
      decision: "deny",
      reason: "Agent is disabled",
      riskScore: risk.riskScore,
      riskLevel: risk.riskLevel,
      violatedPolicies: ["agent.status.disabled"],
      requiredApprovals: [],
      auditTags
    };
  }

  if (!manifest.capabilities.allowedActions.includes(input.actionType)) {
    violatedPolicies.push("capability.action_not_allowed");
  }

  if (input.toolName && !manifest.capabilities.allowedTools.includes(input.toolName)) {
    violatedPolicies.push("capability.tool_not_allowed");
  }

  // DEFINIR TOOLS NO DELEGABLES (Point 1 of 5)
  if (input.triggerType === "event" && input.toolName) {
    const nonDelegableTools = ["delegate_task", "request_agent_help", "approval.request.human", "event.emit.domain"];
    if (nonDelegableTools.includes(input.toolName)) {
      violatedPolicies.push("delegation.tool_not_allowed");
      auditTags.push(`delegation_denied:${input.toolName}`);
    }
  }

  const contextSources = input.requestedContextSources ?? [];
  const disallowedSources = contextSources.filter((source) => !manifest.capabilities.allowedContextSources.includes(source));
  if (disallowedSources.length > 0) {
    violatedPolicies.push("context.source_not_allowed");
    auditTags.push(`context_denied:${disallowedSources.join(",")}`);
  }

  if (riskWeight(risk.riskLevel) > riskWeight(manifest.capabilities.maxRiskLevel)) {
    requiredApprovals.push("risk.above_agent_threshold");
  }

  for (const rule of manifest.capabilities.approvalRules) {
    if (shouldRequireApproval(rule, input, risk)) {
      requiredApprovals.push(rule.id);
    }
  }

  if (violatedPolicies.length > 0) {
    return {
      decision: "deny",
      reason: "Requested action violates the agent capability manifest",
      riskScore: risk.riskScore,
      riskLevel: risk.riskLevel,
      violatedPolicies,
      requiredApprovals: [],
      auditTags
    };
  }

  if (requiredApprovals.length > 0) {
    return {
      decision: "require_approval",
      reason: "Action exceeds the agent autonomy envelope",
      riskScore: risk.riskScore,
      riskLevel: risk.riskLevel,
      violatedPolicies: [],
      requiredApprovals,
      auditTags
    };
  }

  return {
    decision: "allow",
    reason: "Action is within the declared capability envelope",
    riskScore: risk.riskScore,
    riskLevel: risk.riskLevel,
    violatedPolicies: [],
    requiredApprovals: [],
    auditTags
  };
}

export function createApprovalRequests(input: {
  runId: string;
  correlationId: string;
  agentType: RuntimeAgentRole;
  policy: AgentPolicyResult;
  summary: string;
  risk: AgentRiskAssessment;
  contextSummary?: string;
  requiresHumanReview?: boolean;
}): AgentApprovalRequest[] {
  const shouldOpen =
    input.policy.decision === "require_approval" ||
    input.risk.riskLevel === "high" ||
    input.risk.riskLevel === "critical" ||
    input.requiresHumanReview === true;

  if (!shouldOpen) {
    return [];
  }

  return [
    {
      id: `apr_${Math.random().toString(36).slice(2, 10)}`,
      runId: input.runId,
      correlationId: input.correlationId,
      agentType: input.agentType,
      title: `${input.agentType} requires review`,
      reason: input.policy.reason,
      status: "pending",
      riskLevel: input.risk.riskLevel,
      riskScore: input.risk.riskScore,
      requestedAt: new Date().toISOString(),
      policyDecision: input.policy.decision,
      requiredApprovals: input.policy.requiredApprovals,
      contextSummary: input.contextSummary ?? input.summary
    }
  ];
}
