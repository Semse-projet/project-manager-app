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
  return asObject(run?.input?.context);
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

  // Process each evidence through OpenCV using our Vision Service
  for (const item of photoEvidence) {
    try {
      const evidenceId = asString(item.id);
      // Try GET first
      let visionRes = await requestJson(`/v1/vision/evidence/${encodeURIComponent(evidenceId)}`, { method: "GET" }, { allow404: true, tenantId });
      
      // If 404, trigger analysis
      if (!visionRes || !visionRes.data) {
        visionRes = await requestJson(`/v1/vision/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evidenceId,
            imageUrl: `mock://evidence/${evidenceId}`,
            jobId: jobId || undefined,
            milestoneId: item.milestoneId || undefined
          })
        }, { tenantId });
      }

      const analysis = asObject(visionRes?.data);
      if (analysis && (analysis.status === "completed" || analysis.status === "success")) {
        processedCount += 1;
        if (asNumber(analysis.duplicateRisk) >= 0.85) {
          duplicateCount += 1;
        }
        if (!analysis.canAutoApprove || asNumber(analysis.qualityScore) < 0.60) {
          lowQualityCount += 1;
        }
      }
    } catch (err) {
      logger.warn({ evidenceId: item.id, error: err.message }, "Failed to process vision analysis for evidence item");
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

  // Calculate base score
  let qaScore = evidence.length === 0 ? 0 : Math.min(100, Math.round((photoEvidence.length * 40 + docCount * 25) / Math.max(1, milestones.length)));

  // Apply visual criteria penalties
  if (duplicateCount > 0) {
    qaScore = 0; // Fraud resets quality score to zero
  } else if (lowQualityCount > 0) {
    qaScore = Math.max(10, qaScore - (lowQualityCount * 15)); // Penalize 15 points per bad image
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
    qaScore,
    qaStatus: qaScore >= 70 ? "pass" : qaScore >= 40 ? "partial" : "fail",
    qaIssues,
    recommendation: qaScore >= 70
      ? "Calidad de evidencia suficiente para revisión de hitos."
      : `Solicitar evidencia adicional antes de aprobar: ${qaIssues.join("; ")}`,
  };

  const summary = `QA Agent evaluó '${projectId}': score=${qaScore}/100 (${evidence.length} evidencias, ${processedCount} procesadas por Vision, ${qaIssues.length} issues).`;
  logger.info({ runId: run.id, projectId, qaScore }, "qa-agent handler completed");
  return { summary, result };
}

const SPECIALIZED_HANDLERS = {
  "field-ops":       handleFieldOps,
  "trust-match":     handleTrustMatch,
  pricing:           handlePricing,
  "project-copilot": handleProjectCopilot,
  "technical-agent": handleTechnicalAgent,
  "legal-agent":     handleLegalAgent,
  "financial-agent": handleFinancialAgent,
  "qa-agent":        handleQaAgent,
  "browser-agent":   handleBrowserAgent,
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
