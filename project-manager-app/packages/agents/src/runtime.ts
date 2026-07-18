import {
  type AgentAuditEvent,
  type AgentContextSource,
  type AgentRiskAssessment,
  type AgentRiskLevel,
  type AgentToolName,
  type GovernedAgentExecutionResult,
  type RuntimeAgentInput,
  type RuntimeAgentResult,
  type RuntimeAgentRole,
  classifyAgentRisk,
  createApprovalRequests,
  derivePlannedTools,
  evaluateAgentPolicy,
  getRuntimeAgentManifest,
  resolveAllowedContextEnvelope
} from "./governance.js";
import {
  createPatchPlanner,
  createPatchWriter,
  createSandboxProvider,
  createToolAdapter,
  evaluateForgePolicy,
  getForgeAgentManifest,
  type ForgePatchPlan,
  type ForgePatchResult,
  type ForgeTaskPacket,
  type ForgeToolPlan,
  type ProposedFileChange,
  type SandboxPlan
} from "@semse/forge";
import {
  DEFAULT_VERIFICATION_TIMEOUT_MS,
  MISSING_VERIFICATION_BUDGET_REASON,
  clampVerificationBudget,
  isWriteActionType,
  type VerificationAttempt,
  type VerificationBudget,
  type VerifierName,
  type VerificationReport
} from "./verification.js";
// Type-only: se borra en compilación — verifiers.ts (spawnSync) nunca entra
// al grafo de imports de index/runtime, así el bundle de cliente de apps/web
// no arrastra node:child_process.
import type { VerifierContext } from "./verifiers.js";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolvePayload(input: RuntimeAgentInput): Record<string, unknown> {
  const eventPayload = asRecord(input.eventPayload);
  return Object.keys(eventPayload).length > 0 ? eventPayload : input;
}

function inferContextSources(agentType: RuntimeAgentRole, input: RuntimeAgentInput): AgentContextSource[] {
  const payload = resolvePayload(input);
  const eventPayload = asRecord(input.eventPayload);
  const sources = new Set<AgentContextSource>();

  if (Object.keys(eventPayload).length > 0 || input.eventType) {
    sources.add("event");
  }
  if (["pricing", "job-planner", "trust-match", "risk", "orchestrator"].includes(agentType) && (payload.jobId || payload.scope || payload.title)) {
    sources.add("job");
  }
  if (agentType === "pricing") {
    sources.add("market");
  }
  if (["evidence-coach", "dispute", "orchestrator"].includes(agentType) && (payload.evidenceCount || payload.uploadedFiles || payload.evidence)) {
    sources.add("evidence");
  }
  if (["dispute", "orchestrator"].includes(agentType) && (payload.disputeId || payload.reason || payload.severity)) {
    sources.add("dispute");
  }
  if (["trust-match", "risk", "orchestrator"].includes(agentType)) {
    sources.add("trust");
  }
  if (["orchestrator", "ecv"].includes(agentType)) {
    sources.add("agent_memory");
  }

  return Array.from(sources);
}

function buildPricing(input: RuntimeAgentInput): RuntimeAgentResult {
  const payload = resolvePayload(input);
  const budgetMin = asNumber(payload.budgetMin) ?? asNumber(payload.budgetCents) ?? 0;
  const budgetMax = asNumber(payload.budgetMax) ?? asNumber(payload.budgetCents) ?? 0;
  const title = asString(payload.title) ?? "job";
  const scope = asString(payload.scope) ?? "";
  const scopeWeight = Math.max(1, Math.ceil(scope.length / 120));
  const estimatedMin = budgetMin > 0 ? Math.round(budgetMin / 100) : 150 * scopeWeight;
  const estimatedMax = budgetMax > 0 ? Math.round(budgetMax / 100) : estimatedMin + 120 * scopeWeight;
  const confidence = budgetMin > 0 || budgetMax > 0 ? 0.88 : 0.64;

  return {
    actionType: "recommend",
    summary: `Pricing baseline for ${title}`,
    confidence,
    requiresHumanReview: confidence < 0.7,
    payload: {
      estimatedMin,
      estimatedMax,
      confidence,
      reasoning: budgetMin > 0 || budgetMax > 0 ? "Used provided budget anchors" : "Derived from scope size heuristic"
    }
  };
}

function buildJobPlan(input: RuntimeAgentInput): RuntimeAgentResult {
  const payload = resolvePayload(input);
  const title = asString(payload.title) ?? "Untitled job";
  const scope = asString(payload.scope) ?? "";
  const steps = [
    { title: "Scope confirmation", description: "Confirm requirements, site constraints and acceptance criteria." },
    { title: "Execution", description: "Perform the core service work and capture progress evidence." },
    { title: "Review and closeout", description: "Validate deliverables, fix punch list items and prepare approval." }
  ];
  const estimatedDays = clamp(Math.ceil(Math.max(scope.length, title.length) / 80), 2, 14);
  const risks: string[] = [];
  if (scope.length < 80) risks.push("Scope is underspecified");
  if (!asNumber(payload.budgetMin) && !asNumber(payload.budgetMax) && !asNumber(payload.budgetCents)) risks.push("Budget anchor is missing");

  return {
    actionType: "plan",
    summary: `Execution plan generated for ${title}`,
    confidence: risks.length === 0 ? 0.84 : 0.66,
    requiresHumanReview: risks.length > 0,
    payload: {
      milestones: steps.map((step, index) => ({
        sequence: index + 1,
        title: step.title,
        description: step.description
      })),
      estimatedDays,
      risks
    }
  };
}

function buildEvidenceCoach(input: RuntimeAgentInput): RuntimeAgentResult {
  const payload = resolvePayload(input);

  // Preferir datos enriquecidos; caer a campos planos si no hay
  const evidenceItems = asRecord(payload.evidenceItems);
  const photoCount = asNumber(evidenceItems?.photoCount) ?? asNumber(payload.photoCount) ?? 0;
  const videoCount = asNumber(evidenceItems?.videoCount) ?? asNumber(payload.videoCount) ?? 0;
  const totalCount = asNumber(evidenceItems?.totalCount) ?? asNumber(payload.evidenceCount) ?? 0;
  const hasBeforeAfterPair = Boolean(payload.hasBeforeAfterPair);
  const checklistItemCount = asNumber(payload.checklistItemCount) ?? 0;
  const checklistComplete = Boolean(payload.checklistComplete) || (checklistItemCount === 0 && totalCount > 0);

  // Scoring basado en tipos reales de evidencia
  let qualityScore = 0.10;
  if (photoCount >= 1) qualityScore += 0.20;
  if (videoCount >= 1) qualityScore += 0.25;
  if (hasBeforeAfterPair) qualityScore += 0.20;
  if (checklistComplete) qualityScore += 0.15;
  if (totalCount >= 3) qualityScore += 0.10;

  qualityScore = clamp(qualityScore, 0, 0.98);

  const missingItems: string[] = [];
  if (photoCount === 0) missingItems.push("Agregar al menos una foto del trabajo");
  if (!hasBeforeAfterPair && totalCount > 0) missingItems.push("Incluir fotos de antes y después");
  if (videoCount === 0 && qualityScore < 0.7) missingItems.push("Video del trabajo completado recomendado");
  if (!checklistComplete && checklistItemCount > 0) missingItems.push("Completar el checklist del milestone");

  return {
    actionType: "validate",
    summary: totalCount > 0 ? `Evidence reviewed: ${totalCount} items (score ${qualityScore.toFixed(2)})` : "Evidence package incomplete",
    confidence: qualityScore,
    requiresHumanReview: qualityScore < 0.70,
    payload: {
      qualityScore,
      approved: qualityScore >= 0.70,
      photoCount,
      videoCount,
      totalCount,
      hasBeforeAfterPair,
      missingItems,
      feedback:
        missingItems.length === 0
          ? "Evidence package meets quality standards for normal review flow."
          : `Complete before approval: ${missingItems.join("; ")}.`
    }
  };
}

function buildRisk(input: RuntimeAgentInput): RuntimeAgentResult {
  const payload = resolvePayload(input);
  const eventType = input.eventType ?? asString(payload.eventType) ?? "unknown";
  let riskScore = 0.24;
  const flags: string[] = [];

  if (eventType === "dispute.opened") {
    riskScore += 0.48;
    flags.push("open_dispute");
  }
  if (eventType === "job.created" || eventType === "unknown") {
    const budgetMin = asNumber(payload.budgetMin) ?? asNumber(payload.budgetCents);
    const budgetMax = asNumber(payload.budgetMax) ?? asNumber(payload.budgetCents);
    if (!budgetMin && !budgetMax) {
      riskScore += 0.18;
      flags.push("missing_budget_anchor");
    }
    if (!asString(payload.scope) || String(payload.scope).length < 80) {
      riskScore += 0.14;
      flags.push("thin_scope_definition");
    }
  }

  const clamped = clamp(riskScore, 0, 0.99);
  const riskLevel = clamped >= 0.75 ? "high" : clamped >= 0.45 ? "medium" : "low";

  return {
    actionType: "classify",
    summary: `Risk classified as ${riskLevel}`,
    confidence: clamp(0.68 + flags.length * 0.08, 0.68, 0.92),
    requiresHumanReview: riskLevel === "high",
    payload: {
      riskScore: clamped,
      riskLevel,
      flags,
      recommendation:
        riskLevel === "high"
          ? "Escalate to ops review before advancing the workflow."
          : riskLevel === "medium"
            ? "Continue with controls and increased monitoring."
            : "Proceed in normal automated flow."
    }
  };
}

function buildDispute(input: RuntimeAgentInput): RuntimeAgentResult {
  const payload = resolvePayload(input);
  const reason = asString(payload.reason) ?? "No reason provided";
  const reasonCode = asString(payload.reasonCode);
  const evidenceCount = asNumber(payload.evidenceCount) ?? 0;
  const milestoneStatus = asString(payload.milestoneStatus);
  const contractExists = Boolean(payload.contractExists);

  // Scoring real basado en señales objetivas
  let score = 0.40;
  if (evidenceCount > 0) score += 0.20;
  if (milestoneStatus === "APPROVED" || milestoneStatus === "SUBMITTED") score += 0.15;
  if (contractExists) score += 0.15;

  const confidence = clamp(score, 0.40, 0.90);

  // Determinar partido favorecido con razón + reasonCode
  const clientSignals = ["incomplete_work", "quality_issue", "no_show"];
  const proSignals = ["payment_dispute"];
  const favorsClient =
    (reasonCode && clientSignals.includes(reasonCode)) ||
    (!reasonCode && /quality|incomplete|no_show|missed/i.test(reason));
  const favorsPro = reasonCode ? proSignals.includes(reasonCode) : false;

  const favoredParty = favorsClient ? "client" : favorsPro ? "professional" : "undetermined";
  const recommendation = favorsClient
    ? "Hold escrow release. Request completion evidence from professional."
    : favorsPro
      ? "Verify payment terms. Request client acknowledgment."
      : "Request bilateral evidence package before any decision.";

  return {
    actionType: "recommend",
    summary: `Dispute triage: favors ${favoredParty} (confidence ${confidence.toFixed(2)})`,
    confidence,
    requiresHumanReview: true,
    payload: {
      recommendation,
      favoredParty,
      evidenceCount,
      contractExists,
      milestoneStatus,
      reasoning: reason,
      confidence
    }
  };
}

function buildTrustMatch(input: RuntimeAgentInput): RuntimeAgentResult {
  const payload = resolvePayload(input);
  const category = asString(payload.category) ?? "general";

  const realCandidates = Array.isArray(payload.realCandidates) ? payload.realCandidates : null;

  if (realCandidates && realCandidates.length > 0) {
    const top = realCandidates[0] as { userId: string; score: number; breakdown?: Record<string, number>; verificationStatus?: string; avgRating?: number };
    return {
      actionType: "recommend",
      summary: `${realCandidates.length} candidates ranked for ${category}`,
      confidence: clamp(0.5 + (top.score ?? 0) * 0.5, 0.5, 0.97),
      requiresHumanReview: true,
      payload: {
        topMatch: top.userId,
        matches: (realCandidates as Record<string, unknown>[]).slice(0, 5).map((c) => ({
          id: c.userId,
          score: c.score,
          verificationStatus: c.verificationStatus,
          avgRating: c.avgRating,
          breakdown: c.breakdown
        })),
        reasoning: "Candidates ranked by text similarity (Jaccard), trust score, verification and ratings."
      }
    };
  }

  return {
    actionType: "recommend",
    summary: `No candidates available for ${category} — manual review required`,
    confidence: 0.3,
    requiresHumanReview: true,
    payload: {
      topMatch: null,
      matches: [],
      reasoning: "No indexed candidates found for this job. Requires manual assignment."
    }
  };
}

// Late-binding delegate impl — set by registrations.ts after agents are loaded.
// Avoids circular ESM imports: runtime ↔ delegate ↔ registry ↔ registrations → runtime.
type DelegateFn = (role: RuntimeAgentRole, opts: { goal: string; context?: Record<string, unknown> }) => { result: RuntimeAgentResult };
let _delegateFn: DelegateFn | null = null;

export function setDelegateImpl(fn: DelegateFn): void {
  _delegateFn = fn;
}

// Late-binding verifier runner — instalado por "./verifiers.js" al cargarse
// (solo entrypoints server-side). Mismo patrón que setDelegateImpl: mantiene
// node:child_process fuera del grafo de imports del bundle de cliente.
export type VerifierRunnerFn = (criteria: VerifierName[], iteration: number, ctx: VerifierContext) => VerificationAttempt[];
let _verifierRunner: VerifierRunnerFn | null = null;

export function setVerifierRunner(fn: VerifierRunnerFn): void {
  _verifierRunner = fn;
}

/** Fail-closed: sin runner instalado, cada criterio reporta error → el loop agota y abre approval. */
function runVerifiersOrFailClosed(criteria: VerifierName[], iteration: number, ctx: VerifierContext): VerificationAttempt[] {
  if (_verifierRunner) {
    return _verifierRunner(criteria, iteration, ctx);
  }
  return criteria.map((verifier) => ({
    iteration,
    verifier,
    status: "error" as const,
    durationMs: 0,
    evidence: "verifier runner not installed — import @semse/agents/verifiers in the server entrypoint"
  }));
}

function buildOrchestrator(input: RuntimeAgentInput): RuntimeAgentResult {
  const payload = resolvePayload(input);
  const task = asString(payload.task) ?? input.eventType ?? "runtime task";
  const start = Date.now();

  let riskResult: RuntimeAgentResult | null = null;
  let planResult: RuntimeAgentResult | null = null;
  const agentsUsed: string[] = [];

  if (_delegateFn) {
    const riskDelegate = _delegateFn("risk", { goal: `Assess risk for: ${task}`, context: asRecord(payload) });
    const planDelegate = _delegateFn("job-planner", { goal: `Plan execution for: ${task}`, context: asRecord(payload) });
    riskResult = riskDelegate.result;
    planResult = planDelegate.result;
    agentsUsed.push("risk", "job-planner");
  }

  const confidence = riskResult && planResult
    ? Math.min(riskResult.confidence, planResult.confidence)
    : 0.63;

  return {
    actionType: "plan",
    summary: `Orchestration complete for: ${task}`,
    confidence,
    requiresHumanReview: true,
    payload: {
      agentsUsed: agentsUsed.length ? agentsUsed : ["risk", "job-planner"],
      executionMs: Date.now() - start,
      riskAssessment: riskResult?.payload ?? null,
      executionPlan: planResult?.payload ?? null,
      nextStep: "await_ops_approval",
    }
  };
}

function buildEcv(input: RuntimeAgentInput): RuntimeAgentResult {
  const payload = resolvePayload(input);
  const response = asString(payload.response) ?? "";
  const hasViolation = /always|guarantee|bypass/i.test(response);
  return {
    actionType: "classify",
    summary: hasViolation ? "ECV flagged a governance concern" : "ECV validation passed",
    confidence: hasViolation ? 0.78 : 0.72,
    requiresHumanReview: hasViolation,
    payload: {
      passed: !hasViolation,
      violations: hasViolation ? ["potential_overclaim"] : [],
      revisedResponse: hasViolation ? "The action requires human review before proceeding." : undefined
    }
  };
}

function asForgeTaskPacket(value: unknown): ForgeTaskPacket | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (
      typeof obj.id === "string" &&
      typeof obj.requestedRole === "string" &&
      typeof obj.environment === "string" &&
      Array.isArray(obj.allowedFiles) &&
      Array.isArray(obj.forbiddenFiles) &&
      Array.isArray(obj.allowedCommands)
    ) {
      return obj as unknown as ForgeTaskPacket;
    }
  }
  return undefined;
}

function buildForge(input: RuntimeAgentInput): RuntimeAgentResult {
  const task = asForgeTaskPacket(input.task);
  if (!task) {
    return {
      actionType: "alert",
      summary: "Missing or invalid Forge task packet in agent input",
      confidence: 1,
      requiresHumanReview: true,
      payload: { error: "invalid_task_packet", allowedInputKeys: Object.keys(input) }
    };
  }

  const manifest = getForgeAgentManifest(task.requestedRole);
  const firstCommand = task.allowedCommands[0];
  const inferredAction = typeof firstCommand === "string" && manifest.allowedActions.includes(firstCommand) ? firstCommand : undefined;
  const action = typeof input.action === "string" ? input.action : (inferredAction ?? "runtime.execute");
  let policy = evaluateForgePolicy({ manifest, task, action });
  let sandboxPlan: SandboxPlan | undefined;
  let patchPlan: ForgePatchPlan | undefined;
  let toolPlan: ForgeToolPlan | undefined;
  let patchResult: ForgePatchResult | undefined;

  if (policy.decision === "allow") {
    const sandboxProvider = createSandboxProvider({ mode: "dry-run" });
    sandboxPlan = sandboxProvider.plan({ task, action, environment: task.environment });

    if (sandboxPlan.decision === "deny") {
      policy = {
        ...policy,
        decision: "deny",
        reason: `Sandbox validation failed: ${sandboxPlan.reason}`,
        requiredApprovals: [],
        violatedPolicies: sandboxPlan.violations.map((violation) => `sandbox.${violation}`),
        auditTags: [...policy.auditTags, "forge.sandbox.denied"]
      };
    } else if (sandboxPlan.decision === "require_approval") {
      policy = {
        ...policy,
        decision: "require_approval",
        reason: `Sandbox validation requires approval: ${sandboxPlan.reason}`,
        requiredApprovals: [...new Set([...policy.requiredApprovals, ...sandboxPlan.requiredApprovals])],
        violatedPolicies: [],
        auditTags: [...policy.auditTags, "forge.sandbox.approval_required"]
      };
    }
  }

  if (policy.decision !== "deny" && Array.isArray(input.proposedFiles)) {
    const patchPlanner = createPatchPlanner({ mode: "dry-run" });
    patchPlan = patchPlanner.plan(task, input.proposedFiles as ProposedFileChange[]);

    if (patchPlan.decision === "deny") {
      policy = {
        ...policy,
        decision: "deny",
        reason: `Patch plan validation failed: ${patchPlan.reason}`,
        requiredApprovals: [],
        violatedPolicies: patchPlan.violations.map((violation) => `patch.${violation}`),
        auditTags: [...policy.auditTags, "forge.patch.denied"]
      };
    } else if (patchPlan.decision === "require_approval") {
      policy = {
        ...policy,
        decision: "require_approval",
        reason: `Patch plan validation requires approval: ${patchPlan.reason}`,
        requiredApprovals: [...new Set([...policy.requiredApprovals, ...patchPlan.requiredApprovals])],
        violatedPolicies: [],
        auditTags: [...policy.auditTags, "forge.patch.approval_required"]
      };
    }
  }

  if (policy.decision !== "deny") {
    const toolAdapter = createToolAdapter({ mode: "dry-run" });
    toolPlan = toolAdapter.plan({ task, action });

    if (toolPlan.decision === "deny") {
      policy = {
        ...policy,
        decision: "deny",
        reason: `Tool adapter validation failed: ${toolPlan.reason}`,
        requiredApprovals: [],
        violatedPolicies: toolPlan.violations.map((violation) => `tool.${violation}`),
        auditTags: [...policy.auditTags, "forge.tools.denied"]
      };
    } else if (toolPlan.decision === "require_approval") {
      policy = {
        ...policy,
        decision: "require_approval",
        reason: `Tool adapter validation requires approval: ${toolPlan.reason}`,
        requiredApprovals: [...new Set([...policy.requiredApprovals, ...toolPlan.requiredApprovals])],
        violatedPolicies: [],
        auditTags: [...policy.auditTags, "forge.tools.approval_required"]
      };
    }
  }

  if (policy.decision !== "deny" && patchPlan && patchPlan.decision !== "deny") {
    const patchWriter = createPatchWriter({ mode: "dry-run" });
    patchResult = patchWriter.apply(patchPlan);

    if (patchResult.decision === "deny") {
      policy = {
        ...policy,
        decision: "deny",
        reason: `Patch writer simulation failed: ${patchResult.reason}`,
        requiredApprovals: [],
        violatedPolicies: patchResult.violations.map((violation) => `patch.${violation}`),
        auditTags: [...policy.auditTags, "forge.patch.denied"]
      };
    }
  }

  const requiresHumanReview = policy.decision !== "allow";

  return {
    actionType: "forge.evaluate",
    summary: `Forge policy for '${task.id}' (${task.requestedRole}): ${policy.decision}`,
    confidence: requiresHumanReview ? 0.5 : 0.95,
    requiresHumanReview,
    payload: {
      forgeRunId: input.forgeRunId,
      taskId: task.id,
      requestedRole: task.requestedRole,
      action,
      policy,
      sandbox: sandboxPlan,
      patch: patchPlan,
      tools: toolPlan,
      patchResult,
      riskLevel: policy.riskLevel,
      requiredApprovals: policy.requiredApprovals
    }
  };
}

function executeSpecializedHandler(agentType: RuntimeAgentRole, input: RuntimeAgentInput): RuntimeAgentResult {
  switch (agentType) {
    case "pricing":
      return buildPricing(input);
    case "job-planner":
      return buildJobPlan(input);
    case "trust-match":
      return buildTrustMatch(input);
    case "evidence-coach":
      return buildEvidenceCoach(input);
    case "risk":
      return buildRisk(input);
    case "dispute":
      return buildDispute(input);
    case "orchestrator":
      return buildOrchestrator(input);
    case "ecv":
      return buildEcv(input);
    case "forge":
      return buildForge(input);
    // Prometeo agents — handled by specialized worker handlers, not the in-process runtime
    case "field-ops":
    case "project-copilot":
    case "technical-agent":
    case "legal-agent":
    case "financial-agent":
    case "qa-agent":
    default:
      return buildEcv(input); // minimal passthrough
  }
}

function auditEvent(type: string, detail: Record<string, unknown>, status: "ok" | "warn" | "error" = "ok"): AgentAuditEvent {
  return {
    type,
    status,
    timestamp: new Date().toISOString(),
    detail
  };
}

export function executeSpecializedAgent(agentType: RuntimeAgentRole, input: RuntimeAgentInput): RuntimeAgentResult {
  return executeSpecializedHandler(agentType, input);
}

export type { RuntimeAgentResult };

const RISK_LEVEL_ORDER: AgentRiskLevel[] = ["low", "medium", "high", "critical"];
const RISK_LEVEL_FLOOR_SCORE: Record<AgentRiskLevel, number> = {
  low: 0,
  medium: 0.35,
  high: 0.6,
  critical: 0.85
};

/** SPEC-AGT-001 §3 paso 7: "exhausted" sube +1 nivel de riesgo, piso "medium". */
function escalateRiskForExhaustion(risk: AgentRiskAssessment): AgentRiskAssessment {
  const currentIndex = RISK_LEVEL_ORDER.indexOf(risk.riskLevel);
  const escalatedLevel = RISK_LEVEL_ORDER[Math.min(currentIndex + 1, RISK_LEVEL_ORDER.length - 1)];
  const flooredLevel = RISK_LEVEL_ORDER.indexOf(escalatedLevel) < 1 ? "medium" : escalatedLevel;

  return {
    ...risk,
    riskLevel: flooredLevel,
    riskScore: Math.max(risk.riskScore, RISK_LEVEL_FLOOR_SCORE[flooredLevel]),
    reasons: [...risk.reasons, "verification loop exhausted its budget without passing"],
    tags: [...risk.tags, "verification:exhausted"]
  };
}

function summarizeLastFailure(attempts: VerificationAttempt[]): string {
  const lastFailure = [...attempts].reverse().find((attempt) => attempt.status === "fail" || attempt.status === "error");
  if (!lastFailure) {
    return "no failing attempt recorded";
  }
  const evidence = lastFailure.evidence ? `: ${lastFailure.evidence.slice(0, 200)}` : "";
  return `${lastFailure.verifier} (${lastFailure.status})${evidence}`;
}

export function executeGovernedAgentRun(input: {
  agentType: RuntimeAgentRole;
  runId: string;
  correlationId: string;
  payload: RuntimeAgentInput;
  environment?: "api" | "worker" | "web" | "test";
  /** SPEC-AGT-001: actionType declarado del run. Default "runtime.execute" (lectura/análisis). */
  actionType?: string;
  /** SPEC-AGT-001 (P2): presupuesto de verificación — obligatorio si el actionType es de escritura. */
  verification?: VerificationBudget;
  /** Contexto de ejecución de los verificadores (raíz del repo, workspace). */
  verifierContext?: Partial<VerifierContext>;
}): GovernedAgentExecutionResult {
  const manifest = getRuntimeAgentManifest(input.agentType);
  const contextEnvelope = resolveAllowedContextEnvelope(input.agentType, input.payload);
  const contextSources = inferContextSources(input.agentType, input.payload);
  const auditTrail: AgentAuditEvent[] = [];

  const policy = evaluateAgentPolicy({
    agentType: input.agentType,
    actionType: "runtime.execute",
    target: input.agentType,
    targetKind: "agent",
    requestedContextSources: contextSources,
    environment: input.environment ?? "worker"
  });

  auditTrail.push(
    auditEvent("agent.policy.evaluate", {
      decision: policy.decision,
      riskScore: policy.riskScore,
      riskLevel: policy.riskLevel,
      requiredApprovals: policy.requiredApprovals
    }, policy.decision === "allow" ? "ok" : "warn")
  );

  if (input.payload.operatorContext) {
    auditTrail.push(
      auditEvent("agent.operator_context", {
        source: input.payload.operatorContext.source,
        scope: input.payload.operatorContext.scope,
        operatorId: input.payload.operatorContext.operatorId,
        workspaceId: input.payload.operatorContext.workspaceId,
        repoId: input.payload.operatorContext.repoId,
        runId: input.payload.operatorContext.runId,
        taskId: input.payload.operatorContext.taskId
      })
    );
  }

  if (policy.decision === "deny") {
    const risk = classifyAgentRisk({
      actionType: "runtime.execute",
      target: input.agentType,
      targetKind: "agent",
      environment: input.environment ?? "worker"
    });

    return {
      actionType: "alert",
      summary: "Agent execution denied by policy engine",
      confidence: 1,
      requiresHumanReview: true,
      payload: {
        policyDecision: policy.decision,
        denied: true,
        violatedPolicies: policy.violatedPolicies
      },
      policy,
      toolDecisions: [],
      risk,
      approvalRequests: [],
      auditTrail,
      manifest,
      contextEnvelope
    };
  }

  // SPEC-AGT-001 regla P2: un run de escritura sin successCriteria no vacío se deniega.
  const declaredActionType = input.actionType ?? "runtime.execute";
  const isWriteRun = isWriteActionType(declaredActionType);
  if (isWriteRun && (!input.verification || input.verification.successCriteria.length === 0)) {
    const risk = classifyAgentRisk({
      actionType: declaredActionType,
      target: input.agentType,
      targetKind: "agent",
      environment: input.environment ?? "worker"
    });

    auditTrail.push(
      auditEvent("agent.policy.deny", {
        reason: MISSING_VERIFICATION_BUDGET_REASON,
        actionType: declaredActionType
      }, "warn")
    );

    return {
      actionType: "alert",
      summary: "Write run denied: verification budget with success criteria is required",
      confidence: 1,
      requiresHumanReview: true,
      payload: {
        policyDecision: "deny",
        denied: true,
        violatedPolicies: ["verification.budget_missing"],
        policyReason: MISSING_VERIFICATION_BUDGET_REASON
      },
      policy: {
        ...policy,
        decision: "deny",
        reason: MISSING_VERIFICATION_BUDGET_REASON,
        violatedPolicies: ["verification.budget_missing"]
      },
      toolDecisions: [],
      risk,
      approvalRequests: [],
      auditTrail,
      manifest,
      contextEnvelope
    };
  }

  const toolDecisions = derivePlannedTools(input.agentType).map((toolName: AgentToolName) => {
    const toolPolicy = evaluateAgentPolicy({
      agentType: input.agentType,
      actionType: agentTypeToAction(toolName),
      toolName,
      target: input.agentType,
      targetKind: "runtime",
      requestedContextSources: contextSources,
      environment: input.environment ?? "worker"
    });

    auditTrail.push(auditEvent("agent.tool.evaluate", {
      toolName,
      decision: toolPolicy.decision,
      riskScore: toolPolicy.riskScore
    }, toolPolicy.decision === "allow" ? "ok" : "warn"));

    return {
      toolName,
      ...toolPolicy
    };
  });

  if (toolDecisions.some((decision) => decision.decision === "deny")) {
    const deniedTools = toolDecisions.filter((decision) => decision.decision === "deny").map((decision) => decision.toolName);
    const risk = classifyAgentRisk({
      actionType: "runtime.execute",
      target: input.agentType,
      targetKind: "agent",
      environment: input.environment ?? "worker"
    });

    return {
      actionType: "alert",
      summary: "Agent execution blocked by tool policy",
      confidence: 1,
      requiresHumanReview: true,
      payload: {
        policyDecision: "deny",
        deniedTools
      },
      policy,
      toolDecisions,
      risk,
      approvalRequests: [],
      auditTrail,
      manifest,
      contextEnvelope
    };
  }

  let result = executeSpecializedHandler(input.agentType, contextEnvelope.data);

  // SPEC-AGT-001 §3: loop actuar→verificar→corregir para runs de escritura.
  let verification: VerificationReport | undefined;
  if (isWriteRun && input.verification) {
    const budget = clampVerificationBudget(input.verification);
    const verifierContext: VerifierContext = {
      repoPath: input.verifierContext?.repoPath ?? process.cwd(),
      workspace: input.verifierContext?.workspace,
      payload: input.verifierContext?.payload
    };
    const deadline = Date.now() + (budget.timeoutMs ?? DEFAULT_VERIFICATION_TIMEOUT_MS);
    const attempts: VerificationAttempt[] = [];
    let verified = false;
    let iterationsUsed = 0;

    for (let iteration = 1; iteration <= budget.maxIterations; iteration += 1) {
      iterationsUsed = iteration;
      const iterationAttempts = runVerifiersOrFailClosed(budget.successCriteria, iteration, verifierContext);
      attempts.push(...iterationAttempts);

      for (const attempt of iterationAttempts) {
        auditTrail.push(
          auditEvent("agent.verify", {
            iteration: attempt.iteration,
            verifier: attempt.verifier,
            status: attempt.status,
            durationMs: attempt.durationMs
          }, attempt.status === "pass" || attempt.status === "skipped" ? "ok" : "warn")
        );
      }

      if (iterationAttempts.every((attempt) => attempt.status === "pass" || attempt.status === "skipped")) {
        verified = true;
        break;
      }

      if (Date.now() >= deadline) {
        auditTrail.push(auditEvent("agent.verify.timeout", { iteration, timeoutMs: budget.timeoutMs ?? DEFAULT_VERIFICATION_TIMEOUT_MS }, "warn"));
        break;
      }

      if (iteration < budget.maxIterations) {
        const failedVerifiers = iterationAttempts
          .filter((attempt) => attempt.status === "fail" || attempt.status === "error")
          .map((attempt) => attempt.verifier);

        auditTrail.push(
          auditEvent("agent.fix.attempt", { iteration, failedVerifiers }, "warn")
        );

        // El fix es el MISMO handler en modo "fix" — no un agente nuevo (§3).
        result = executeSpecializedHandler(input.agentType, {
          ...contextEnvelope.data,
          mode: "fix",
          fixInput: {
            iteration,
            failedVerifiers,
            evidence: summarizeLastFailure(iterationAttempts)
          }
        });
      }
    }

    verification = {
      budget,
      attempts,
      finalStatus: verified ? "verified" : "exhausted",
      iterationsUsed
    };
  }

  const verificationExhausted = verification?.finalStatus === "exhausted";
  const baseRisk = classifyAgentRisk({
    actionType: result.actionType,
    target: input.agentType,
    targetKind: input.agentType === "dispute" || input.agentType === "ecv" ? "policy" : "runtime",
    environment: input.environment ?? "worker"
  });
  const risk = verificationExhausted ? escalateRiskForExhaustion(baseRisk) : baseRisk;

  // "exhausted" nunca falla silenciosamente: siempre abre approval humano (§3 paso 6).
  const requiresHumanReview = result.requiresHumanReview || verificationExhausted;
  const approvalRequests = createApprovalRequests({
    runId: input.runId,
    correlationId: input.correlationId,
    agentType: input.agentType,
    policy,
    summary: result.summary,
    risk,
    contextSummary: verificationExhausted && verification
      ? `${input.agentType}: verification exhausted after ${verification.iterationsUsed} iterations — last failure: ${summarizeLastFailure(verification.attempts)}`
      : `${input.agentType}:${result.summary}`,
    requiresHumanReview
  });

  auditTrail.push(
    auditEvent("agent.runtime.complete", {
      actionType: result.actionType,
      riskScore: risk.riskScore,
      approvalsOpened: approvalRequests.length,
      ...(verification ? { verificationStatus: verification.finalStatus, verificationIterations: verification.iterationsUsed } : {})
    }, verificationExhausted ? "warn" : "ok")
  );

  return {
    ...result,
    requiresHumanReview: requiresHumanReview || approvalRequests.length > 0,
    payload: {
      ...result.payload,
      policyDecision: policy.decision,
      policyReason: policy.reason,
      riskScore: risk.riskScore,
      riskLevel: risk.riskLevel,
      approvals: approvalRequests,
      toolTrace: toolDecisions.map((entry) => ({
        toolName: entry.toolName,
        decision: entry.decision,
        riskScore: entry.riskScore
      })),
      auditTrail,
      ...(verification ? { verification } : {})
    },
    policy,
    toolDecisions,
    risk,
    approvalRequests,
    auditTrail,
    manifest,
    contextEnvelope,
    ...(verification ? { verification } : {})
  };
}

function agentTypeToAction(toolName: AgentToolName): string {
  switch (toolName) {
    case "decision.plan":
      return "decision.plan";
    case "decision.classify_risk":
      return "decision.classify_risk";
    case "decision.recommend":
      return "decision.recommend";
    case "approval.request.human":
      return "approval.request";
    case "event.emit.domain":
      return "event.emit";
    case "runtime.complete_run":
      return "runtime.complete";
    case "audit.record.agent":
      return "audit.record";
    case "memory.read.agent":
      return "memory.read";
    default:
      return "context.read";
  }
}
