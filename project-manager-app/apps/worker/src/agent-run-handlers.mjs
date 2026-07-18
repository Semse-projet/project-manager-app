import { executeGovernedAgentRun } from "@semse/agents";
import { handleBrowserAgent } from "./browser-agent/browser-agent.runner.mjs";

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value) {
  return Math.round(value * 100) / 100;
}

function normalizeStatus(value) {
  return asString(value).toLowerCase();
}

function roundCurrency(amount) {
  return Math.round(amount / 25) * 25;
}

function summarizeText(value, limit = 220) {
  const text = asString(value);
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, Math.max(0, limit - 1))}…`;
}

function extractContext(run) {
  const input = asObject(run?.input);
  return { ...input, ...asObject(input.context) };
}

async function safeRequestJson(requestJson, path, init, options, logger, label) {
  try {
    return await requestJson(path, init, options);
  } catch (error) {
    logger?.warn({
      path,
      error: error instanceof Error ? error.message : String(error),
    }, label ?? "optional worker context request failed");
    return null;
  }
}

function countEvidenceKinds(evidence) {
  const counts = { total: evidence.length, photo: 0, video: 0, document: 0, other: 0 };
  for (const item of evidence) {
    const kind = normalizeStatus(item.kind ?? item.type ?? item.mimeType ?? item.contentType);
    if (kind.includes("photo") || kind.includes("image") || kind.includes("jpg") || kind.includes("png")) {
      counts.photo += 1;
    } else if (kind.includes("video") || kind.includes("mp4") || kind.includes("mov")) {
      counts.video += 1;
    } else if (kind.includes("document") || kind.includes("pdf") || kind.includes("doc")) {
      counts.document += 1;
    } else {
      counts.other += 1;
    }
  }
  return counts;
}

async function resolveProjectAndJob(context, requestJson, tenantId) {
  let projectId = asString(context.projectId);
  let jobId = asString(context.jobId);

  if (!projectId) {
    projectId = asString(context.project?.projectId) || asString(context.workspace?.projectId);
  }
  if (!jobId) {
    jobId = asString(context.project?.jobId) || asString(context.job?.jobId);
  }

  if (!projectId && jobId) {
    const projects = await requestJson(`/v1/projects?jobId=${encodeURIComponent(jobId)}`, { method: "GET" }, { tenantId });
    const first = Array.isArray(projects?.data) ? projects.data[0] : null;
    projectId = asString(first?.id);
  }

  if (projectId && !jobId) {
    const project = await requestJson(`/v1/projects/${encodeURIComponent(projectId)}`, { method: "GET" }, { tenantId });
    jobId = asString(project?.data?.jobId);
  }

  if (!projectId && !jobId) {
    throw new Error("Delegated run requires at least projectId or jobId in its context.");
  }

  return { projectId, jobId };
}

async function loadOperationalContext({ context, requestJson, tenantId, logger }) {
  const { projectId, jobId } = await resolveProjectAndJob(context, requestJson, tenantId);

  const jobPromise = jobId
    ? safeRequestJson(
        requestJson,
        `/v1/jobs/${encodeURIComponent(jobId)}`,
        { method: "GET" },
        { tenantId },
        logger,
        "job context unavailable"
      )
    : Promise.resolve(null);

  const projectPromise = projectId
    ? safeRequestJson(
        requestJson,
        `/v1/projects/${encodeURIComponent(projectId)}`,
        { method: "GET" },
        { tenantId },
        logger,
        "project context unavailable"
      )
    : Promise.resolve(null);

  const milestonesPromise = projectId
    ? safeRequestJson(
        requestJson,
        `/v1/projects/${encodeURIComponent(projectId)}/milestones`,
        { method: "GET" },
        { tenantId },
        logger,
        "project milestones unavailable"
      )
    : jobId
      ? safeRequestJson(
          requestJson,
          `/v1/jobs/${encodeURIComponent(jobId)}/milestones`,
          { method: "GET" },
          { tenantId },
          logger,
          "job milestones unavailable"
        )
      : Promise.resolve(null);

  const evidencePromise = projectId
    ? safeRequestJson(
        requestJson,
        `/v1/projects/${encodeURIComponent(projectId)}/evidence`,
        { method: "GET" },
        { tenantId },
        logger,
        "project evidence unavailable"
      )
    : jobId
      ? safeRequestJson(
          requestJson,
          `/v1/jobs/${encodeURIComponent(jobId)}/evidence`,
          { method: "GET" },
          { tenantId },
          logger,
          "job evidence unavailable"
        )
      : Promise.resolve(null);

  const [jobRes, projectRes, milestonesRes, evidenceRes] = await Promise.all([
    jobPromise,
    projectPromise,
    milestonesPromise,
    evidencePromise,
  ]);

  return {
    projectId,
    jobId,
    job: asObject(jobRes?.data),
    project: asObject(projectRes?.data),
    milestones: asArray(milestonesRes?.data).map((item) => asObject(item)),
    evidence: asArray(evidenceRes?.data).map((item) => asObject(item)),
  };
}

async function handleFieldOps({ run, requestJson, tenantId, logger }) {
  const context = extractContext(run);
  const { projectId, jobId } = await resolveProjectAndJob(context, requestJson, tenantId);

  if (!projectId) {
    throw new Error("Field-ops assessment requires a projectId.");
  }

  const [projectRes, milestonesRes, evidenceRes] = await Promise.all([
    requestJson(`/v1/projects/${encodeURIComponent(projectId)}`, { method: "GET" }, { tenantId }),
    requestJson(`/v1/projects/${encodeURIComponent(projectId)}/milestones`, { method: "GET" }, { tenantId }),
    requestJson(`/v1/projects/${encodeURIComponent(projectId)}/evidence`, { method: "GET" }, { tenantId }),
  ]);

  const project = asObject(projectRes?.data);
  const milestones = Array.isArray(milestonesRes?.data) ? milestonesRes.data.map((item) => asObject(item)) : [];
  const evidence = Array.isArray(evidenceRes?.data) ? evidenceRes.data.map((item) => asObject(item)) : [];

  const evidenceByMilestone = new Map();
  for (const item of evidence) {
    const milestoneId = asString(item.milestoneId);
    if (!milestoneId) {
      continue;
    }
    evidenceByMilestone.set(milestoneId, (evidenceByMilestone.get(milestoneId) ?? 0) + 1);
  }

  const submittedMilestones = milestones.filter((item) => {
    const status = normalizeStatus(item.statusRaw ?? item.status);
    return status === "submitted" || status === "awaiting_review";
  });

  const insufficientMilestones = submittedMilestones.filter((item) => {
    const milestoneId = asString(item.id);
    const explicitCount = asNumber(item.evidenceCount);
    const counted = evidenceByMilestone.get(milestoneId) ?? 0;
    const evidenceCount = explicitCount ?? counted;
    return evidenceCount <= 0;
  });

  const documentationSufficient = submittedMilestones.length > 0
    ? insufficientMilestones.length === 0
    : evidence.length > 0;

  const readyMilestones = submittedMilestones
    .filter((item) => !insufficientMilestones.includes(item))
    .map((item) => ({
      milestoneId: asString(item.id),
      title: asString(item.title),
      evidenceCount: asNumber(item.evidenceCount) ?? evidenceByMilestone.get(asString(item.id)) ?? 0,
    }));

  const result = {
    projectId,
    jobId: jobId || undefined,
    projectStatus: asString(project.status) || undefined,
    projectJobId: asString(project.jobId) || jobId || undefined,
    totalMilestones: milestones.length,
    submittedMilestones: submittedMilestones.length,
    evidenceCount: evidence.length,
    documentationSufficient,
    readyMilestones,
    missingDocumentation: insufficientMilestones.map((item) => ({
      milestoneId: asString(item.id),
      title: asString(item.title),
      issue: "Milestone submitted without supporting evidence.",
    })),
    assessment: documentationSufficient
      ? "La documentación operativa disponible es suficiente para revisión humana."
      : "Falta documentación operativa antes de aprobar hitos en campo.",
  };

  const summary = documentationSufficient
    ? `Field-ops validó ${submittedMilestones.length || milestones.length} milestone(s) para '${projectId}': ${evidence.length} evidencia(s) indexada(s) y sin huecos críticos.`
    : `Field-ops detectó documentación insuficiente en ${insufficientMilestones.length}/${submittedMilestones.length || 1} milestone(s) del proyecto '${projectId}'.`;

  logger.info({ runId: run.id, projectId, jobId, documentationSufficient }, "field-ops handler completed");
  return { summary, result };
}

async function handleTrustMatch({ run, requestJson, tenantId, logger }) {
  const context = extractContext(run);
  const { projectId, jobId } = await resolveProjectAndJob(context, requestJson, tenantId);

  if (!jobId) {
    throw new Error("Trust-match requires a jobId or a project linked to a job.");
  }

  const [matchRes, trustRes] = await Promise.all([
    requestJson("/v1/matching/jobs", {
      method: "POST",
      body: JSON.stringify({
        jobId,
        limit: asNumber(context.limit) ?? 5,
        minScore: asNumber(context.minScore) ?? 0,
      }),
    }, { tenantId }),
    requestJson(`/v1/jobs/${encodeURIComponent(jobId)}/trust`, { method: "GET" }, { tenantId }),
  ]);

  const match = asObject(matchRes?.data);
  const trust = asObject(trustRes?.data);
  const candidates = Array.isArray(match.candidates) ? match.candidates.map((item) => asObject(item)) : [];
  const topCandidate = candidates[0] ?? null;

  const result = {
    projectId: projectId || undefined,
    jobId,
    candidatesEvaluated: asNumber(match.candidatesEvaluated) ?? candidates.length,
    algorithmVersion: asString(match.algorithmVersion) || undefined,
    topCandidate: topCandidate
      ? {
          professionalId: asString(topCandidate.professionalId),
          professionalName: asString(topCandidate.professionalName),
          score: asNumber(topCandidate.score) ?? null,
          etaDays: asNumber(topCandidate.etaDays),
          reputationScore: asNumber(topCandidate.reputationScore),
        }
      : null,
    trustSnapshot: {
      score: asNumber(trust.score),
      level: asString(trust.level) || undefined,
      flags: Array.isArray(trust.flags) ? trust.flags : [],
    },
    candidates: candidates.slice(0, 3),
  };

  const topScore = topCandidate ? asNumber(topCandidate.score) : null;
  const summary = topCandidate
    ? `Trust-match evaluó ${result.candidatesEvaluated} candidato(s) para '${jobId}'. Mejor match: ${asString(topCandidate.professionalName) || asString(topCandidate.professionalId)} con score ${topScore?.toFixed(2) ?? "n/a"}.`
    : `Trust-match no encontró candidatos viables para '${jobId}' con los filtros actuales.`;

  logger.info({ runId: run.id, projectId, jobId, topScore }, "trust-match handler completed");
  return { summary, result };
}

function estimatePricingFromScope(job) {
  const title = asString(job.title);
  const scope = asString(job.scope);
  const scopeText = `${title} ${scope}`.toLowerCase();

  const keywordWeights = [
    { pattern: /(roof|roofing|techo|foundation|structural|electrical|plumbing|demolition|solar)/g, weight: 800 },
    { pattern: /(permit|inspection|codigo|code|hazmat|asbestos|panel)/g, weight: 450 },
    { pattern: /(paint|painting|cleanup|cleaning|minor|small|touch[- ]?up|repair)/g, weight: 150 },
  ];

  let heuristicBase = 900 + Math.min(2200, scopeText.split(/\s+/).filter(Boolean).length * 18);
  for (const { pattern, weight } of keywordWeights) {
    const matches = scopeText.match(pattern);
    if (matches?.length) {
      heuristicBase += matches.length * weight;
    }
  }

  const budgetMin = asNumber(job.budgetMin);
  const budgetMax = asNumber(job.budgetMax);
  const observedMidpoint = budgetMin !== null && budgetMax !== null
    ? (budgetMin + budgetMax) / 2
    : budgetMax ?? budgetMin ?? null;

  const baseline = observedMidpoint ?? heuristicBase;
  const rangeFactor = scopeText.includes("urgent") || scopeText.includes("asap") ? 0.22 : 0.16;
  const recommendedMin = roundCurrency(Math.max(250, baseline * (1 - rangeFactor)));
  const recommendedMax = roundCurrency(Math.max(recommendedMin + 150, baseline * (1 + rangeFactor)));

  return {
    baselineSource: observedMidpoint !== null ? "job_budget" : "scope_heuristic",
    recommendedMin,
    recommendedMax,
    midpoint: roundCurrency((recommendedMin + recommendedMax) / 2),
    confidence: observedMidpoint !== null ? "high" : "medium",
  };
}

async function handlePricing({ run, requestJson, tenantId, logger }) {
  const context = extractContext(run);
  const { projectId, jobId } = await resolveProjectAndJob(context, requestJson, tenantId);

  if (!jobId) {
    throw new Error("Pricing requires a jobId or a project linked to a job.");
  }

  const jobRes = await requestJson(`/v1/jobs/${encodeURIComponent(jobId)}`, { method: "GET" }, { tenantId });
  const job = asObject(jobRes?.data);
  const estimate = estimatePricingFromScope(job);

  const result = {
    projectId: projectId || undefined,
    jobId,
    title: asString(job.title),
    status: asString(job.status) || undefined,
    budgetMin: asNumber(job.budgetMin),
    budgetMax: asNumber(job.budgetMax),
    scopeSummary: summarizeText(job.scope, 320),
    estimate,
  };

  const summary = `Pricing estimó ${estimate.recommendedMin}-${estimate.recommendedMax} USD para '${jobId}' (${estimate.baselineSource === "job_budget" ? "ajustado contra budget actual" : "calculado desde scope"}).`;

  logger.info({ runId: run.id, projectId, jobId, estimate }, "pricing handler completed");
  return { summary, result };
}

function derivePlannerMilestones(job, existingMilestones) {
  if (existingMilestones.length > 0) {
    return existingMilestones.slice(0, 8).map((item, index) => ({
      sequence: asNumber(item.sequence) ?? index + 1,
      title: asString(item.title) || `Milestone ${index + 1}`,
      description: summarizeText(item.description ?? item.scope ?? item.notes, 180),
      status: asString(item.statusRaw ?? item.status) || "planned",
      amount: asNumber(item.amount),
    }));
  }

  const scopeText = `${asString(job.title)} ${asString(job.scope)} ${asString(job.category)}`.toLowerCase();
  const isPermitHeavy = /(permit|inspection|code|codigo|electrical|plumbing|structural|roof|roofing|hvac)/i.test(scopeText);
  const isFinishWork = /(paint|painting|drywall|floor|tile|finish|cleanup|cleaning)/i.test(scopeText);

  const milestones = [
    {
      sequence: 1,
      title: "Scope confirmation",
      description: "Confirm site conditions, access constraints, exclusions and acceptance criteria.",
    },
    {
      sequence: 2,
      title: isPermitHeavy ? "Permits and safety setup" : "Materials and work prep",
      description: isPermitHeavy
        ? "Validate permit, inspection and safety requirements before field execution."
        : "Prepare materials, crew plan and work area before starting execution.",
    },
    {
      sequence: 3,
      title: isFinishWork ? "Finish execution" : "Core execution",
      description: "Complete the primary scope and capture progress evidence as work advances.",
    },
    {
      sequence: 4,
      title: "Evidence review",
      description: "Upload before/after evidence, documents and completion notes for review.",
    },
    {
      sequence: 5,
      title: "Closeout and payment readiness",
      description: "Resolve punch-list items, confirm approval state and prepare payment release.",
    },
  ];

  return milestones;
}

function estimatePlannerDays(job, milestones) {
  const scope = asString(job.scope);
  const urgency = normalizeStatus(job.urgency);
  const scopeWords = scope.split(/\s+/).filter(Boolean).length;
  const budgetAnchor = asNumber(job.budgetMax) ?? asNumber(job.budgetMin) ?? 0;
  const milestoneFactor = Math.max(1, milestones.length);
  let days = Math.ceil(scopeWords / 55) + Math.ceil(milestoneFactor * 0.8);
  if (budgetAnchor >= 10_000) days += 3;
  if (budgetAnchor >= 50_000) days += 5;
  if (urgency === "urgent" || urgency === "asap") days = Math.max(1, days - 1);
  return clampNumber(days, 2, 30);
}

async function handleJobPlanner({ run, requestJson, tenantId, logger }) {
  const context = extractContext(run);
  const loaded = await loadOperationalContext({ context, requestJson, tenantId, logger });

  if (!loaded.jobId) {
    throw new Error("Job-planner requires a jobId or a project linked to a job.");
  }

  const job = loaded.job;
  const title = asString(job.title) || asString(loaded.project.title) || loaded.jobId;
  const scope = asString(job.scope) || asString(loaded.project.scope);
  const milestones = derivePlannerMilestones(job, loaded.milestones);
  const estimatedDays = estimatePlannerDays(job, milestones);
  const budgetMin = asNumber(job.budgetMin);
  const budgetMax = asNumber(job.budgetMax);
  const scopeGaps = [];
  const risks = [];

  if (scope.length < 80) {
    scopeGaps.push("Scope is shorter than the minimum planning baseline.");
    risks.push("thin_scope_definition");
  }
  if (budgetMin === null && budgetMax === null) {
    scopeGaps.push("Budget anchor is missing.");
    risks.push("missing_budget_anchor");
  }
  if (loaded.milestones.length === 0) {
    scopeGaps.push("No persisted milestones exist yet; worker generated a planning draft.");
  }
  if (loaded.evidence.length === 0 && loaded.projectId) {
    risks.push("no_project_evidence_indexed");
  }

  const confidence = roundScore(clampNumber(0.88 - (scopeGaps.length * 0.08) - (risks.length * 0.03), 0.52, 0.91));
  const result = {
    projectId: loaded.projectId || undefined,
    jobId: loaded.jobId,
    title,
    category: asString(job.category) || undefined,
    scopeSummary: summarizeText(scope, 360),
    milestones,
    estimatedDays,
    scopeGaps,
    risks,
    confidence,
  };

  const summary = `Job-planner generó plan para '${loaded.jobId}': ${milestones.length} hito(s), ${estimatedDays} día(s) estimados, ${scopeGaps.length} gap(s) de alcance.`;

  logger.info({ runId: run.id, projectId: loaded.projectId, jobId: loaded.jobId, estimatedDays, confidence }, "job-planner handler completed");
  return {
    actionType: "plan",
    summary,
    confidence,
    requiresHumanReview: scopeGaps.length > 0 || risks.includes("missing_budget_anchor"),
    result,
  };
}

function hasBeforeAfterEvidence(evidence) {
  const labels = evidence.map((item) => `${asString(item.title)} ${asString(item.description)} ${asString(item.filename)} ${asString(item.url)}`.toLowerCase());
  const hasBefore = labels.some((entry) => /\bbefore\b|antes/.test(entry));
  const hasAfter = labels.some((entry) => /\bafter\b|despues|después|final|complete/.test(entry));
  return hasBefore && hasAfter;
}

async function loadMilestoneEvidenceContext({ context, requestJson, tenantId, logger }) {
  const milestoneId = asString(context.milestoneId);
  if (!milestoneId) {
    return { milestoneId: "", evidenceItems: [], visionSummary: null };
  }

  const [itemsRes, visionRes] = await Promise.all([
    safeRequestJson(
      requestJson,
      `/v1/milestones/${encodeURIComponent(milestoneId)}/evidence-items`,
      { method: "GET" },
      { tenantId },
      logger,
      "milestone evidence items unavailable"
    ),
    safeRequestJson(
      requestJson,
      `/v1/milestones/${encodeURIComponent(milestoneId)}/vision-summary`,
      { method: "GET" },
      { tenantId },
      logger,
      "milestone vision summary unavailable"
    ),
  ]);

  return {
    milestoneId,
    evidenceItems: asArray(itemsRes?.data).map((item) => asObject(item)),
    visionSummary: asObject(visionRes?.data),
  };
}

async function handleEvidenceCoach({ run, requestJson, tenantId, logger }) {
  const context = extractContext(run);
  let loaded = {
    projectId: "",
    jobId: "",
    job: {},
    project: {},
    milestones: [],
    evidence: [],
  };
  try {
    loaded = await loadOperationalContext({ context, requestJson, tenantId, logger });
  } catch (error) {
    if (!asString(context.milestoneId)) {
      throw error;
    }
    logger.warn({
      runId: run.id,
      error: error instanceof Error ? error.message : String(error),
    }, "evidence-coach continuing with milestone-only context");
  }
  const milestoneContext = await loadMilestoneEvidenceContext({ context, requestJson, tenantId, logger });
  const evidence = milestoneContext.evidenceItems.length > 0 ? milestoneContext.evidenceItems : loaded.evidence;
  const counts = countEvidenceKinds(evidence);
  const submittedMilestones = loaded.milestones.filter((item) => {
    const status = normalizeStatus(item.statusRaw ?? item.status);
    return status === "submitted" || status === "awaiting_review";
  });

  const hasBeforeAfterPair = hasBeforeAfterEvidence(evidence) || Boolean(milestoneContext.visionSummary?.hasBeforeAfterPair);
  const visionReady = milestoneContext.visionSummary?.overallVisionReady === true;
  const missingItems = [];

  if (counts.photo === 0) {
    missingItems.push("Add at least one field photo.");
  }
  if (!hasBeforeAfterPair && counts.total > 0) {
    missingItems.push("Add before/after evidence for approval confidence.");
  }
  if (submittedMilestones.length > 0 && counts.total < submittedMilestones.length) {
    missingItems.push("Evidence count is below submitted milestone count.");
  }
  if (counts.document === 0 && loaded.milestones.length > 0) {
    missingItems.push("Attach a closeout note, invoice, permit or supporting document when applicable.");
  }

  let qualityScore = 0.12;
  if (counts.photo > 0) qualityScore += 0.24;
  if (counts.video > 0) qualityScore += 0.18;
  if (counts.document > 0) qualityScore += 0.14;
  if (hasBeforeAfterPair) qualityScore += 0.18;
  if (counts.total >= Math.max(1, submittedMilestones.length)) qualityScore += 0.10;
  if (visionReady) qualityScore += 0.12;
  qualityScore = roundScore(clampNumber(qualityScore, 0, 0.98));

  const approveRecommendation = qualityScore >= 0.72 && missingItems.length === 0;
  const result = {
    projectId: loaded.projectId || undefined,
    jobId: loaded.jobId || undefined,
    milestoneId: milestoneContext.milestoneId || undefined,
    qualityScore,
    evidenceCount: counts.total,
    photoCount: counts.photo,
    videoCount: counts.video,
    documentCount: counts.document,
    submittedMilestones: submittedMilestones.length,
    hasBeforeAfterPair,
    visionReady,
    missingItems,
    approveRecommendation,
    feedback: approveRecommendation
      ? "Evidence package is ready for normal review flow."
      : `Complete before approval: ${missingItems.join("; ") || "manual review required"}.`,
  };

  const summary = approveRecommendation
    ? `Evidence-coach aprobó paquete de evidencia (${counts.total} item(s), score ${qualityScore.toFixed(2)}).`
    : `Evidence-coach detectó ${missingItems.length} pendiente(s) en ${counts.total} evidencia(s), score ${qualityScore.toFixed(2)}.`;

  logger.info({ runId: run.id, projectId: loaded.projectId, jobId: loaded.jobId, qualityScore, approveRecommendation }, "evidence-coach handler completed");
  return {
    actionType: "validate",
    summary,
    confidence: qualityScore,
    requiresHumanReview: !approveRecommendation,
    result,
  };
}

function classifyRisk(score) {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

async function handleRisk({ run, requestJson, tenantId, logger }) {
  const context = extractContext(run);
  const loaded = await loadOperationalContext({ context, requestJson, tenantId, logger });
  const eventType = asString(context.eventType) || asString(run.input?.eventType) || "manual";

  const [jobTrustRes, projectTrustRes, disputesRes] = await Promise.all([
    loaded.jobId
      ? safeRequestJson(
          requestJson,
          `/v1/jobs/${encodeURIComponent(loaded.jobId)}/trust`,
          { method: "GET" },
          { tenantId },
          logger,
          "job trust context unavailable"
        )
      : Promise.resolve(null),
    loaded.projectId
      ? safeRequestJson(
          requestJson,
          `/v1/projects/${encodeURIComponent(loaded.projectId)}/trust`,
          { method: "GET" },
          { tenantId },
          logger,
          "project trust context unavailable"
        )
      : Promise.resolve(null),
    loaded.projectId
      ? safeRequestJson(
          requestJson,
          `/v1/disputes?projectId=${encodeURIComponent(loaded.projectId)}`,
          { method: "GET" },
          { tenantId },
          logger,
          "project disputes unavailable"
        )
      : Promise.resolve(null),
  ]);

  const job = loaded.job;
  const trust = asObject(jobTrustRes?.data ?? projectTrustRes?.data);
  const disputes = asArray(disputesRes?.data).map((item) => asObject(item));
  const activeDisputes = disputes.filter((item) => {
    const status = normalizeStatus(item.status);
    return status === "open" || status === "assigned" || status === "under_review";
  });
  const submittedMilestones = loaded.milestones.filter((item) => {
    const status = normalizeStatus(item.statusRaw ?? item.status);
    return status === "submitted" || status === "awaiting_review";
  });

  let riskScore = 0.18;
  const flags = [];
  const scope = asString(job.scope) || asString(loaded.project.scope);
  const budgetMin = asNumber(job.budgetMin);
  const budgetMax = asNumber(job.budgetMax);
  const trustScore = asNumber(trust.score);

  if (eventType === "dispute.opened" || activeDisputes.length > 0) {
    riskScore += 0.30;
    flags.push("active_dispute");
  }
  if (budgetMin === null && budgetMax === null) {
    riskScore += 0.16;
    flags.push("missing_budget_anchor");
  }
  if (scope.length < 80) {
    riskScore += 0.14;
    flags.push("thin_scope_definition");
  }
  if (submittedMilestones.length > 0 && loaded.evidence.length === 0) {
    riskScore += 0.18;
    flags.push("submitted_milestones_without_evidence");
  }
  if (loaded.milestones.length === 0 && loaded.projectId) {
    riskScore += 0.10;
    flags.push("project_without_milestones");
  }
  if (trustScore !== null && trustScore < 60) {
    riskScore += 0.14;
    flags.push("low_trust_score");
  }
  if (normalizeStatus(job.urgency) === "urgent" || normalizeStatus(job.urgency) === "asap") {
    riskScore += 0.08;
    flags.push("urgent_workflow");
  }

  riskScore = roundScore(clampNumber(riskScore, 0, 0.98));
  const riskLevel = classifyRisk(riskScore);
  const confidence = roundScore(clampNumber(0.68 + flags.length * 0.045, 0.68, 0.93));
  const result = {
    projectId: loaded.projectId || undefined,
    jobId: loaded.jobId || undefined,
    eventType,
    riskScore,
    riskLevel,
    flags,
    activeDisputes: activeDisputes.length,
    submittedMilestones: submittedMilestones.length,
    evidenceCount: loaded.evidence.length,
    trustScore,
    recommendation:
      riskLevel === "high"
        ? "Escalate to ops review before advancing workflow or releasing funds."
        : riskLevel === "medium"
          ? "Continue with controls: require evidence, milestone review and tighter monitoring."
          : "Proceed in normal automated flow with standard audit logging.",
  };

  const summary = `Risk clasificó '${loaded.jobId || loaded.projectId}' como ${riskLevel} (score ${riskScore.toFixed(2)}, ${flags.length} flag(s)).`;

  logger.info({ runId: run.id, projectId: loaded.projectId, jobId: loaded.jobId, riskScore, riskLevel }, "risk handler completed");
  return {
    actionType: "classify",
    summary,
    confidence,
    requiresHumanReview: riskLevel === "high",
    result,
  };
}

async function handleProjectCopilot({ run, requestJson, tenantId, logger }) {
  const context = extractContext(run);
  const { projectId, jobId } = await resolveProjectAndJob(context, requestJson, tenantId);

  if (!projectId) {
    throw new Error("Project-copilot delegated execution requires a projectId.");
  }

  const taskTitle = asString(run.input?.taskTitle);
  const prompt = asString(context.prompt)
    || asString(context.message)
    || asString(context.objective)
    || `Ejecuta una iteración autónoma para la tarea delegada: ${taskTitle}`;

  const threadId = asString(context.threadId) || asString(context.sessionId) || undefined;
  const copilotRes = await requestJson("/v1/agents/copilot", {
    method: "POST",
    body: JSON.stringify({
      kind: "chat",
      projectId,
      message: prompt,
      ...(threadId ? { threadId } : {}),
    }),
  }, { tenantId });

  const data = asObject(copilotRes?.data);
  const proposedActions = Array.isArray(data.proposedActions) ? data.proposedActions : [];
  const summaryText = summarizeText(data.message, 240);
  const result = {
    projectId,
    jobId: jobId || undefined,
    threadId: asString(data.threadId) || threadId || undefined,
    message: summaryText,
    proposedActionCount: proposedActions.length,
    proposedPlanId: asString(data.proposedPlan?.id),
    activePlanId: asString(data.activePlan?.id),
    mode: asString(data.mode) || undefined,
    provider: asString(data.provider) || undefined,
    model: asString(data.model) || undefined,
  };

  const summary = `Project-copilot completó una iteración delegada para '${projectId}': ${summaryText || "sin mensaje de salida."}`;

  logger.info({ runId: run.id, projectId, jobId, proposedActions: proposedActions.length }, "project-copilot handler completed");
  return { summary, result };
}

// ── Prometeo: Agente Técnico ────────────────────────────────────────────────

async function handleTechnicalAgent({ run, requestJson, tenantId, logger }) {
  const context = extractContext(run);
  const { projectId, jobId } = await resolveProjectAndJob(context, requestJson, tenantId);

  // Load RAG context from Prometeo for technical docs
  const [docsRes, milestonesRes] = await Promise.all([
    requestJson(`/v1/prometeo/documents?projectId=${encodeURIComponent(projectId)}`, { method: "GET" }, { tenantId }),
    requestJson(`/v1/projects/${encodeURIComponent(projectId)}/milestones`, { method: "GET" }, { tenantId }),
  ]);

  const docs = Array.isArray(docsRes?.data) ? docsRes.data : [];
  const milestones = Array.isArray(milestonesRes?.data) ? milestonesRes.data.map((m) => asObject(m)) : [];

  const indexedDocs = docs.filter((d) => asString(d.status) === "indexed");
  const technicalDocs = indexedDocs.filter((d) => ["manual", "scope", "contract", "text"].includes(asString(d.sourceType)));

  const pendingMilestones = milestones.filter((m) => {
    const s = normalizeStatus(m.statusRaw ?? m.status);
    return s === "submitted" || s === "awaiting_review";
  });

  const hasScope = technicalDocs.some((d) => asString(d.sourceType) === "scope");
  const hasManual = technicalDocs.some((d) => asString(d.sourceType) === "manual");

  const findings = [];
  if (!hasScope) findings.push("No se encontró documento de alcance del trabajo. Riesgo de discrepancia entre expectativas y entrega.");
  if (!hasManual && milestones.length > 0) findings.push("Sin manual técnico indexado. La validación de hitos depende solo de evidencia visual.");
  if (pendingMilestones.length > 0) findings.push(`${pendingMilestones.length} hito(s) pendiente(s) de revisión técnica.`);

  const technicalReadiness = findings.length === 0 ? "adequate" : findings.length <= 1 ? "partial" : "insufficient";

  const result = {
    projectId,
    jobId: jobId || undefined,
    indexedDocuments: indexedDocs.length,
    technicalDocuments: technicalDocs.length,
    hasScope,
    hasManual,
    pendingMilestones: pendingMilestones.length,
    technicalReadiness,
    findings,
    recommendation: technicalReadiness === "adequate"
      ? "Documentación técnica suficiente para proceder con revisión de hitos."
      : `Completar documentación técnica antes de aprobar hitos: ${findings.join("; ")}`,
  };

  const summary = technicalReadiness === "adequate"
    ? `Agente técnico validó '${projectId}': ${indexedDocs.length} docs indexados, documentación suficiente.`
    : `Agente técnico detectó brechas en '${projectId}': ${findings.join("; ")}`;

  logger.info({ runId: run.id, projectId, technicalReadiness }, "technical-agent handler completed");
  return { summary, result };
}

// ── Prometeo: Agente Legal ──────────────────────────────────────────────────

async function handleLegalAgent({ run, requestJson, tenantId, logger }) {
  const context = extractContext(run);
  const { projectId, jobId } = await resolveProjectAndJob(context, requestJson, tenantId);

  const [contractRes, disputesRes, docsRes] = await Promise.all([
    requestJson(`/v1/jobs/${encodeURIComponent(jobId || "")}/contract`, { method: "GET" }, { tenantId }).catch(() => null),
    requestJson(`/v1/projects/${encodeURIComponent(projectId)}/disputes`, { method: "GET" }, { tenantId }).catch(() => ({ data: [] })),
    requestJson(`/v1/prometeo/documents?projectId=${encodeURIComponent(projectId)}`, { method: "GET" }, { tenantId }).catch(() => ({ data: [] })),
  ]);

  const contract = asObject(contractRes?.data);
  const disputes = Array.isArray(disputesRes?.data) ? disputesRes.data : [];
  const docs = Array.isArray(docsRes?.data) ? docsRes.data : [];
  const contractDocs = docs.filter((d) => asString(d.sourceType) === "contract");

  const activeDisputes = disputes.filter((d) => {
    const s = normalizeStatus(d.status);
    return s === "open" || s === "assigned" || s === "under_review";
  });

  const contractSigned = asString(contract.status) === "signed" || asString(contract.signedAt).length > 0;
  const hasContractDoc = contractDocs.length > 0;

  const risks = [];
  if (!contractSigned && !hasContractDoc) risks.push("Sin contrato firmado ni documento contractual indexado. Alta exposición legal.");
  else if (!contractSigned) risks.push("Contrato no firmado formalmente — solo documento indexado disponible.");
  if (activeDisputes.length > 0) risks.push(`${activeDisputes.length} disputa(s) activa(s) con riesgo contractual.`);

  const legalStatus = risks.length === 0 ? "clear" : risks.length === 1 ? "caution" : "at_risk";

  const result = {
    projectId,
    jobId: jobId || undefined,
    contractSigned,
    contractDocumentsIndexed: contractDocs.length,
    activeDisputes: activeDisputes.length,
    legalStatus,
    risks,
    recommendation: legalStatus === "clear"
      ? "Estado legal del proyecto limpio. Proceder con normalidad."
      : `Revisar exposición legal antes de liberar pagos: ${risks.join("; ")}`,
  };

  const summary = legalStatus === "clear"
    ? `Agente legal validó '${projectId}': contrato OK, sin disputas activas.`
    : `Agente legal detecta riesgos en '${projectId}': ${risks.join("; ")}`;

  logger.info({ runId: run.id, projectId, legalStatus }, "legal-agent handler completed");
  return { summary, result };
}

// ── Prometeo: Agente Financiero ─────────────────────────────────────────────

async function handleFinancialAgent({ run, requestJson, tenantId, logger }) {
  const context = extractContext(run);
  const { projectId, jobId } = await resolveProjectAndJob(context, requestJson, tenantId);

  const [escrowRes, milestonesRes, txnsRes] = await Promise.all([
    requestJson(`/v1/projects/${encodeURIComponent(projectId)}/escrow`, { method: "GET" }, { tenantId }).catch(() => null),
    requestJson(`/v1/projects/${encodeURIComponent(projectId)}/milestones`, { method: "GET" }, { tenantId }),
    requestJson(`/v1/projects/${encodeURIComponent(projectId)}/payments`, { method: "GET" }, { tenantId }).catch(() => ({ data: [] })),
  ]);

  const escrow = asObject(escrowRes?.data);
  const milestones = Array.isArray(milestonesRes?.data) ? milestonesRes.data.map((m) => asObject(m)) : [];
  const txns = Array.isArray(txnsRes?.data) ? txnsRes.data : [];

  const totalAmount = asNumber(escrow.totalAmount) ?? 0;
  const funded = asNumber(escrow.funded) ?? asNumber(escrow.escrowFunded) ?? 0;
  const released = asNumber(escrow.released) ?? asNumber(escrow.escrowReleased) ?? 0;
  const holdback = asNumber(escrow.holdbackPct) ?? 0;
  const pendingRelease = Math.max(0, funded - released);

  const approvedMilestones = milestones.filter((m) => normalizeStatus(m.statusRaw ?? m.status) === "approved");
  const approvedValue = approvedMilestones.reduce((sum, m) => sum + (asNumber(m.amount) ?? 0), 0);
  const releasableNow = Math.max(0, approvedValue - released);

  const alerts = [];
  if (pendingRelease > 0 && approvedMilestones.length > 0) alerts.push(`$${releasableNow.toLocaleString()} USD elegibles para release inmediato.`);
  if (holdback > 0) alerts.push(`Holdback del ${holdback}% activo — retención de $${Math.round(funded * holdback / 100).toLocaleString()} USD.`);
  if (funded < totalAmount * 0.5) alerts.push("Escrow fondeado por debajo del 50% del contrato.");

  const result = {
    projectId,
    jobId: jobId || undefined,
    totalAmount,
    funded,
    released,
    pendingRelease,
    holdbackPct: holdback,
    approvedMilestones: approvedMilestones.length,
    approvedValue,
    releasableNow,
    transactionCount: txns.length,
    alerts,
    financialHealth: alerts.length === 0 ? "healthy" : alerts.length === 1 ? "attention" : "critical",
  };

  const summary = releasableNow > 0
    ? `Agente financiero: $${releasableNow.toLocaleString()} USD elegibles para release en '${projectId}'. ${alerts.join("; ")}`
    : `Agente financiero validó '${projectId}': escrow $${released.toLocaleString()}/${funded.toLocaleString()} USD liberado.`;

  logger.info({ runId: run.id, projectId, releasableNow }, "financial-agent handler completed");
  return { summary, result };
}

// ── Prometeo: Agente de Seguridad / QA ─────────────────────────────────────

async function handleQaAgent({ run, requestJson, tenantId, logger }) {
  const context = extractContext(run);
  const { projectId, jobId } = await resolveProjectAndJob(context, requestJson, tenantId);

  const [evidenceRes, milestonesRes] = await Promise.all([
    requestJson(`/v1/projects/${encodeURIComponent(projectId)}/evidence`, { method: "GET" }, { tenantId }),
    requestJson(`/v1/projects/${encodeURIComponent(projectId)}/milestones`, { method: "GET" }, { tenantId }),
  ]);

  const evidence = Array.isArray(evidenceRes?.data) ? evidenceRes.data.map((e) => asObject(e)) : [];
  const milestones = Array.isArray(milestonesRes?.data) ? milestonesRes.data.map((m) => asObject(m)) : [];

  const photoEvidence = evidence.filter((e) => normalizeStatus(e.kind) === "photo" || normalizeStatus(e.kind) === "video");
  const docCount = evidence.filter((e) => normalizeStatus(e.kind) === "document").length;

  const submittedMilestones = milestones.filter((m) => {
    const s = normalizeStatus(m.statusRaw ?? m.status);
    return s === "submitted" || s === "awaiting_review";
  });

  const qaIssues = [];
  let duplicateCount = 0;
  let lowQualityCount = 0;
  let processedCount = 0;
  const analyzedEvidenceIds = [];

  // Batch-analyze all photo evidence — one call per 20 items instead of N sequential calls
  if (photoEvidence.length > 0) {
    const BATCH_SIZE = 20;
    const allEvidenceIds = photoEvidence.map((e) => asString(e.id));
    for (let i = 0; i < allEvidenceIds.length; i += BATCH_SIZE) {
      const chunk = allEvidenceIds.slice(i, i + BATCH_SIZE);
      try {
        const batchRes = await requestJson(
          "/v1/vision/batch-by-ids",
          { method: "POST", body: JSON.stringify({ evidenceIds: chunk, jobId }) },
          { tenantId }
        );
        const batchData = asObject(batchRes?.data);
        const results = Array.isArray(batchData?.results) ? batchData.results : [];
        for (const r of results) {
          if (r.status === "completed" && r.result) {
            processedCount += 1;
            analyzedEvidenceIds.push(asString(r.evidenceId));
            if (asNumber(r.result?.duplicate?.duplicateRisk) >= 0.85) duplicateCount += 1;
            if (!r.result?.governance?.canAutoApprove || asNumber(r.result?.quality?.qualityScore) < 0.60) lowQualityCount += 1;
          }
        }
      } catch (err) {
        logger.warn({ chunkStart: i, error: err.message }, "Batch vision analysis failed — falling back to individual calls");
        // Fallback: analyze each item individually so QA is never completely blind
        for (const evidenceId of chunk) {
          try {
            const visionRes = await requestJson(
              `/v1/vision/analyze-by-evidence/${encodeURIComponent(evidenceId)}`,
              { method: "POST" },
              { tenantId }
            );
            const analysis = asObject(visionRes?.data);
            if (analysis && (analysis.status === "completed" || analysis.status === "success")) {
              processedCount += 1;
              analyzedEvidenceIds.push(evidenceId);
              if (asNumber(analysis.duplicateRisk) >= 0.85) duplicateCount += 1;
              if (!analysis.canAutoApprove || asNumber(analysis.qualityScore) < 0.60) lowQualityCount += 1;
            }
          } catch (fallbackErr) {
            logger.warn({ evidenceId, error: fallbackErr.message }, "Fallback vision analysis also failed");
          }
        }
      }
    }
  }

  // Multi-image location consistency check — flags outlier images from different locations
  let consistencyScore = 1;
  let outlierCount = 0;
  if (analyzedEvidenceIds.length >= 2) {
    try {
      const consistencyRes = await requestJson(
        "/v1/vision/consistency-by-ids",
        { method: "POST", body: JSON.stringify({ evidenceIds: analyzedEvidenceIds }) },
        { tenantId }
      );
      const consistency = asObject(consistencyRes?.data);
      consistencyScore = asNumber(consistency?.consistencyScore ?? 1);
      outlierCount = Array.isArray(consistency?.outlierIndices) ? consistency.outlierIndices.length : 0;
    } catch (err) {
      logger.warn({ error: err.message }, "Failed to run location consistency check");
    }
  }

  if (photoEvidence.length === 0) {
    qaIssues.push("Sin fotos o videos de trabajo. Imposible validar ejecución visual.");
  }
  if (submittedMilestones.length > 0 && evidence.length < submittedMilestones.length) {
    qaIssues.push(`${submittedMilestones.length} hito(s) enviados con ${evidence.length} evidencia(s) total — ratio bajo.`);
  }
  if (duplicateCount > 0) {
    qaIssues.push(`Alerta de fraude: ${duplicateCount} imagen(es) sospechosa(s) de duplicidad.`);
  }
  if (lowQualityCount > 0) {
    qaIssues.push(`Calidad deficiente: ${lowQualityCount} imagen(es) borrosa(s) o mal iluminadas.`);
  }
  if (outlierCount > 0) {
    qaIssues.push(`Inconsistencia de ubicación: ${outlierCount} imagen(es) no corresponden al mismo lugar de trabajo.`);
  }

  // Calculate base score
  let qaScore = evidence.length === 0 ? 0 : Math.min(100, Math.round((photoEvidence.length * 40 + docCount * 25) / Math.max(1, milestones.length)));

  // Apply visual criteria penalties
  if (duplicateCount > 0) {
    qaScore = 0; // Fraud resets quality score to zero
  } else if (lowQualityCount > 0) {
    qaScore = Math.max(10, qaScore - (lowQualityCount * 15)); // Penalize 15 points per bad image
  } else if (outlierCount > 0) {
    qaScore = Math.max(10, qaScore - (outlierCount * 20)); // Penalize 20 points per location outlier
  }

  // Vision-gated milestone auto-approval — only when no fraud detected
  const autoApprovedMilestones = [];
  if (duplicateCount === 0 && submittedMilestones.length > 0) {
    for (const milestone of submittedMilestones) {
      const milestoneId = asString(milestone.id);
      if (!milestoneId) continue;
      try {
        const summaryRes = await requestJson(
          `/v1/milestones/${encodeURIComponent(milestoneId)}/vision-summary`,
          { method: "GET" },
          { tenantId }
        );
        const visionSummary = asObject(summaryRes?.data);
        if (visionSummary?.overallVisionReady === true) {
          await requestJson(
            `/v1/milestones/${encodeURIComponent(milestoneId)}/approve`,
            { method: "POST" },
            { tenantId }
          );
          autoApprovedMilestones.push(milestoneId);
          logger.info({ milestoneId, qaScore }, "Milestone auto-approved via Vision AI gate");
        }
      } catch (err) {
        logger.warn({ milestoneId, error: err.message }, "Failed to auto-approve milestone");
      }
    }
  }

  const result = {
    projectId,
    evidenceTotal: evidence.length,
    photoCount: photoEvidence.length,
    docCount,
    submittedMilestones: submittedMilestones.length,
    visionProcessedCount: processedCount,
    visionDuplicatesCount: duplicateCount,
    visionLowQualityCount: lowQualityCount,
    visionConsistencyScore: consistencyScore,
    visionOutlierCount: outlierCount,
    qaScore,
    qaStatus: qaScore >= 70 ? "pass" : qaScore >= 40 ? "partial" : "fail",
    qaIssues,
    autoApprovedMilestones,
    recommendation: autoApprovedMilestones.length > 0
      ? `${autoApprovedMilestones.length} hito(s) aprobado(s) automáticamente por Vision AI.`
      : qaScore >= 70
        ? "Calidad de evidencia suficiente para revisión de hitos."
        : `Solicitar evidencia adicional antes de aprobar: ${qaIssues.join("; ")}`,
  };

  const autoApproveNote = autoApprovedMilestones.length > 0
    ? ` ${autoApprovedMilestones.length} hito(s) auto-aprobado(s).`
    : "";
  const summary = `QA Agent evaluó '${projectId}': score=${qaScore}/100 (${evidence.length} evidencias, ${processedCount} procesadas por Vision, ${qaIssues.length} issues).${autoApproveNote}`;
  logger.info({ runId: run.id, projectId, qaScore, autoApprovedCount: autoApprovedMilestones.length }, "qa-agent handler completed");
  return { summary, result };
}

async function handleForge({ run, requestJson, logger, tenantId }) {
  const input = asObject(run?.input);
  const task = asObject(input.task);
  const forgeRunId = asString(input.forgeRunId);
  const taskId = asString(input.taskId);
  const action = asString(input.action) || asString(task?.allowedCommands?.[0]) || "runtime.execute";

  const result = executeGovernedAgentRun({
    agentType: "forge",
    runId: run.id,
    correlationId: run.correlationId,
    payload: input,
    environment: "worker"
  });

  if (forgeRunId && taskId) {
    try {
      await requestJson(
        `/v1/forge/runs/${encodeURIComponent(forgeRunId)}/tasks/${encodeURIComponent(taskId)}/complete`,
        {
          method: "POST",
          body: JSON.stringify({ agentRunId: run.id, result })
        },
        { tenantId }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn({ runId: run.id, forgeRunId, taskId, error: message }, "forge task completion callback failed");
    }
  }

  return {
    summary: result.summary,
    result: result.payload ?? {},
    actionType: result.actionType,
    confidence: result.confidence,
    requiresHumanReview: result.requiresHumanReview
  };
}

const SPECIALIZED_HANDLERS = {
  "field-ops":       handleFieldOps,
  "trust-match":     handleTrustMatch,
  pricing:           handlePricing,
  "job-planner":     handleJobPlanner,
  "evidence-coach":  handleEvidenceCoach,
  risk:              handleRisk,
  "project-copilot": handleProjectCopilot,
  "technical-agent": handleTechnicalAgent,
  "legal-agent":     handleLegalAgent,
  "financial-agent": handleFinancialAgent,
  "qa-agent":        handleQaAgent,
  "browser-agent":   handleBrowserAgent,
  forge:             handleForge,
};

export function shouldUseSpecializedWorkerHandler(agentType) {
  return Object.prototype.hasOwnProperty.call(SPECIALIZED_HANDLERS, agentType);
}

export async function executeSpecializedWorkerRun(input) {
  const handler = SPECIALIZED_HANDLERS[input.run.agentType];
  if (!handler) {
    throw new Error(`No specialized worker handler registered for '${input.run.agentType}'.`);
  }

  return handler(input);
}
