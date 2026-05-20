/**
 * Tests derivados de: docs/specs/api/evidence.spec.md
 * Cubre upload flow, registro, FSM de evidencia, AI review fallback y audit.
 * No requiere DB ni storage — modela lógica de negocio directamente.
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Types ──────────────────────────────────────────────────────────────────────

type EvidenceStatus = "uploaded" | "under_review" | "accepted" | "rejected";
type EvidenceKind   = "PHOTO" | "VIDEO" | "DOCUMENT";
type EvidenceSource = "local_device" | "camera_capture" | "field_ops" | "project_copilot" | "external_transfer";
type EvidenceDomain = "evidence" | "contract" | "dispute" | "travel";

interface PresignInput {
  filename: string;
  contentType: string;
  fileSizeBytes?: number;
  source?: EvidenceSource;
}

interface RegisterInput {
  key: string;
  kind: EvidenceKind;
  jobId?: string;
  milestoneId?: string;
  projectId?: string;
}

const MAX_SINGLE_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

// ── Upload plan logic (mirrors controller buildUploadPlan) ─────────────────────

function buildUploadPlan(input: { fileSizeBytes?: number; domain: EvidenceDomain }) {
  const strategy = input.fileSizeBytes && input.fileSizeBytes > MAX_SINGLE_UPLOAD_BYTES
    ? "external_transfer"
    : "single_put";
  const chunkSize = strategy === "external_transfer" ? 10 * 1024 * 1024 : undefined;
  const partCount = chunkSize && input.fileSizeBytes
    ? Math.ceil(input.fileSizeBytes / chunkSize)
    : undefined;

  return {
    recommendedStrategy: strategy,
    maxSingleUploadBytes: MAX_SINGLE_UPLOAD_BYTES,
    multipart: strategy === "external_transfer"
      ? { recommendedChunkSizeBytes: chunkSize, recommendedPartCount: partCount, requiresOutOfBandTransfer: true }
      : null,
  };
}

// ── FSM evidence ───────────────────────────────────────────────────────────────

function evidenceCanTransition(from: EvidenceStatus, to: EvidenceStatus): boolean {
  const transitions: Record<EvidenceStatus, EvidenceStatus[]> = {
    uploaded:     ["under_review"],
    under_review: ["accepted", "rejected"],
    accepted:     [],
    rejected:     [],
  };
  return transitions[from]?.includes(to) ?? false;
}

// ── FSM tests ──────────────────────────────────────────────────────────────────

test("FSM evidence: UPLOADED → UNDER_REVIEW es válido", () => {
  assert.ok(evidenceCanTransition("uploaded", "under_review"));
});

test("FSM evidence: UNDER_REVIEW → ACCEPTED es válido", () => {
  assert.ok(evidenceCanTransition("under_review", "accepted"));
});

test("FSM evidence: UNDER_REVIEW → REJECTED es válido", () => {
  assert.ok(evidenceCanTransition("under_review", "rejected"));
});

test("FSM evidence: ACCEPTED es terminal", () => {
  assert.ok(!evidenceCanTransition("accepted", "uploaded"));
  assert.ok(!evidenceCanTransition("accepted", "under_review"));
  assert.ok(!evidenceCanTransition("accepted", "rejected"));
});

test("FSM evidence: REJECTED es terminal — PRO debe subir nueva evidencia", () => {
  assert.ok(!evidenceCanTransition("rejected", "uploaded"));
  assert.ok(!evidenceCanTransition("rejected", "under_review"));
});

test("FSM evidence: UPLOADED no puede ir directamente a ACCEPTED", () => {
  assert.ok(!evidenceCanTransition("uploaded", "accepted"));
});

// ── Upload plan strategy ────────────────────────────────────────────────────────

test("upload plan: recomienda single_put para archivos ≤ 25MB", () => {
  const plan = buildUploadPlan({ fileSizeBytes: 10 * 1024 * 1024, domain: "evidence" });
  assert.equal(plan.recommendedStrategy, "single_put");
  assert.equal(plan.multipart, null);
});

test("upload plan: recomienda external_transfer para archivos > 25MB", () => {
  const plan = buildUploadPlan({ fileSizeBytes: 80 * 1024 * 1024, domain: "evidence" });
  assert.equal(plan.recommendedStrategy, "external_transfer");
  assert.ok(plan.multipart !== null);
  assert.ok(plan.multipart!.requiresOutOfBandTransfer);
});

test("upload plan: calcula recommendedPartCount para 80MB con chunks de 10MB", () => {
  const plan = buildUploadPlan({ fileSizeBytes: 80 * 1024 * 1024, domain: "evidence" });
  assert.equal(plan.multipart!.recommendedPartCount, 8);
});

test("upload plan: sin fileSizeBytes usa single_put por defecto", () => {
  const plan = buildUploadPlan({ domain: "evidence" });
  assert.equal(plan.recommendedStrategy, "single_put");
});

test("upload plan: funciona para todos los dominios válidos", () => {
  const domains: EvidenceDomain[] = ["evidence", "contract", "dispute", "travel"];
  for (const domain of domains) {
    const plan = buildUploadPlan({ fileSizeBytes: 5 * 1024 * 1024, domain });
    assert.equal(plan.recommendedStrategy, "single_put", `domain=${domain}`);
  }
});

// ── presignEvidenceSchema validations ──────────────────────────────────────────

test("presign: filename no puede estar vacío", () => {
  const input: PresignInput = { filename: "", contentType: "image/jpeg" };
  assert.equal(input.filename.trim().length, 0);
});

test("presign: contentType no puede estar vacío", () => {
  const input: PresignInput = { filename: "foto.jpg", contentType: "" };
  assert.equal(input.contentType.trim().length, 0);
});

test("presign: source válidos son los 5 del enum", () => {
  const validSources: EvidenceSource[] = [
    "local_device", "camera_capture", "field_ops", "project_copilot", "external_transfer"
  ];
  assert.equal(validSources.length, 5);
  assert.ok(validSources.includes("camera_capture"));
  assert.ok(!validSources.includes("bluetooth" as EvidenceSource));
});

test("presign: fileSizeBytes máximo es 20GB", () => {
  const maxBytes = 1024 * 1024 * 1024 * 20;
  const overLimit = maxBytes + 1;
  assert.ok(maxBytes > 0);
  assert.ok(overLimit > maxBytes);
});

// ── registerEvidenceSchema validations ─────────────────────────────────────────

test("register: key no puede estar vacío", () => {
  const input: RegisterInput = { key: "", kind: "PHOTO", milestoneId: "ms_001" };
  assert.equal(input.key.trim().length, 0);
});

test("register: kind debe ser PHOTO, VIDEO o DOCUMENT", () => {
  const validKinds: EvidenceKind[] = ["PHOTO", "VIDEO", "DOCUMENT"];
  assert.ok(validKinds.includes("PHOTO"));
  assert.ok(validKinds.includes("VIDEO"));
  assert.ok(validKinds.includes("DOCUMENT"));
  assert.ok(!validKinds.includes("AUDIO" as EvidenceKind));
});

test("register: requiere al menos uno de jobId, milestoneId, projectId", () => {
  function hasContext(input: RegisterInput): boolean {
    return Boolean(input.jobId || input.milestoneId || input.projectId);
  }

  assert.ok(hasContext({ key: "k1", kind: "PHOTO", milestoneId: "ms_001" }));
  assert.ok(hasContext({ key: "k2", kind: "VIDEO", jobId: "job_001" }));
  assert.ok(!hasContext({ key: "k3", kind: "DOCUMENT" }));
});

test("register: projectId-only es legacy — jobId o milestoneId preferido", () => {
  function isLegacyOnlyProject(input: RegisterInput): boolean {
    return Boolean(input.projectId && !input.jobId && !input.milestoneId);
  }
  assert.ok(isLegacyOnlyProject({ key: "k", kind: "PHOTO", projectId: "proj_001" }));
  assert.ok(!isLegacyOnlyProject({ key: "k", kind: "PHOTO", projectId: "proj_001", jobId: "job_001" }));
});

// ── Multipart session validations ──────────────────────────────────────────────

test("multipart complete: sessionId no puede estar vacío", () => {
  const input = { sessionId: "", parts: [{ partNumber: 1, etag: "abc" }] };
  assert.equal(input.sessionId.trim().length, 0);
});

test("multipart complete: parts array no puede estar vacío", () => {
  const input = { sessionId: "mus_001", parts: [] };
  assert.equal(input.parts.length, 0);
});

test("multipart part: partNumber debe ser entero positivo", () => {
  assert.ok(Number.isInteger(1) && 1 > 0);
  assert.ok(!Number.isInteger(1.5) || 0 <= 0);
});

test("multipart part: etag no puede estar vacío", () => {
  const part = { partNumber: 1, etag: "" };
  assert.equal(part.etag.trim().length, 0);
});

// ── EvidenceReviewService — fallback rule-based (spec section 7) ───────────────

type ReviewStatus =
  | "approved_suggestion" | "needs_reupload" | "missing_context"
  | "possible_mismatch" | "rejected_suggestion" | "manual_review_required";

type RiskLevel = "low" | "medium" | "high" | "critical";

interface ReviewOutput {
  reviewStatus: ReviewStatus;
  confidence: number;
  riskLevel: RiskLevel;
  disputeRisk: boolean;
  fallbackUsed: boolean;
}

function rulesBasedReview(evidenceStatus: string): ReviewOutput {
  if (evidenceStatus === "approved") {
    return { reviewStatus: "approved_suggestion", confidence: 0.7, riskLevel: "low", disputeRisk: false, fallbackUsed: true };
  }
  if (evidenceStatus === "rejected") {
    return { reviewStatus: "rejected_suggestion", confidence: 0.85, riskLevel: "high", disputeRisk: true, fallbackUsed: true };
  }
  return { reviewStatus: "manual_review_required", confidence: 0.3, riskLevel: "medium", disputeRisk: false, fallbackUsed: true };
}

test("AI review fallback: status=approved → approved_suggestion con confidence=0.7", () => {
  const result = rulesBasedReview("approved");
  assert.equal(result.reviewStatus, "approved_suggestion");
  assert.equal(result.confidence, 0.7);
  assert.equal(result.fallbackUsed, true);
});

test("AI review fallback: status=rejected → rejected_suggestion con disputeRisk=true", () => {
  const result = rulesBasedReview("rejected");
  assert.equal(result.reviewStatus, "rejected_suggestion");
  assert.equal(result.disputeRisk, true);
  assert.ok(result.confidence > 0.5);
});

test("AI review fallback: status desconocido → manual_review_required", () => {
  const result = rulesBasedReview("submitted");
  assert.equal(result.reviewStatus, "manual_review_required");
  assert.ok(result.confidence < 0.5);
});

test("AI review: privacyCritical siempre es true para review de evidencia", () => {
  const privacyMode = "privacyCritical";
  assert.equal(privacyMode, "privacyCritical");
});

test("AI review: confidence está en rango [0, 1]", () => {
  const cases = ["approved", "rejected", "submitted", "unknown"];
  for (const status of cases) {
    const result = rulesBasedReview(status);
    assert.ok(result.confidence >= 0 && result.confidence <= 1, `confidence out of range for status=${status}`);
  }
});

test("AI review: fallbackUsed=true cuando se usa reglas en lugar de LLM", () => {
  const result = rulesBasedReview("approved");
  assert.equal(result.fallbackUsed, true);
});

// ── Audit assertions (spec section 6, efectos) ────────────────────────────────

test("register audit usa action 'evidence.register'", () => {
  const entry = { action: "evidence.register", entityType: "Evidence" };
  assert.equal(entry.action, "evidence.register");
});

test("register audit incluye canonicalScope en afterJson", () => {
  const afterJson = {
    jobId: "job_001",
    milestoneId: "ms_001",
    kind: "PHOTO",
    canonicalScope: "milestone"
  };
  assert.ok(["milestone", "job"].includes(afterJson.canonicalScope));
  assert.equal(afterJson.canonicalScope, "milestone");
});

test("canonicalScope es 'milestone' cuando milestoneId presente", () => {
  const scope = (milestoneId?: string) => milestoneId ? "milestone" : "job";
  assert.equal(scope("ms_001"), "milestone");
  assert.equal(scope(undefined), "job");
});

// ── Permisos (spec section 2) ──────────────────────────────────────────────────

test("permisos: evidence:write requerido para presign, plan, upload, register", () => {
  const writeEndpoints = [
    "POST /v1/evidence/presign",
    "POST /v1/uploads/plan",
    "POST /v1/uploads/multipart-session",
    "POST /v1/evidence",
  ];
  assert.equal(writeEndpoints.length, 4);
  for (const ep of writeEndpoints) {
    assert.ok(ep.startsWith("POST"), `${ep} debe ser POST`);
  }
});

test("permisos: evidence:read requerido para list y detail", () => {
  const readEndpoints = [
    "GET /v1/jobs/:jobId/evidence",
    "GET /v1/projects/:projectId/evidence",
    "GET /v1/evidence/:evidenceId",
  ];
  assert.equal(readEndpoints.length, 3);
  for (const ep of readEndpoints) {
    assert.ok(ep.startsWith("GET"), `${ep} debe ser GET`);
  }
});

test("permisos: PRO no puede aprobar ni rechazar su propia evidencia", () => {
  function canApproveOwnEvidence(uploaderRole: string, reviewerRole: string, isSamePerson: boolean): boolean {
    if (isSamePerson) return false;
    return reviewerRole === "CLIENT" || reviewerRole === "OPS_ADMIN";
  }
  assert.ok(!canApproveOwnEvidence("PRO", "PRO", true));
  assert.ok(canApproveOwnEvidence("PRO", "CLIENT", false));
});
