import {
  type AgentAuditEvent,
  type AgentContextSource,
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

export function executeGovernedAgentRun(input: {
  agentType: RuntimeAgentRole;
  runId: string;
  correlationId: string;
  payload: RuntimeAgentInput;
  environment?: "api" | "worker" | "web" | "test";
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

  const result = executeSpecializedHandler(input.agentType, contextEnvelope.data);
  const risk = classifyAgentRisk({
    actionType: result.actionType,
    target: input.agentType,
    targetKind: input.agentType === "dispute" || input.agentType === "ecv" ? "policy" : "runtime",
    environment: input.environment ?? "worker"
  });
  const approvalRequests = createApprovalRequests({
    runId: input.runId,
    correlationId: input.correlationId,
    agentType: input.agentType,
    policy,
    summary: result.summary,
    risk,
    contextSummary: `${input.agentType}:${result.summary}`,
    requiresHumanReview: result.requiresHumanReview
  });

  auditTrail.push(
    auditEvent("agent.runtime.complete", {
      actionType: result.actionType,
      riskScore: risk.riskScore,
      approvalsOpened: approvalRequests.length
    })
  );

  return {
    ...result,
    requiresHumanReview: result.requiresHumanReview || approvalRequests.length > 0,
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
      auditTrail
    },
    policy,
    toolDecisions,
    risk,
    approvalRequests,
    auditTrail,
    manifest,
    contextEnvelope
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
