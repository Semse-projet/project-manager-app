"use client";

import type {
  AgentRuntimeList,
  AgentRuntimeTrace,
  ControlSurfaceSnapshot,
  CortexSnapshot,
  DeveloperRuntimeCreateMissionInput,
  DeveloperRuntimeCreateSessionInput,
  DeveloperRuntimeApprovalRecord,
  DeveloperRuntimeApprovalResponseInput,
  DeveloperRuntimeArtifact,
  DeveloperRuntimeMission,
  DeveloperRuntimeSession,
  DeveloperRuntimeSessionLog,
  DeveloperRuntimeTaskCategory,
  DeveloperRuntimeValidationResult,
  SemseEvent,
  DomainEventListView,
  DomainEventTraceView,
  OpsMutationResult,
  CreateRuntimeJobInput,
  JobRecordView,
  TrackerBootstrapView,
  TrackerSessionView,
  TrackerSummaryView,
  TrackerSnapshotView,
  AutonomyLlmStatusView,
  AutonomyRunListView,
  AutonomyRunView,
  PrometeoAttachment,
  PrometeoCitation,
  PrometeoEntityReference,
  PrometeoMissionCheckpointInput,
  PrometeoMissionCreateInput,
  PrometeoMissionState,
  PrometeoPageContext,
  PrometeoProposedAction,
  PrometeoRequest,
  PrometeoResponseBlock,
  PrometeoToolDescriptor,
  PrometeoToolExecutionResult,
  PrometeoToolInvokeInput
} from "@semse/schemas";
import {
  buildStoredPrometeoAttachment,
  getPrometeoUploadContentType,
} from "../components/ai/prometeo-attachments";

export type {
  AgentRuntimeList,
  AgentRuntimeTrace,
  ControlSurfaceSnapshot,
  CortexSnapshot,
  DeveloperRuntimeCreateMissionInput,
  DeveloperRuntimeCreateSessionInput,
  DeveloperRuntimeApprovalRecord,
  DeveloperRuntimeApprovalResponseInput,
  DeveloperRuntimeArtifact,
  DeveloperRuntimeMission,
  DeveloperRuntimeSession,
  DeveloperRuntimeSessionLog,
  DeveloperRuntimeTaskCategory,
  DeveloperRuntimeValidationResult,
  SemseEvent,
  DomainEventListView,
  DomainEventTraceView,
  OpsMutationResult,
  CreateRuntimeJobInput,
  JobRecordView,
  TrackerBootstrapView,
  TrackerSessionView,
  TrackerSummaryView,
  TrackerSnapshotView,
  AutonomyLlmStatusView,
  AutonomyRunListView,
  AutonomyRunView,
  PrometeoAttachment,
  PrometeoCitation,
  PrometeoEntityReference,
  PrometeoMissionCheckpointInput,
  PrometeoMissionCreateInput,
  PrometeoMissionState,
  PrometeoPageContext,
  PrometeoProposedAction,
  PrometeoRequest,
  PrometeoResponseBlock,
  PrometeoToolDescriptor,
  PrometeoToolExecutionResult,
  PrometeoToolInvokeInput
} from "@semse/schemas";

export type ApiEnvelope<T> = {
  requestId: string;
  data: T;
};

export type DeveloperRuntimeCatalog = {
  autonomyLevels: string[];
  events: string[];
  commandTemplates: Record<string, string>;
  commandTemplatePolicies: Record<string, { allowArgs: boolean; maxArgs: number; notes: string }>;
  agents: Array<{
    role: string;
    description: string;
    responsibilities: string[];
    allowedTools: string[];
    maxAutonomyLevel: string;
    defaultRiskLevel: string;
  }>;
};

export type DeveloperRuntimeSessionDetail = {
  approvals: DeveloperRuntimeApprovalRecord[];
  artifacts: DeveloperRuntimeArtifact[];
  session: DeveloperRuntimeSession;
  mission: DeveloperRuntimeMission | null;
  logs: DeveloperRuntimeSessionLog[];
  validations: DeveloperRuntimeValidationResult[];
};

export class SemseApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    message?: string
  ) {
    super(message ?? `SEMSE API ${path} returned ${status}`);
  }
}

export function normalizeErrorMessage(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => normalizeErrorMessage(item))
      .filter((item): item is string => Boolean(item));
    return normalized.length > 0 ? normalized.join(" ") : undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      normalizeErrorMessage(record.message) ??
      normalizeErrorMessage(record.error) ??
      normalizeErrorMessage(record.detail) ??
      normalizeErrorMessage(record.details)
    );
  }

  return undefined;
}

async function readErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const payload = (await response.json()) as {
      error?: unknown;
      message?: unknown;
    };

    return normalizeErrorMessage(payload.error) ?? normalizeErrorMessage(payload.message);
  } catch {
    return undefined;
  }
}

async function fetchSemse<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new SemseApiError(response.status, path, message);
  }

  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
}

async function mutateSemse<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  return fetchSemse<T>(path, {
    method: "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
}

async function patchSemse<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  return fetchSemse<T>(path, {
    method: "PATCH",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
}

export function semseRuntimeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED?.trim() === "true";
}

export async function fetchControlSurfaceSnapshot(): Promise<ControlSurfaceSnapshot | null> {
  if (!semseRuntimeEnabled()) {
    return null;
  }

  return fetchSemse<ControlSurfaceSnapshot>("/api/semse/control-surface");
}

export async function fetchCortexSnapshot(): Promise<CortexSnapshot | null> {
  if (!semseRuntimeEnabled()) {
    return null;
  }

  return fetchSemse<CortexSnapshot>("/api/semse/cortex");
}

export async function fetchCortexRuntimeTrace(correlationId: string): Promise<AgentRuntimeTrace> {
  return fetchSemse<AgentRuntimeTrace>(`/api/semse/cortex/runtime/${encodeURIComponent(correlationId)}`);
}

export async function fetchOpsAgentRuntime(input?: {
  eventType?: string;
  status?: string;
  agentType?: string;
  triggerType?: string;
  correlationId?: string;
  workspaceId?: string;
  operatorId?: string;
  memoryTag?: string;
  limit?: number;
}): Promise<AgentRuntimeList> {
  const search = new URLSearchParams();

  if (input?.eventType) search.set("eventType", input.eventType);
  if (input?.status) search.set("status", input.status);
  if (input?.agentType) search.set("agentType", input.agentType);
  if (input?.triggerType) search.set("triggerType", input.triggerType);
  if (input?.correlationId) search.set("correlationId", input.correlationId);
  if (input?.workspaceId) search.set("workspaceId", input.workspaceId);
  if (input?.operatorId) search.set("operatorId", input.operatorId);
  if (input?.memoryTag) search.set("memoryTag", input.memoryTag);
  if (input?.limit) search.set("limit", String(input.limit));

  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return fetchSemse<AgentRuntimeList>(`/api/semse/ops/agent-runtime${suffix}`);
}

export async function fetchOpsAgentRuntimeTrace(correlationId: string): Promise<AgentRuntimeTrace> {
  return fetchSemse<AgentRuntimeTrace>(`/api/semse/ops/agent-runtime/${encodeURIComponent(correlationId)}`);
}

export async function fetchDeveloperRuntimeCatalog(): Promise<DeveloperRuntimeCatalog> {
  return fetchSemse<DeveloperRuntimeCatalog>("/api/semse/developer-runtime/catalog");
}

export async function fetchDeveloperRuntimeSessions(input?: {
  repoId?: string;
  state?: string;
}): Promise<DeveloperRuntimeSession[]> {
  const search = new URLSearchParams();
  if (input?.repoId) search.set("repoId", input.repoId);
  if (input?.state) search.set("state", input.state);
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return fetchSemse<DeveloperRuntimeSession[]>(`/api/semse/developer-runtime/sessions${suffix}`);
}

export async function createDeveloperRuntimeSession(
  input: DeveloperRuntimeCreateSessionInput,
): Promise<DeveloperRuntimeSession> {
  return mutateSemse<DeveloperRuntimeSession>("/api/semse/developer-runtime/sessions", input as Record<string, unknown>);
}

export async function fetchDeveloperRuntimeSession(
  sessionId: string,
): Promise<DeveloperRuntimeSessionDetail> {
  return fetchSemse<DeveloperRuntimeSessionDetail>(
    `/api/semse/developer-runtime/sessions/${encodeURIComponent(sessionId)}`,
  );
}

export async function createDeveloperRuntimeMission(
  sessionId: string,
  input: DeveloperRuntimeCreateMissionInput,
): Promise<DeveloperRuntimeMission> {
  return mutateSemse<DeveloperRuntimeMission>(
    `/api/semse/developer-runtime/sessions/${encodeURIComponent(sessionId)}/missions`,
    input as unknown as Record<string, unknown>,
  );
}

export async function executeDeveloperRuntimeSession(
  sessionId: string,
  input?: { cwd?: string },
): Promise<DeveloperRuntimeSessionDetail> {
  return mutateSemse<DeveloperRuntimeSessionDetail>(
    `/api/semse/developer-runtime/sessions/${encodeURIComponent(sessionId)}/execute`,
    (input ?? {}) as Record<string, unknown>,
  );
}

export async function respondDeveloperRuntimeApproval(
  sessionId: string,
  approvalId: string,
  input: DeveloperRuntimeApprovalResponseInput,
): Promise<DeveloperRuntimeSessionDetail> {
  return mutateSemse<DeveloperRuntimeSessionDetail>(
    `/api/semse/developer-runtime/sessions/${encodeURIComponent(sessionId)}/approvals/${encodeURIComponent(approvalId)}/respond`,
    input as Record<string, unknown>,
  );
}

export async function fetchDomainEvents(input?: {
  type?: string;
  correlationId?: string;
  limit?: number;
}): Promise<DomainEventListView> {
  const search = new URLSearchParams();

  if (input?.type) search.set("type", input.type);
  if (input?.correlationId) search.set("correlationId", input.correlationId);
  if (input?.limit) search.set("limit", String(input.limit));

  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return fetchSemse<DomainEventListView>(`/api/semse/domain-events${suffix}`);
}

export async function fetchDomainEventTrace(correlationId: string): Promise<DomainEventTraceView> {
  return fetchSemse<DomainEventTraceView>(`/api/semse/domain-events/${encodeURIComponent(correlationId)}`);
}

export async function fetchDomainEventManualCatalog(): Promise<{ allowedTypes: SemseEvent["type"][] }> {
  return fetchSemse<{ allowedTypes: SemseEvent["type"][] }>("/api/semse/domain-events/manual-catalog");
}

export async function emitDomainEvent(event: SemseEvent): Promise<unknown> {
  return mutateSemse<unknown>("/api/semse/domain-events", event as unknown as Record<string, unknown>);
}

export async function acknowledgeOpsAlert(alertId: string): Promise<OpsMutationResult> {
  return mutateSemse<OpsMutationResult>(`/api/semse/ops/alerts/${alertId}/ack`);
}

export async function executeOpsRunbook(runbookId: string): Promise<OpsMutationResult> {
  return mutateSemse<OpsMutationResult>(`/api/semse/ops/runbooks/${runbookId}/execute`);
}

export async function reportOpsIncident(input: {
  severity: "watch" | "critical";
  title: string;
}): Promise<OpsMutationResult> {
  return mutateSemse<OpsMutationResult>("/api/semse/ops/incidents", input);
}

export async function fetchJobs(): Promise<JobRecordView[]> {
  return fetchSemse<JobRecordView[]>("/api/semse/jobs");
}

export async function fetchMyJobs(): Promise<JobRecordView[]> {
  const bids = await fetchMyBids();
  return bids
    .filter(b => b.status === "accepted")
    .map(b => ({
      id: b.jobId,
      tenantId: "",
      title: b.jobTitle,
      scope: b.jobTitle,
      category: b.jobCategory,
      location: b.jobLocation,
      budgetMin: b.jobBudgetMin,
      budgetMax: b.jobBudgetMax,
      status: (b.jobStatus ?? "accepted") as JobRecordView["status"],
    }));
}

export type RatingListItem = {
  id: string;
  jobId: string;
  score: number;
  comment?: string;
  createdAt: string | Date;
  job: {
    id: string;
    title: string;
  };
  fromUser: {
    id: string;
    email: string;
  };
  toUser: {
    id: string;
    email: string;
  };
};

export async function fetchRatings(): Promise<{ actorUserId: string | null; items: RatingListItem[] }> {
  return fetchSemse<{ actorUserId: string | null; items: RatingListItem[] }>("/api/semse/ratings");
}

export async function createRating(input: {
  jobId: string;
  toUserId: string;
  score: number;
  comment?: string;
}): Promise<RatingListItem> {
  return fetchSemse<RatingListItem>("/api/semse/ratings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function fetchJob(jobId: string): Promise<JobRecordView> {
  return fetchSemse<JobRecordView>(`/api/semse/jobs/${jobId}`);
}

export async function createRuntimeJob(input: CreateRuntimeJobInput): Promise<JobRecordView> {
  return mutateSemse<JobRecordView>("/api/semse/jobs", input);
}

export type JobAgentSignal = {
  id: string;
  agentType: string;
  status: string;
  outputSummary: string | null;
  actionType: string | null;
  confidence: number | null;
  requiresHumanReview: boolean;
  correlationId: string;
  createdAt: string;
};

export async function fetchJobAgentSignals(jobId: string): Promise<JobAgentSignal[]> {
  const res = await fetchSemse<{ signals: JobAgentSignal[] }>(`/api/semse/jobs/${jobId}/agent-signals`);
  return res.signals ?? [];
}

export async function fetchJobEscrow(jobId: string): Promise<Record<string, unknown>> {
  return fetchSemse<Record<string, unknown>>(`/api/semse/jobs/${jobId}/escrow`);
}

export async function fetchJobPayments(jobId: string): Promise<Record<string, unknown>[]> {
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/jobs/${jobId}/payments`);
}

export async function fetchJobContract(jobId: string): Promise<Record<string, unknown>> {
  return fetchSemse<Record<string, unknown>>(`/api/semse/jobs/${jobId}/contracts/current`);
}

export type BidView = {
  id: string;
  jobId: string;
  proUserId?: string;
  professionalUserId?: string;
  proEmail?: string;
  amount: number;
  etaDays: number;
  note?: string | null;
  status: "submitted" | "accepted" | "rejected" | "withdrawn";
  createdAt: string;
  avgRating?: number;
  ratingCount?: number;
};

export type TimeTrackerSummaryView = TrackerSummaryView;

export async function fetchJobBids(jobId: string): Promise<BidView[]> {
  return fetchSemse<BidView[]>(`/api/semse/jobs/${jobId}/bids`);
}

export async function fetchTimeTrackerJobs(): Promise<JobRecordView[]> {
  return fetchSemse<JobRecordView[]>("/api/semse/time-tracker/jobs");
}

export async function fetchTimeTrackerSummary(range: "week" | "month"): Promise<TimeTrackerSummaryView> {
  return fetchSemse<TimeTrackerSummaryView>(`/api/semse/time-tracker/summary?range=${range}`);
}

export async function fetchTimeTrackerSessions(input?: {
  range?: "week" | "month" | "all";
  jobId?: string;
  status?: TrackerSessionView["status"] | "all";
  limit?: number;
}): Promise<TrackerSessionView[]> {
  const search = new URLSearchParams();
  if (input?.range) search.set("range", input.range);
  if (input?.jobId && input.jobId !== "all") search.set("jobId", input.jobId);
  if (input?.status && input.status !== "all") search.set("status", input.status);
  if (input?.limit) search.set("limit", String(input.limit));
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return fetchSemse<TrackerSessionView[]>(`/api/semse/time-tracker/sessions${suffix}`);
}

export async function updateTimeTrackerSessionNotes(sessionId: string, input: {
  notes?: string;
}): Promise<TrackerSessionView> {
  return mutateSemse<TrackerSessionView>(
    `/api/semse/time-tracker/sessions/${encodeURIComponent(sessionId)}/notes`,
    input,
  );
}

export async function acceptBid(bidId: string): Promise<Record<string, unknown>> {
  return fetchSemse<Record<string, unknown>>(`/api/semse/bids/${bidId}/accept`, {
    method: "POST",
  });
}

export type MyBidView = {
  id: string;
  jobId: string;
  jobTitle: string;
  jobCategory?: string;
  jobLocation?: string;
  jobBudgetMin?: number;
  jobBudgetMax?: number;
  jobStatus: string;
  amount: number;
  etaDays: number;
  note?: string | null;
  status: "submitted" | "accepted" | "rejected";
  createdAt: string;
};

export async function fetchMyBids(): Promise<MyBidView[]> {
  const r = await fetchSemse<MyBidView[] | { data: MyBidView[] } | { bids: MyBidView[]; total: number }>("/api/semse/my-bids").catch(() => []);
  if (Array.isArray(r)) return r;
  const bids = (r as { bids?: MyBidView[] }).bids;
  if (Array.isArray(bids)) return bids;
  const d = (r as { data?: MyBidView[] }).data;
  return Array.isArray(d) ? d : [];
}

export async function fetchJobPaymentReadiness(jobId: string): Promise<Record<string, unknown>> {
  return fetchSemse<Record<string, unknown>>(`/api/semse/jobs/${jobId}/payment-readiness`);
}

export async function fundJobEscrow(
  jobId: string,
  input: { amount: number; currency?: string; provider?: string; methodType?: string }
): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(`/api/semse/jobs/${jobId}/escrow`, input);
}

export async function fetchJobEvidence(jobId: string): Promise<Record<string, unknown>[]> {
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/jobs/${jobId}/evidence`);
}

export async function fetchVisionByJob(jobId: string): Promise<Record<string, unknown>[]> {
  const envelope = await fetchSemse<{ data: Record<string, unknown>[] }>(`/api/semse/vision?jobId=${encodeURIComponent(jobId)}`);
  return Array.isArray((envelope as unknown as { data: Record<string, unknown>[] }).data)
    ? (envelope as unknown as { data: Record<string, unknown>[] }).data
    : (Array.isArray(envelope) ? envelope as Record<string, unknown>[] : []);
}

export async function triggerVisionEndpoint(endpoint: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>("/api/semse/vision", { endpoint, payload });
}

export async function detectMaterial(imageUrl: string, expectedMaterial?: string, enrich = true): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>("/api/semse/vision", { endpoint: "detect-material", payload: { imageUrl, expectedMaterial, enrich } });
}

export async function classifySpace(imageUrl: string, enrich = true): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>("/api/semse/vision", { endpoint: "classify-space", payload: { imageUrl, enrich } });
}

export async function analyzePortfolio(imageUrl: string, imageHash?: string, enrich = true): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>("/api/semse/vision", { endpoint: "analyze-portfolio", payload: { imageUrl, imageHash, enrich } });
}

export async function safetyCheckEnriched(imageUrl: string, trade?: string): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>("/api/semse/vision", { endpoint: "safety-check-enriched", payload: { imageUrl, trade } });
}

export async function presignEvidence(input: {
  filename: string;
  contentType: string;
  fileSizeBytes?: number;
  source?: "local_device" | "camera_capture" | "field_ops" | "project_copilot" | "external_transfer";
}): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(`/api/semse/evidence/presign`, input);
}

export async function transitionJobStatus(
  jobId: string,
  targetStatus: string
): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(
    `/api/semse/jobs/${jobId}/transition`,
    { targetStatus }
  );
}

export async function planUpload(input: {
  domain: "evidence" | "contract" | "dispute" | "travel";
  filename: string;
  contentType: string;
  fileSizeBytes: number;
  source?: "local_device" | "camera_capture" | "field_ops" | "project_copilot" | "external_transfer";
}): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(`/api/semse/uploads/plan`, input);
}

export async function createMultipartUploadSession(input: {
  domain: "evidence" | "contract" | "dispute" | "travel";
  filename: string;
  contentType: string;
  fileSizeBytes: number;
  source?: "local_device" | "camera_capture" | "field_ops" | "project_copilot" | "external_transfer";
}): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(`/api/semse/uploads/multipart-session`, input);
}

export async function completeMultipartUploadSession(input: {
  sessionId: string;
  parts: Array<{ partNumber: number; etag: string }>;
}): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(`/api/semse/uploads/multipart-session/complete`, input);
}

export async function uploadMultipartPart(input: {
  sessionId: string;
  partNumber: number;
  contentLength: number;
}): Promise<Record<string, unknown>> {
  return fetchSemse<Record<string, unknown>>(
    `/api/semse/uploads/multipart-session/${encodeURIComponent(input.sessionId)}/parts/${input.partNumber}`,
    {
      method: "PUT",
      headers: {
        "x-part-size": String(input.contentLength)
      }
    }
  );
}

export async function registerJobEvidence(
  jobId: string,
  input: { key: string; kind: "PHOTO" | "VIDEO" | "DOCUMENT"; milestoneId?: string; filename?: string }
): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(`/api/semse/jobs/${jobId}/evidence`, input);
}

export async function fetchJobMilestones(jobId: string): Promise<Record<string, unknown>[]> {
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/jobs/${jobId}/milestones`);
}

export async function createJobMilestone(
  jobId: string,
  input: { title: string; amount: number; sequence: number }
): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(`/api/semse/jobs/${jobId}/milestones`, input);
}

export async function mutateMilestone(
  milestoneId: string,
  action: "submit" | "approve" | "reject" | "request-changes",
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(`/api/semse/milestones/${milestoneId}/${action}`, body);
}

export async function releaseMilestoneEscrow(
  milestoneId: string,
  input?: { amount?: number; provider?: string; methodType?: string }
): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(`/api/semse/milestones/${milestoneId}/release`, input);
}

export async function refundEscrow(input: {
  projectId?: string;
  escrowId?: string;
  amount: number;
  reason: string;
}): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(`/api/semse/escrow/refund`, input);
}

export async function fetchDisputes(): Promise<Record<string, unknown>[]> {
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/disputes`);
}

export async function submitDisputeEvidence(
  disputeId: string,
  input: { evidenceIds: string[] },
): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(
    `/api/semse/disputes/${encodeURIComponent(disputeId)}/submit-evidence`,
    input,
  );
}

export async function markDisputeUnderReview(
  disputeId: string,
): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(
    `/api/semse/disputes/${encodeURIComponent(disputeId)}/review`,
    {},
  );
}

export async function resolveDispute(
  disputeId: string,
  input: {
    resolution: string;
    resolutionType: "client_favor" | "pro_favor" | "partial_50_50" | "escalated_legal";
  },
): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(
    `/api/semse/disputes/${encodeURIComponent(disputeId)}/resolve`,
    input,
  );
}

export async function uploadEvidenceFile(
  file: File,
  jobId: string,
  milestoneId?: string,
): Promise<{ key: string; evidenceId: string }> {
  const kind: "PHOTO" | "VIDEO" | "DOCUMENT" = file.type.startsWith("image/")
    ? "PHOTO"
    : file.type.startsWith("video/")
    ? "VIDEO"
    : "DOCUMENT";

  // 1. Get presigned upload plan
  const plan = await presignEvidence({
    filename: file.name,
    contentType: file.type,
    fileSizeBytes: file.size,
    source: "local_device",
  });

  const uploadUrl = String(plan.uploadUrl ?? "");
  const key = String(plan.key ?? "");

  if (!uploadUrl || !key) {
    throw new Error("Invalid upload plan: missing uploadUrl or key");
  }

  // 2. PUT file to the BFF upload proxy
  const proxyUrl = `/api/semse/uploads/files/${encodeURIComponent(key)}`;
  const uploadRes = await fetch(proxyUrl, {
    method: "PUT",
    headers: { "content-type": file.type, "content-length": String(file.size) },
    body: file,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Upload failed (${uploadRes.status}): ${text}`);
  }

  // 3. Register the evidence record in the DB
  const evidence = await registerJobEvidence(jobId, { key, kind, milestoneId });
  const evidenceId = String(evidence.id ?? "");

  return { key, evidenceId };
}

export async function uploadPrometeoAttachment(
  file: File,
  source: PrometeoAttachment["source"],
): Promise<PrometeoAttachment> {
  const originalContentType = file.type || "application/octet-stream";
  const uploadContentType = getPrometeoUploadContentType(file);
  const plan = await presignEvidence({
    filename: file.name,
    contentType: uploadContentType,
    fileSizeBytes: file.size,
    source: source === "camera" ? "camera_capture" : "project_copilot",
  });

  const key = typeof plan.key === "string" ? plan.key : "";
  if (!key) {
    throw new Error("No se pudo preparar el almacenamiento del adjunto.");
  }

  const uploadResponse = await fetch(`/api/semse/uploads/files/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: {
      "content-type": uploadContentType,
      "content-length": String(file.size),
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    const payload = await uploadResponse.text().catch(() => "");
    throw new Error(payload || `No se pudo subir “${file.name}” (${uploadResponse.status}).`);
  }

  return buildStoredPrometeoAttachment({
    key,
    name: file.name,
    mimeType: originalContentType,
    sizeBytes: file.size,
    source,
  });
}

export async function fetchNotifications(input?: {
  unreadOnly?: boolean;
}): Promise<{ items: Record<string, unknown>[]; unread: number }> {
  const qs = input?.unreadOnly ? "?unreadOnly=true" : "";
  return fetchSemse<{ items: Record<string, unknown>[]; unread: number }>(
    `/api/semse/notifications${qs}`,
  );
}

export async function markNotificationRead(
  notificationId: string,
): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(
    `/api/semse/notifications/${encodeURIComponent(notificationId)}/read`,
    {},
  );
}

export async function fetchTrackerSnapshot(): Promise<TrackerSnapshotView> {
  return fetchSemse<TrackerSnapshotView>("/api/semse/time-tracker");
}

export async function fetchTrackerBootstrap(): Promise<TrackerBootstrapView> {
  return fetchSemse<TrackerBootstrapView>("/api/semse/time-tracker");
}

// ── Communications ─────────────────────────────────────────────────────────────

export type CommThread = {
  id: string;
  channel: string;
  contactPhone: string | null;
  contactName: string | null;
  status: string;
  lastMessageAt: string | null;
  contractorLeadId: string | null;
  jobId: string | null;
  createdAt: string;
};

export type CommMessage = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string | null;
  status: string;
  contactPhone: string | null;
  createdAt: string;
};

export async function fetchCommThreads(input?: {
  status?: string;
  limit?: number;
}): Promise<CommThread[]> {
  const params = new URLSearchParams();
  if (input?.status) params.set("status", input.status);
  if (input?.limit) params.set("limit", String(input.limit));
  const qs = params.toString();
  return fetchSemse<CommThread[]>(`/api/semse/communications/threads${qs ? `?${qs}` : ""}`);
}

export async function fetchCommMessages(threadId: string): Promise<CommMessage[]> {
  return fetchSemse<CommMessage[]>(
    `/api/semse/communications/threads/${encodeURIComponent(threadId)}/messages`,
  );
}

export async function sendCommMessage(input: {
  threadId: string;
  channel: string;
  body: string;
  recipientPhone?: string;
}): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>("/api/semse/communications/send", input);
}

export async function fetchAutonomyRuns(): Promise<AutonomyRunListView> {
  return fetchSemse<AutonomyRunListView>("/api/semse/autonomy");
}

export async function fetchAutonomyProviderStatus(): Promise<AutonomyLlmStatusView> {
  return fetchSemse<AutonomyLlmStatusView>("/api/semse/autonomy/provider");
}

export async function fetchAutonomyRun(runId: string): Promise<AutonomyRunView> {
  return fetchSemse<AutonomyRunView>(`/api/semse/autonomy/${encodeURIComponent(runId)}`);
}

export async function createAutonomyRun(input: {
  task: string;
  baseBranch?: string;
  targetStage?: "branch" | "change" | "commit" | "push" | "pr";
}): Promise<AutonomyRunView> {
  return mutateSemse<AutonomyRunView>("/api/semse/autonomy", input);
}

export async function continueAutonomyRun(
  runId: string,
  input?: { targetStage?: "branch" | "change" | "commit" | "push" | "pr" }
): Promise<AutonomyRunView> {
  return mutateSemse<AutonomyRunView>(`/api/semse/autonomy/${encodeURIComponent(runId)}`, input ?? {});
}

export async function startTrackerSession(input: {
  jobId: string;
  notes?: string;
}): Promise<TrackerSessionView> {
  return mutateSemse<TrackerSessionView>("/api/semse/time-tracker/sessions/start", input);
}

export async function pauseTrackerSession(sessionId: string, input?: {
  notes?: string;
}): Promise<TrackerSessionView> {
  return mutateSemse<TrackerSessionView>(`/api/semse/time-tracker/sessions/${encodeURIComponent(sessionId)}/pause`, input);
}

export async function resumeTrackerSession(sessionId: string, input?: {
  notes?: string;
}): Promise<TrackerSessionView> {
  return mutateSemse<TrackerSessionView>(`/api/semse/time-tracker/sessions/${encodeURIComponent(sessionId)}/resume`, input);
}

export async function stopTrackerSession(sessionId: string, input?: {
  notes?: string;
}): Promise<TrackerSessionView> {
  return mutateSemse<TrackerSessionView>(`/api/semse/time-tracker/sessions/${encodeURIComponent(sessionId)}/stop`, input);
}

export async function createManualTrackerSession(input: {
  jobId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
}): Promise<TrackerSessionView> {
  return mutateSemse<TrackerSessionView>("/api/semse/time-tracker/sessions/manual", input);
}

export async function fetchFieldUnits(query?: { projectId?: string; status?: string }): Promise<Record<string, unknown>[]> {
  const search = new URLSearchParams();
  if (query?.projectId) search.set("projectId", query.projectId);
  if (query?.status) search.set("status", query.status);
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/field-ops/units${suffix}`);
}

export async function fetchFieldWorklogs(query?: {
  fieldUnitId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<Record<string, unknown>[]> {
  const search = new URLSearchParams();
  if (query?.fieldUnitId) search.set("fieldUnitId", query.fieldUnitId);
  if (query?.dateFrom) search.set("dateFrom", query.dateFrom);
  if (query?.dateTo) search.set("dateTo", query.dateTo);
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/field-ops/worklogs${suffix}`);
}

export async function fetchFieldFacts(query?: {
  subject?: string;
  predicate?: string;
}): Promise<Record<string, unknown>[]> {
  const search = new URLSearchParams();
  if (query?.subject) search.set("subject", query.subject);
  if (query?.predicate) search.set("predicate", query.predicate);
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/field-ops/facts${suffix}`);
}

export async function fetchFieldVendors(): Promise<Record<string, unknown>[]> {
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/field-ops/vendors`);
}

export async function createFieldWorklog(input: {
  fieldUnitId: string;
  date: string;
  doneToday: string;
  pendingNext: string;
  blockers?: string;
  notes?: string;
}): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>("/api/semse/field-ops/worklogs", input);
}

export async function fetchOrganizations(): Promise<Record<string, unknown>[]> {
  return fetchSemse<Record<string, unknown>[]>("/api/semse/organizations");
}

export async function fetchOrganization(orgId: string): Promise<Record<string, unknown>> {
  return fetchSemse<Record<string, unknown>>(`/api/semse/organizations/${orgId}`);
}

export async function fetchOrganizationMembers(orgId: string): Promise<Record<string, unknown>[]> {
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/organizations/${orgId}/members`);
}

export type UserView = {
  id: string;
  email: string;
  phone?: string;
  status: "active" | "pending" | "suspended" | string;
  verificationStatus: string;
  trustScore: number;
  riskLevel: string;
  flags: string[];
  createdAt: string;
  updatedAt: string;
};

export type UserMembershipView = {
  userId: string;
  orgId: string;
  roleId: string;
  org: {
    id: string;
    name: string;
    type: string;
  };
  role: {
    id: string;
    key: string;
    name: string;
  };
  createdAt: string;
};

export async function fetchUsers(): Promise<UserView[]> {
  return fetchSemse<UserView[]>("/api/semse/users");
}

export async function fetchUser(userId: string): Promise<UserView> {
  return fetchSemse<UserView>(`/api/semse/users/${encodeURIComponent(userId)}`);
}

export async function fetchCurrentUser(): Promise<UserView> {
  return fetchSemse<UserView>("/api/semse/users/me");
}

export async function fetchUserMemberships(userId: string): Promise<UserMembershipView[]> {
  return fetchSemse<UserMembershipView[]>(`/api/semse/users/${encodeURIComponent(userId)}/memberships`);
}

export async function verifyUser(
  userId: string,
  verificationType: "email" | "phone" | "id_document" | "background_check" = "email",
): Promise<UserView> {
  return mutateSemse<UserView>(`/api/semse/users/${encodeURIComponent(userId)}/verify`, { verificationType });
}

export async function updateUserStatus(
  userId: string,
  status: "active" | "pending" | "suspended",
): Promise<UserView> {
  return patchSemse<UserView>(`/api/semse/users/${encodeURIComponent(userId)}/status`, { status });
}

export type AssistantTone      = "friendly" | "formal" | "technical" | "executive";
export type AssistantLanguage  = "es" | "en";
export type AssistantVerbosity = "short" | "balanced" | "detailed";

export type UserProfileView = {
  userId: string;
  displayName?: string;
  bio?: string;
  location?: string;
  trades: string[];
  availability: boolean;
  assistantTone?: AssistantTone;
  assistantLanguage?: AssistantLanguage;
  assistantVerbosity?: AssistantVerbosity;
  unifiedMode: boolean;
  expertMode: boolean;
  updatedAt: string;
};

export type UserProfileUpdateInput = {
  displayName?: string;
  bio?: string;
  location?: string;
  trades?: string[];
  availability?: boolean;
  assistantTone?: AssistantTone;
  assistantLanguage?: AssistantLanguage;
  assistantVerbosity?: AssistantVerbosity;
  unifiedMode?: boolean;
  expertMode?: boolean;
};

export async function fetchMyProfile(): Promise<UserProfileView> {
  return fetchSemse<UserProfileView>("/api/semse/users/me/profile");
}

export async function updateMyProfile(data: UserProfileUpdateInput): Promise<UserProfileView> {
  return patchSemse<UserProfileView>("/api/semse/users/me/profile", data as Record<string, unknown>);
}

export async function fetchOpsAuditLog(): Promise<Record<string, unknown>[]> {
  return fetchSemse<Record<string, unknown>[]>("/api/semse/ops/audit");
}

export type LLMProviderMetric = {
  provider: "anthropic" | "openai" | "ollama" | "template";
  taskType: string;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  successRate: number;
  estimatedCostPer1K: number;
  score: number;
  circuitState: "closed" | "open" | "half-open";
  lastFailureAt?: string;
  sampleCount: number;
};

export async function fetchLLMMetrics(): Promise<LLMProviderMetric[]> {
  return fetchSemse<LLMProviderMetric[]>("/api/semse/ops/llm-metrics");
}

export async function fetchOpsTrustOverview(): Promise<Record<string, unknown>> {
  return fetchSemse<Record<string, unknown>>("/api/semse/ops/trust-overview");
}

export async function fetchOpsRiskScores(): Promise<Record<string, unknown>[]> {
  return fetchSemse<Record<string, unknown>[]>("/api/semse/ops/risk-scores");
}

export async function createJobDispute(input: {
  jobId?: string;
  projectId?: string;
  reason: string;
}): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(`/api/semse/disputes`, input);
}

export type DisputeComment = {
  id: string;
  disputeId: string;
  text: string;
  author?: string;
  role?: "client" | "worker" | "admin" | "system";
  createdAt: string;
};

export async function fetchDisputeComments(disputeId: string): Promise<DisputeComment[]> {
  const result = await fetchSemse<{ data: DisputeComment[] }>(
    `/api/semse/disputes/${encodeURIComponent(disputeId)}/comments`
  );
  return result.data ?? [];
}

export async function addDisputeComment(
  disputeId: string,
  input: { text: string; author?: string }
): Promise<DisputeComment> {
  const result = await fetchSemse<{ data: DisputeComment }>(
    `/api/semse/disputes/${encodeURIComponent(disputeId)}/comments`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }
  );
  return result.data;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  kind: "dispute" | "payment" | "approval" | "system" | string;
  read: boolean;
  createdAt: string;
  linkHref?: string;
  targetRole?: "client" | "worker" | "admin";
  correlationId?: string;
};

// fetchNotifications and markNotificationRead defined above (lines ~535)

export async function sendNotification(input: {
  title: string;
  body: string;
  kind: NotificationItem["kind"];
  targetRole?: "client" | "worker" | "admin";
  linkHref?: string;
  correlationId?: string;
}): Promise<void> {
  await fetchSemse<unknown>("/api/semse/notifications", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function retryAgentRun(runId: string): Promise<OpsMutationResult> {
  return mutateSemse<OpsMutationResult>(`/api/semse/ops/agent-runtime/${encodeURIComponent(runId)}/retry`);
}

export async function requeueAgentRun(runId: string): Promise<OpsMutationResult> {
  return mutateSemse<OpsMutationResult>(`/api/semse/ops/agent-runtime/${encodeURIComponent(runId)}/requeue`);
}

export async function openIncident(input: {
  title: string;
  severity: "watch" | "critical";
}): Promise<OpsMutationResult> {
  return mutateSemse<OpsMutationResult>("/api/semse/ops/incidents", input);
}

// ── Agent Approvals ───────────────────────────────────────────────────────────

export type AgentApprovalItem = {
  id: string;
  agentType: string;
  title: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  riskLevel: string;
  riskScore: number;
  correlationId: string;
  contextSummary?: string;
  requestedAt: string;
  decidedAt?: string;
  decisionComment?: string;
};

export async function fetchPendingApprovals(): Promise<AgentApprovalItem[]> {
  const result = await fetchSemse<{ data: AgentApprovalItem[] }>("/api/semse/agents/approvals");
  return (result.data ?? []).filter((a) => a.status === "pending");
}

export async function fetchAgentApproval(approvalId: string): Promise<AgentApprovalItem> {
  const result = await fetchSemse<{ data: AgentApprovalItem }>(`/api/semse/agents/approvals/${encodeURIComponent(approvalId)}`);
  return result.data;
}

export async function decideAgentApproval(
  approvalId: string,
  decision: "approved" | "rejected",
  comment?: string
): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(
    `/api/semse/agents/approvals/${encodeURIComponent(approvalId)}/decision`,
    { decision, comment }
  );
}

// ── Incidents ─────────────────────────────────────────────────────────────────

export async function fetchIncidents(query?: { status?: string }): Promise<Record<string, unknown>[]> {
  const params = query?.status ? `?status=${query.status}` : "";
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/incidents${params}`);
}

export async function createIncident(input: {
  jobId: string;
  title: string;
  type: string;
  severity: string;
  description?: string;
}): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>("/api/semse/incidents", input as unknown as Record<string, unknown>);
}

// ── Materials ─────────────────────────────────────────────────────────────────

export async function fetchMaterials(query?: { status?: string }): Promise<Record<string, unknown>[]> {
  const params = query?.status ? `?status=${query.status}` : "";
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/materials${params}`);
}

export async function createMaterialRequest(input: {
  jobId: string;
  milestoneId?: string;
  item: string;
  quantity: number;
  unit: string;
  estimatedCost?: number;
}): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>("/api/semse/materials", input as unknown as Record<string, unknown>);
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function fetchTasks(query?: { status?: string }): Promise<Record<string, unknown>[]> {
  const params = query?.status ? `?status=${query.status}` : "";
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/tasks${params}`);
}

export async function updateTaskStatus(taskId: string, status: string): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(`/api/semse/tasks/${encodeURIComponent(taskId)}/status`, { status });
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function fetchProjects(query?: { status?: string }): Promise<Record<string, unknown>[]> {
  const params = query?.status ? `?status=${query.status}` : "";
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/projects${params}`);
}

// ── Project Copilot ───────────────────────────────────────────────────────────

export type CopilotKind = "chat" | "search" | "action" | "refresh";

export type CopilotInput =
  | { kind: "chat";    projectId: string; message: string; threadId?: string }
  | { kind: "search";  projectId: string; query: string;   topK?: number }
  | { kind: "action";  projectId: string; actionType: string; payload?: Record<string, unknown> }
  | { kind: "refresh"; projectId: string };

export type CopilotProposedAction = {
  id: string;
  type: string;
  domain: string;
  summary: string;
  rationale: string;
  riskLevel: "low" | "medium" | "high";
  approvalMode: "none" | "recommended" | "required";
  toolCall?: { toolName: string; payload: Record<string, unknown> };
  expectedOutcome: string;
};

export type CopilotBlockedAction = {
  actionType: string;
  summary: string;
  reason: string;
};

export type WorkPlanStep = {
  id: string;
  order: number;
  title: string;
  description: string;
  expectedOutcome: string;
  capability: "dispute" | "searching" | "perambulating" | "composing" | "clouding" | "shelling" | "editing" | "testing" | "waiting" | "worker";
  toolsAllowed: string[];
  actionType?: string;
  dependsOnStepIds?: string[];
  requiredEvidence?: string[];
  evidenceStatus?: "missing" | "partial" | "satisfied";
  boundAction?: {
    actionType: string;
    approvalMode: "manual" | "auto";
    riskLevel: "low" | "medium" | "high";
  };
  riskLevel: "low" | "medium" | "high";
  requiresApproval: boolean;
  requiresApprovedPlan: boolean;
  status: "pending" | "ready" | "executing" | "blocked" | "completed" | "failed" | "skipped";
  blockReason?: string;
  startedAt?: string;
  completedAt?: string;
  blockedReason?: string;
};

export type CopilotWorkPlan = {
  id: string;
  title: string;
  goal: string;
  rationale: string;
  description?: string;
  status: "pending_approval" | "approved" | "executing" | "completed" | "cancelled" | "rejected";
  steps: WorkPlanStep[];
  risks: string[];
  requiredEvidence: string[];
  successCriteria: string[];
  progress?: {
    totalSteps: number;
    completedSteps: number;
    skippedSteps: number;
    blockedSteps: number;
    readySteps: number;
    executingSteps: number;
    failedSteps: number;
    percent: number;
  };
  approvedAt?: string;
  createdAt: string;
};

export type CopilotChatOutput = {
  kind: "chat";
  threadId: string;
  message: string;
  citations: unknown[];
  refreshTargets: string[];
  proposedActions: CopilotProposedAction[];
  blockedActions?: CopilotBlockedAction[];
  proposedPlan?: CopilotWorkPlan;
  activePlan?: CopilotWorkPlan;
  workPlan?: CopilotWorkPlan;
  provider?: string;
  model?: string;
  mode?: string;
};

export async function approveWorkPlan(planId: string): Promise<CopilotWorkPlan> {
  const res = await fetch(`/api/semse/agents/plans/${encodeURIComponent(planId)}/approve`, { method: "PATCH" });
  if (!res.ok) throw new Error(`approve plan ${res.status}`);
  const json = await res.json() as { data?: CopilotWorkPlan };
  return json.data ?? ({
    id: planId,
    title: "",
    goal: "",
    rationale: "",
    status: "approved",
    steps: [],
    risks: [],
    requiredEvidence: [],
    successCriteria: [],
    createdAt: new Date().toISOString(),
  } as CopilotWorkPlan);
}

export async function rejectWorkPlan(planId: string): Promise<CopilotWorkPlan> {
  const res = await fetch(`/api/semse/agents/plans/${encodeURIComponent(planId)}/reject`, { method: "PATCH" });
  if (!res.ok) throw new Error(`reject plan ${res.status}`);
  const json = await res.json() as { data?: CopilotWorkPlan };
  return json.data ?? ({
    id: planId,
    title: "",
    goal: "",
    rationale: "",
    status: "rejected",
    steps: [],
    risks: [],
    requiredEvidence: [],
    successCriteria: [],
    createdAt: new Date().toISOString(),
  } as CopilotWorkPlan);
}

export async function cancelWorkPlan(planId: string): Promise<CopilotWorkPlan> {
  const res = await fetch(`/api/semse/agents/plans/${encodeURIComponent(planId)}/cancel`, { method: "PATCH" });
  if (!res.ok) throw new Error(`cancel plan ${res.status}`);
  const json = await res.json() as { data?: CopilotWorkPlan };
  return json.data ?? ({
    id: planId,
    title: "",
    goal: "",
    rationale: "",
    status: "cancelled",
    steps: [],
    risks: [],
    requiredEvidence: [],
    successCriteria: [],
    createdAt: new Date().toISOString(),
  } as CopilotWorkPlan);
}

async function patchWorkPlanStep(
  planId: string,
  stepId: string,
  action: "start" | "complete" | "block" | "retry",
  body?: Record<string, unknown>,
): Promise<CopilotWorkPlan> {
  const res = await fetch(
    `/api/semse/agents/plans/${encodeURIComponent(planId)}/steps/${encodeURIComponent(stepId)}/${action}`,
    {
      method: "PATCH",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  if (!res.ok) throw new Error(`${action} plan step ${res.status}`);
  const json = await res.json() as { data?: CopilotWorkPlan };
  return json.data ?? ({
    id: planId,
    title: "",
    goal: "",
    rationale: "",
    status: "approved",
    steps: [],
    risks: [],
    requiredEvidence: [],
    successCriteria: [],
    createdAt: new Date().toISOString(),
  } as CopilotWorkPlan);
}

export async function startWorkPlanStep(planId: string, stepId: string, evidenceCount?: number): Promise<CopilotWorkPlan> {
  return patchWorkPlanStep(planId, stepId, "start", typeof evidenceCount === "number" ? { evidenceCount } : undefined);
}

export async function completeWorkPlanStep(planId: string, stepId: string, evidenceCount?: number): Promise<CopilotWorkPlan> {
  return patchWorkPlanStep(planId, stepId, "complete", typeof evidenceCount === "number" ? { evidenceCount } : undefined);
}

export async function blockWorkPlanStep(planId: string, stepId: string, reason: string, evidenceCount?: number): Promise<CopilotWorkPlan> {
  return patchWorkPlanStep(planId, stepId, "block", {
    reason,
    ...(typeof evidenceCount === "number" ? { evidenceCount } : {}),
  });
}

export async function retryWorkPlanStep(planId: string, stepId: string, evidenceCount?: number): Promise<CopilotWorkPlan> {
  return patchWorkPlanStep(planId, stepId, "retry", typeof evidenceCount === "number" ? { evidenceCount } : undefined);
}

export type CopilotActionOutput = {
  kind: "action";
  success: boolean;
  message: string;
  approvalId?: string;
  approvalStatus?: string;
  approvalMode?: string;
  refreshTargets: string[];
};

export type CopilotOutput =
  | CopilotChatOutput
  | CopilotActionOutput
  | Record<string, unknown>;

export async function runProjectCopilot(input: CopilotInput): Promise<CopilotOutput> {
  return mutateSemse<CopilotOutput>("/api/semse/agents/copilot", input as unknown as Record<string, unknown>);
}

// ── Travel / Movilidad y Estancia ─────────────────────────────────────────────

export async function fetchTravelAssignments(query?: {
  status?: string; jobId?: string; assignedTo?: string; scope?: "mine" | "all";
}): Promise<Record<string, unknown>[]> {
  const qs = new URLSearchParams();
  if (query?.status) qs.set("status", query.status);
  if (query?.jobId)  qs.set("jobId",  query.jobId);
  if (query?.assignedTo) qs.set("assignedTo", query.assignedTo);
  if (query?.scope) qs.set("scope", query.scope);
  const q = qs.toString() ? `?${qs.toString()}` : "";
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/travel${q}`);
}

export async function fetchTravelAssignment(travelId: string): Promise<Record<string, unknown>> {
  return fetchSemse<Record<string, unknown>>(`/api/semse/travel/${encodeURIComponent(travelId)}`);
}

export async function createTravelAssignment(input: {
  jobId: string; destinationCity: string; departureDate: string; returnDate?: string;
  estimatedDays?: number; requiresLodging?: boolean; headcount?: number;
  mainTransportMode?: string; approvedBudget?: number; notes?: string;
}): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>("/api/semse/travel", input as unknown as Record<string, unknown>);
}

export async function updateTravelAssignmentStatus(travelId: string, status: string): Promise<Record<string, unknown>> {
  return fetchSemse<Record<string, unknown>>(
    `/api/semse/travel/${encodeURIComponent(travelId)}/status`,
    { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) }
  );
}

export async function fetchTravelExpenses(travelId: string, category?: string): Promise<Record<string, unknown>[]> {
  const qs = category ? `?category=${category}` : "";
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/travel/${encodeURIComponent(travelId)}/expenses${qs}`);
}

export async function createTravelExpense(travelId: string, input: {
  category: string; subcategory?: string; description?: string;
  amount: number; currency?: string; expenseDate: string;
  city?: string; origin?: string; destination?: string; vendor?: string;
  odometer?: number; gallons?: number; receiptUrl?: string; notes?: string;
}): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(
    `/api/semse/travel/${encodeURIComponent(travelId)}/expenses`,
    input as unknown as Record<string, unknown>
  );
}

export async function fetchTravelLodging(travelId: string): Promise<Record<string, unknown>[]> {
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/travel/${encodeURIComponent(travelId)}/lodging`);
}

export async function createTravelLodging(travelId: string, input: {
  type?: string; name: string; address?: string; checkIn: string; checkOut: string;
  placeId?: string; googleMapsUri?: string; latitude?: number; longitude?: number;
  costPerNight?: number; estimatedTotal?: number; confirmationCode?: string;
  paidBy?: string; receiptUrl?: string; notes?: string;
}): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(
    `/api/semse/travel/${encodeURIComponent(travelId)}/lodging`,
    input as unknown as Record<string, unknown>
  );
}

export type TravelPlaceSearchItem = {
  id: string;
  displayName: string;
  formattedAddress: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  latitude?: number;
  longitude?: number;
  primaryType?: string;
};

export type TravelPlaceDetail = {
  id: string;
  displayName: string;
  formattedAddress: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  latitude?: number;
  longitude?: number;
  primaryType?: string;
};

export type TravelGeocodeResult = {
  formattedAddress: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
};

export async function searchTravelLodgingOptions(input: {
  query?: string;
  city?: string;
  pageSize?: number;
}): Promise<{ configured: boolean; query: string; items: TravelPlaceSearchItem[] }> {
  const qs = new URLSearchParams();
  if (input.query) qs.set("q", input.query);
  if (input.city) qs.set("city", input.city);
  if (input.pageSize) qs.set("pageSize", String(input.pageSize));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return fetchSemse<{ configured: boolean; query: string; items: TravelPlaceSearchItem[] }>(
    `/api/semse/travel/places/search${suffix}`
  );
}

export async function fetchTravelPlaceDetail(placeId: string): Promise<{
  configured: boolean;
  item: TravelPlaceDetail | null;
}> {
  return fetchSemse<{ configured: boolean; item: TravelPlaceDetail | null }>(
    `/api/semse/travel/places/${encodeURIComponent(placeId)}`
  );
}

export async function geocodeTravelAddress(address: string): Promise<{
  configured: boolean;
  item: TravelGeocodeResult | null;
}> {
  const qs = new URLSearchParams({ address });
  return fetchSemse<{ configured: boolean; item: TravelGeocodeResult | null }>(
    `/api/semse/travel/geocode?${qs.toString()}`
  );
}

export async function fetchTravelAdvances(travelId: string): Promise<Record<string, unknown>[]> {
  return fetchSemse<Record<string, unknown>[]>(`/api/semse/travel/${encodeURIComponent(travelId)}/advances`);
}

export async function createTravelAdvance(travelId: string, input: {
  amount: number; currency?: string; method?: string; approvedBy?: string; purpose?: string;
}): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(
    `/api/semse/travel/${encodeURIComponent(travelId)}/advances`,
    input as unknown as Record<string, unknown>
  );
}

export async function fetchTravelSettlement(travelId: string): Promise<Record<string, unknown>> {
  return fetchSemse<Record<string, unknown>>(`/api/semse/travel/${encodeURIComponent(travelId)}/settlement`);
}

export async function closeTravelSettlement(travelId: string, notes?: string): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(
    `/api/semse/travel/${encodeURIComponent(travelId)}/settlement/close`,
    notes ? { notes } : {}
  );
}

// ── Coordinator / Delegations ─────────────────────────────────────────────────

export type DelegationStatus = "pending" | "executing" | "completed" | "failed" | "rejected";

export type DelegationRecord = {
  id: string;
  tenantId: string;
  orgId: string;
  coordinatorId: string;
  targetAgentId: string;
  taskTitle: string;
  status: DelegationStatus;
  projectId?: string | null;
  sourceRunId?: string | null;
  targetRunId?: string | null;
  resultJson?: unknown;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CoordinatorSnapshot = {
  projectId: string;
  totalDelegations: number;
  completed: number;
  executing: number;
  pending: number;
  failed: number;
  delegations: DelegationRecord[];
  contextBlock: string;
};

export async function fetchCoordinatorSnapshot(projectId?: string): Promise<CoordinatorSnapshot> {
  const qs = projectId ? new URLSearchParams({ projectId }) : null;
  return fetchSemse<CoordinatorSnapshot>(`/api/semse/agents/coordinator-snapshot${qs ? `?${qs.toString()}` : ""}`);
}

export async function fetchDelegations(projectId?: string): Promise<DelegationRecord[]> {
  const qs = projectId ? new URLSearchParams({ projectId }) : null;
  const raw = await fetchSemse<DelegationRecord[] | { delegations: DelegationRecord[] }>(
    `/api/semse/agents/delegations${qs ? `?${qs.toString()}` : ""}`
  );
  return Array.isArray(raw) ? raw : (raw as { delegations: DelegationRecord[] }).delegations ?? [];
}

// ── Plan Templates ─────────────────────────────────────────────────────────────

export type PlanTemplateStep = {
  id: string;
  title: string;
  capability: string;
  toolsAllowed: string[];
  expectedOutcome: string;
  requiresApprovedPlan?: boolean;
};

export type PlanTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  goal: string;
  rationale: string;
  steps: PlanTemplateStep[];
  risks: string[];
  requiredEvidence: string[];
  successCriteria: string[];
};

export async function fetchPlanTemplates(category?: string): Promise<PlanTemplate[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return fetchSemse<PlanTemplate[]>(`/api/semse/agents/plan-templates${qs}`);
}

export async function fetchPlanTemplateById(templateId: string): Promise<PlanTemplate | null> {
  return fetchSemse<PlanTemplate | null>(`/api/semse/agents/plan-templates/${encodeURIComponent(templateId)}`);
}

// ── Agent Memories (workspace memory entries) ──────────────────────────────────

export type AgentMemoryKind =
  | "operator_note"
  | "repo_fact"
  | "runtime_fact"
  | "decision"
  | "run_summary"
  | "task_state";

export type AgentMemoryEntry = {
  id: string;
  tenantId: string;
  orgId: string;
  createdBy: string;
  workspaceId: string;
  repoId?: string;
  runId?: string;
  taskId?: string;
  kind: AgentMemoryKind;
  scope: string;
  title: string;
  summary: string;
  body?: string;
  tags: string[];
  sourceRef?: string;
  updatedAtIso: string;
};

export async function fetchAgentMemories(params?: {
  workspaceId?: string;
  kind?: string;
  agentId?: string;
  limit?: number;
}): Promise<AgentMemoryEntry[]> {
  const qs = new URLSearchParams();
  if (params?.workspaceId) qs.set("workspaceId", params.workspaceId);
  if (params?.kind) qs.set("kind", params.kind);
  if (params?.agentId) qs.set("agentId", params.agentId);
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString();
  return fetchSemse<AgentMemoryEntry[]>(`/api/semse/agents/memories${query ? `?${query}` : ""}`);
}

// ── Prometeo Engine ────────────────────────────────────────────────────────────

export type PrometeoDoc = {
  id: string; tenantId: string; orgId: string; projectId?: string | null;
  title: string; sourceType: string; sourceRef?: string | null;
  status: string; chunkCount: number; uploadedById: string;
  errorMsg?: string | null; metadataJson?: unknown;
  createdAt: string; updatedAt: string;
};

export type PrometeoSearchResult = {
  documentId: string; documentTitle: string; chunkId: string; chunkIndex: number;
  text: string; score: number; semanticScore?: number; textScore?: number;
  feedbackScore?: number; retrievalMode?: string;
};

export type RagCitation = {
  type: string;
  id: string;
  chunkId?: string;
  label: string;
  excerpt: string;
  chunkIndex?: number;
  score?: number;
};

export type FeedbackType = "confirm" | "correct" | "flag";

export async function submitChunkFeedback(input: {
  chunkId: string;
  type: FeedbackType;
  note?: string;
  query?: string;
}): Promise<{ recorded: boolean; id?: string }> {
  const res = await fetch(`/api/semse/prometeo/chunks/${encodeURIComponent(input.chunkId)}/feedback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: input.type, note: input.note, query: input.query }),
  });
  if (!res.ok) return { recorded: false };
  const json = await res.json() as { data?: { recorded: boolean; id?: string } };
  return json.data ?? { recorded: false };
}

export type PrometeoAsset = {
  id: string; name: string; category: string; status: string;
  serialNumber?: string | null; location?: string | null;
  projectId?: string | null; createdAt: string;
};

export type PrometeoWorkOrder = {
  id: string; title: string; description?: string | null;
  priority: string; status: string; assignedToId?: string | null;
  projectId?: string | null; jobId?: string | null;
  scheduledAt?: string | null; dueAt?: string | null;
  closedAt?: string | null; createdAt: string;
};

export type PrometeoRouteView = {
  intent: string;
  primaryAgent: string;
  supportingAgents: string[];
  contextRequired: string[];
  selectionSource: "intent" | "panel_agent";
  requestedAgentId?: string;
};

export type PrometeoOperationalContext = {
  mode: "demo" | "local" | "live";
  user: { id: string; role: string; tenantId: string; orgId: string };
  assistantSettings: {
    assistantTone?: string;
    assistantLanguage?: string;
    assistantVerbosity?: string;
    unifiedMode: boolean;
    expertMode: boolean;
  };
  activeProject: { id: string; title: string; status: string; jobId?: string } | null;
  preferredProfessional: {
    userId: string;
    displayName: string;
    publicSlug: string | null;
    selectedAt: string | null;
    trustScore: number | null;
    completedProjects: number | null;
    specialties: string[];
  } | null;
  jobs: { active: number; waitingProposals: number; completed: number; recent: Array<{ id: string; title: string; status: string }> };
  milestones: { active: number; pendingApproval: number; submitted: number };
  payments: { escrowFunded: number; escrowReleased: number; pendingRelease: number };
  evidences: { total: number; pendingReview: number; approved: number };
  disputes: { open: number; urgent: number };
  notifications: Array<{ id: string; type: string; body: string; createdAt: string }>;
  systemHealth: { api: "ok" | "degraded"; worker: "ok" | "degraded"; redis: "ok" | "degraded" };
  finance: {
    totalInvoiced: number; totalPaid: number; totalPending: number;
    totalExpenses: number; invoiceCount: number; expenseCount: number;
    margin: number | null; overdueCount: number;
    expensesByCategory: Record<string, number>;
  } | null;
  ecosystem5d: {
    scope: "tenant" | "project";
    tenantId: string;
    projectId: string | null;
    score: number;
    status: "strong" | "stable" | "watch" | "critical";
    dimensions: Array<{
      key: "execution" | "finance" | "evidence" | "trust" | "operations";
      label: string;
      score: number;
      status: "strong" | "stable" | "watch" | "critical";
      summary: string;
      signals: Array<{
        label: string;
        value: string;
        impact: "positive" | "neutral" | "negative";
      }>;
    }>;
    alerts: Array<{
      level: "critical" | "high" | "medium" | "info";
      dimension: "execution" | "finance" | "evidence" | "trust" | "operations";
      message: string;
      action: string;
    }>;
    generatedAt: string;
  } | null;
  risk: {
    overallScore: number;
    level: "low" | "medium" | "high" | "critical";
    disputeRisk: number;
    budgetOverrunRisk: number;
    scheduleRisk: number;
    recommendations: string[];
  } | null;
  generatedAt: string;
};

export type PrometeoChatResponse = {
  threadId: string;
  agentId: string;
  response: string;
  message?: string;
  blocks?: PrometeoResponseBlock[];
  proposedActions?: PrometeoProposedAction[];
  executionResults?: PrometeoToolExecutionResult[];
  mission?: PrometeoMissionState;
  citations?: PrometeoCitation[];
  refreshTargets?: string[];
  mode: "demo" | "runtime" | "report" | "context_only" | "fallback";
  route?: PrometeoRouteView;
  context?: PrometeoOperationalContext;
  timestamp: string;
  provider?: string;
  model?: string;
  modelSlug?: string;
  errorMessage?: string;
};

export type AiModelInteractionLog = {
  id: string;
  tenantId?: string | null;
  agentId?: string | null;
  projectId?: string | null;
  userId?: string | null;
  threadId?: string | null;
  taskType: string;
  provider: string;
  modelSlug: string;
  modelName?: string | null;
  inputLength: number;
  outputLength: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | string | null;
  latencyMs?: number | null;
  routeReason?: string | null;
  fallbackUsed: boolean;
  success: boolean;
  errorMessage?: string | null;
  mode: "runtime" | "report" | "context_only" | "fallback";
  createdAt: string;
};

export type AiModelInteractionStats = {
  total: number;
  success: number;
  failureRate: number;
  byModel: Record<string, number>;
  byTask: Record<string, number>;
  byMode: Record<string, number>;
};

export type AiModelReadiness = {
  generatedAt: string;
  llmOrchestrator: {
    hasProvider: boolean;
    providers: string[];
  };
  environment: {
    anthropicConfigured: boolean;
    openaiConfigured: boolean;
    deepseekConfigured: boolean;
    kimiConfigured: boolean;
    openSourceEnabled: boolean;
  };
  models: Array<{
    slug: string;
    displayName: string;
    modelName: string;
    provider: string;
    providerMode: string;
    enabled: boolean;
    bestFor: string[];
    supportsStreaming: boolean;
    supportsToolUse: boolean;
  }>;
  routeSamples: Array<{
    taskType: string;
    route: {
      primaryModelSlug: string;
      fallbackModelSlug?: string;
      validatorModelSlug?: string;
      reason: string;
    };
  }>;
};

export async function prometeoIngest(input: {
  title: string; text: string; sourceType?: string; projectId?: string; sourceRef?: string;
}): Promise<PrometeoDoc> {
  return mutateSemse<PrometeoDoc>("/api/semse/prometeo/ingest", input as Record<string, unknown>);
}

export async function prometeoListDocuments(projectId?: string): Promise<PrometeoDoc[]> {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return fetchSemse<PrometeoDoc[]>(`/api/semse/prometeo/documents${qs}`);
}

export async function prometeoSearch(input: {
  query: string; projectId?: string; topK?: number;
}): Promise<PrometeoSearchResult[]> {
  return mutateSemse<PrometeoSearchResult[]>("/api/semse/prometeo/search", input as Record<string, unknown>);
}

export async function prometeoListAssets(projectId?: string): Promise<PrometeoAsset[]> {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return fetchSemse<PrometeoAsset[]>(`/api/semse/prometeo/assets${qs}`);
}

export async function prometeoCreateAsset(input: {
  name: string; category?: string; projectId?: string; location?: string; serialNumber?: string;
}): Promise<PrometeoAsset> {
  return mutateSemse<PrometeoAsset>("/api/semse/prometeo/assets", input as Record<string, unknown>);
}

export async function prometeoListWorkOrders(projectId?: string, status?: string): Promise<PrometeoWorkOrder[]> {
  const qs = new URLSearchParams();
  if (projectId) qs.set("projectId", projectId);
  if (status) qs.set("status", status);
  const query = qs.toString();
  return fetchSemse<PrometeoWorkOrder[]>(`/api/semse/prometeo/work-orders${query ? `?${query}` : ""}`);
}

export async function prometeoCreateWorkOrder(input: {
  title: string; description?: string; priority?: string; projectId?: string; jobId?: string;
  assignedToId?: string; scheduledAt?: string; dueAt?: string;
}): Promise<PrometeoWorkOrder> {
  return mutateSemse<PrometeoWorkOrder>("/api/semse/prometeo/work-orders", input as Record<string, unknown>);
}

export async function fetchPrometeoOperationalContext(projectId?: string): Promise<PrometeoOperationalContext> {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return fetchSemse<PrometeoOperationalContext>(`/api/semse/cortex/context${qs}`);
}

export type ContextUpdateEvent = {
  tenantId: string;
  projectId: string | null;
  userId: string | null;
  scope: "tenant" | "project" | "user";
  source: string;
  reason: string;
  invalidatedKeys: number;
  ts: number;
};

export function subscribeToContextUpdates(input: {
  projectId?: string;
  onUpdate: (event: ContextUpdateEvent) => void;
  onStreamError?: () => void;
}): () => void {
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    return () => undefined;
  }

  const qs = input.projectId ? `?projectId=${encodeURIComponent(input.projectId)}` : "";
  const es = new EventSource(`/api/semse/cortex/context/stream${qs}`);

  es.addEventListener("context-update", (raw) => {
    try {
      const data = JSON.parse(raw.data) as ContextUpdateEvent;
      input.onUpdate(data);
    } catch {
      // ignore malformed SSE payloads
    }
  });

  es.addEventListener("stream-error", () => {
    input.onStreamError?.();
    es.close();
  });

  return () => es.close();
}

export type PrometeoChatInput = {
  message?: string;
  agentId?: string;
  threadId?: string;
  projectId?: string;
  missionId?: string;
  requestedAction?: string;
  requestedActionInput?: Record<string, unknown>;
  attachments?: PrometeoAttachment[];
  selectedEntities?: PrometeoEntityReference[];
  pageContext?: PrometeoPageContext;
  context?: unknown;
};

export async function chatWithPrometeo(input: PrometeoChatInput): Promise<PrometeoChatResponse> {
  return mutateSemse<PrometeoChatResponse>("/api/semse/cortex/chat", input as Record<string, unknown>);
}

export async function fetchPrometeoToolRegistry(): Promise<{ generatedAt: string; tools: PrometeoToolDescriptor[] }> {
  return fetchSemse<{ generatedAt: string; tools: PrometeoToolDescriptor[] }>("/api/semse/prometeo/tools");
}

export async function invokePrometeoTool(input: PrometeoToolInvokeInput): Promise<PrometeoToolExecutionResult> {
  return mutateSemse<PrometeoToolExecutionResult>("/api/semse/prometeo/tools/invoke", input);
}

export async function createPrometeoMission(input: PrometeoMissionCreateInput): Promise<PrometeoMissionState> {
  return mutateSemse<PrometeoMissionState>(
    "/api/semse/prometeo/missions",
    input as Record<string, unknown>,
  );
}

export async function fetchPrometeoMission(missionId: string): Promise<PrometeoMissionState> {
  return fetchSemse<PrometeoMissionState>(
    `/api/semse/prometeo/missions/${encodeURIComponent(missionId)}`,
  );
}

export async function decidePrometeoMission(
  missionId: string,
  decision: "approve" | "reject" | "cancel",
): Promise<PrometeoMissionState> {
  return mutateSemse<PrometeoMissionState>(
    `/api/semse/prometeo/missions/${encodeURIComponent(missionId)}/${decision}`,
  );
}

export async function checkpointPrometeoMission(
  missionId: string,
  stepId: string,
  input: PrometeoMissionCheckpointInput,
): Promise<PrometeoMissionState> {
  return mutateSemse<PrometeoMissionState>(
    `/api/semse/prometeo/missions/${encodeURIComponent(missionId)}/steps/${encodeURIComponent(stepId)}/checkpoint`,
    input as Record<string, unknown>,
  );
}

export async function fetchAiModelLogs(
  limit = 50,
  source: "db" | "buffer" = "db",
): Promise<AiModelInteractionLog[]> {
  return fetchSemse<AiModelInteractionLog[]>(
    `/api/semse/ai-models/logs?limit=${encodeURIComponent(String(limit))}&source=${encodeURIComponent(source)}`,
  );
}

export async function fetchAiModelLogStats(): Promise<AiModelInteractionStats> {
  return fetchSemse<AiModelInteractionStats>("/api/semse/ai-models/logs/stats");
}

export async function fetchAiModelReadiness(): Promise<AiModelReadiness> {
  return fetchSemse<AiModelReadiness>("/api/semse/ai-models/readiness");
}

export type MissionIncidentSeverity = "critical" | "high" | "medium" | "info";
export type MissionIncidentSource = "bootstrap" | "manual" | "poll" | "health-stream" | "context-stream";

export type MissionIncident = {
  id: string;
  tenantId?: string;
  source: MissionIncidentSource;
  posture: string;
  severity: MissionIncidentSeverity;
  title: string;
  detail: string;
  alertIds: string[];
  createdAt: string;
};

export async function fetchAiMissionIncidents(limit = 20): Promise<MissionIncident[]> {
  return fetchSemse<MissionIncident[]>(`/api/semse/ai-models/incidents?limit=${encodeURIComponent(String(limit))}`);
}

export async function postAiMissionIncident(incident: Omit<MissionIncident, "id" | "createdAt">): Promise<MissionIncident> {
  return fetchSemse<MissionIncident>("/api/semse/ai-models/incidents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(incident),
  });
}

export function subscribeToMissionControlEvents(onIncident: (incident: MissionIncident) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const es = new EventSource("/api/semse/sse/mission-control");
  es.addEventListener("mission-incident", (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data) as MissionIncident;
      onIncident(data);
    } catch { /* ignore malformed */ }
  });
  return () => es.close();
}

// ── Finance & Document Tools ──────────────────────────────────────────────────

export type InvoiceLineItem = {
  description: string; qty: number; unitPrice: number; taxRate: number; total: number;
};

export type InvoiceStatus = "draft" | "sent" | "viewed" | "approved" | "paid" | "overdue" | "cancelled";

export type Invoice = {
  id: string; tenantId: string; orgId: string; clientOrgId: string | null;
  projectId: string | null; jobId: string | null; createdBy: string;
  number: string; title: string; status: InvoiceStatus;
  lineItems: InvoiceLineItem[]; subtotal: number; taxAmount: number; total: number;
  currency: string; dueDate: string | null; paidAt: string | null;
  sentAt: string | null; viewedAt: string | null;
  notes: string | null; terms: string | null; pdfUrl: string | null;
  createdAt: string; updatedAt: string;
};

export type ExpenseCategory =
  | "materials" | "labor" | "tools" | "transport" | "permits"
  | "subcontractors" | "maintenance" | "equipment" | "unexpected" | "other";

export type ExpenseStatus = "pending" | "approved" | "rejected" | "reimbursed" | "archived";

export type ProjectExpense = {
  id: string; tenantId: string; orgId: string; projectId: string | null;
  milestoneId: string | null; jobId: string | null; invoiceId: string | null;
  submittedBy: string; category: ExpenseCategory; subcategory: string | null;
  description: string; amount: number; currency: string;
  vendor: string | null; expenseDate: string;
  receiptUrl: string | null; receiptText: string | null;
  status: ExpenseStatus; approvedBy: string | null; approvedAt: string | null;
  isDuplicate: boolean; duplicateOfId: string | null;
  notes: string | null; createdAt: string; updatedAt: string;
};

export type DocumentTemplate = {
  id: string; tenantId: string; orgId: string; createdBy: string;
  name: string; category: string; bodyJson: Record<string, unknown>;
  isActive: boolean; createdAt: string; updatedAt: string;
};

export type ProjectFinancialSummary = {
  projectId: string; tenantId: string;
  escrowFunded: number; escrowReleased: number; pendingRelease: number;
  totalInvoiced: number; totalPaid: number; totalPending: number;
  totalExpenses: number; expensesByCategory: Record<string, number>;
  invoiceCount: number; expenseCount: number;
  margin: number | null; currency: string;
};

export async function fetchInvoices(params?: {
  projectId?: string; status?: InvoiceStatus; limit?: number;
}): Promise<Invoice[]> {
  const qs = new URLSearchParams();
  if (params?.projectId) qs.set("projectId", params.projectId);
  if (params?.status) qs.set("status", params.status);
  if (params?.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  return fetchSemse<Invoice[]>(`/api/semse/finance/invoices${q ? `?${q}` : ""}`);
}

export async function createInvoice(input: {
  title: string; lineItems: InvoiceLineItem[];
  projectId?: string; clientOrgId?: string; jobId?: string;
  currency?: string; dueDate?: string; notes?: string; terms?: string;
}): Promise<Invoice> {
  return mutateSemse<Invoice>("/api/semse/finance/invoices", input as Record<string, unknown>);
}

export async function sendInvoice(id: string): Promise<Invoice> {
  return mutateSemse<Invoice>(`/api/semse/finance/invoices/${encodeURIComponent(id)}/send`, {});
}

export async function markInvoicePaid(id: string): Promise<Invoice> {
  return mutateSemse<Invoice>(`/api/semse/finance/invoices/${encodeURIComponent(id)}/pay`, {});
}

export function getInvoicePdfUrl(id: string, type?: "estimate" | "invoice"): string {
  const qs = type ? `?type=${encodeURIComponent(type)}` : "";
  return `/api/semse/finance/invoices/${encodeURIComponent(id)}/pdf${qs}`;
}

export async function fetchExpenses(params?: {
  projectId?: string; category?: ExpenseCategory; status?: ExpenseStatus; limit?: number;
}): Promise<ProjectExpense[]> {
  const qs = new URLSearchParams();
  if (params?.projectId) qs.set("projectId", params.projectId);
  if (params?.category) qs.set("category", params.category);
  if (params?.status) qs.set("status", params.status);
  if (params?.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  return fetchSemse<ProjectExpense[]>(`/api/semse/finance/expenses${q ? `?${q}` : ""}`);
}

export async function createExpense(input: {
  description: string; amount: number; category: ExpenseCategory;
  projectId?: string; milestoneId?: string; vendor?: string;
  expenseDate?: string; receiptUrl?: string; receiptText?: string;
  subcategory?: string; notes?: string;
}): Promise<ProjectExpense> {
  return mutateSemse<ProjectExpense>("/api/semse/finance/expenses", input as Record<string, unknown>);
}

export async function approveExpense(id: string): Promise<ProjectExpense> {
  return mutateSemse<ProjectExpense>(`/api/semse/finance/expenses/${encodeURIComponent(id)}/approve`, {});
}

export async function rejectExpense(id: string): Promise<ProjectExpense> {
  return mutateSemse<ProjectExpense>(`/api/semse/finance/expenses/${encodeURIComponent(id)}/reject`, {});
}

export async function fetchTemplates(category?: string): Promise<DocumentTemplate[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return fetchSemse<DocumentTemplate[]>(`/api/semse/finance/templates${qs}`);
}

export async function fetchProjectFinancialSummary(projectId: string): Promise<ProjectFinancialSummary> {
  return fetchSemse<ProjectFinancialSummary>(`/api/semse/finance/projects/${encodeURIComponent(projectId)}/summary`);
}

// ── PMO & Intelligence ────────────────────────────────────────────────────────

export type PmoAlert = {
  id: string; projectId: string; projectTitle: string;
  level: "critical" | "high" | "medium" | "info";
  category: "dispute" | "budget" | "schedule" | "escrow" | "evidence" | "stale";
  message: string; action: string; detectedAt: string;
};

export type PmoProjectCard = {
  projectId: string; jobTitle: string; status: string; contractorOrg: string;
  riskScore: number; riskLevel: string; escrowFunded: number; pendingRelease: number;
  openDisputes: number; pendingMilestones: number; pendingEvidence: number;
  daysSinceActivity: number; alerts: PmoAlert[];
};

export type PmoDashboard = {
  tenantId: string; generatedAt: string;
  summary: {
    totalProjects: number; activeProjects: number; totalEscrow: number;
    pendingRelease: number; criticalProjects: number; highRiskProjects: number;
    openDisputes: number; totalAlerts: number;
  };
  projects: PmoProjectCard[];
  topAlerts: PmoAlert[];
};

export type BudgetSuggestion = {
  min: number; max: number; median: number; currency: string;
  confidence: "high" | "medium" | "low";
  basis: string; similarJobsFound: number;
  factors: Array<{ name: string; impact: "increases" | "decreases" | "neutral"; note: string }>;
  aiNarrative: string; calculatedAt: string;
};

export type CredentialBadge =
  | "top_rated" | "zero_disputes" | "fast_deliverer" | "high_volume" | "verified" | "elite";

export type ProfessionalCredentialRecord = {
  id: string; tenantId: string; userId: string; orgId: string | null;
  displayName: string; completedProjects: number; activeProjects: number;
  totalManaged: number; onTimeRate: number; disputeRate: number;
  avgClientRating: number; trustScore: number; specialties: string[];
  badges: CredentialBadge[]; verifiedAt: string | null;
  lastActivityAt: string | null; publicSlug: string | null; updatedAt: string;
};

export async function fetchPmoDashboard(): Promise<PmoDashboard> {
  return fetchSemse<PmoDashboard>("/api/semse/intelligence/pmo/dashboard");
}

export async function fetchPmoAlerts(): Promise<PmoAlert[]> {
  return fetchSemse<PmoAlert[]>("/api/semse/intelligence/pmo/alerts");
}

export async function suggestBudget(input: {
  title: string; scope: string; category?: string; location?: string;
}): Promise<BudgetSuggestion> {
  return mutateSemse<BudgetSuggestion>("/api/semse/intelligence/budget/suggest", input as Record<string, unknown>);
}

export async function archiveProject(projectId: string): Promise<Record<string, unknown>> {
  return mutateSemse<Record<string, unknown>>(`/api/semse/intelligence/projects/${encodeURIComponent(projectId)}/archive`, {});
}

export async function fetchProjectRisk(projectId: string): Promise<{
  overallScore: number; level: string; disputeRisk: number; budgetOverrunRisk: number;
  scheduleRisk: number; recommendations: string[];
}> {
  return fetchSemse(`/api/semse/intelligence/projects/${encodeURIComponent(projectId)}/risk`);
}

export type ExtractedReceipt = {
  vendor: string | null;
  amount: number | null;
  currency: string;
  date: string | null;
  category: ExpenseCategory;
  description: string;
  taxAmount: number | null;
  paymentMethod: string | null;
  receiptNumber: string | null;
  lineItems: Array<{ description: string; amount: number }>;
  confidence: "high" | "medium" | "low";
  rawText: string;
};

export async function scanReceipt(input: {
  receiptText?: string;
  receiptUrl?: string;
  hint?: string;
}): Promise<ExtractedReceipt> {
  return mutateSemse<ExtractedReceipt>("/api/semse/finance/expenses/scan", input as Record<string, unknown>);
}

// ── Contractor CRM ────────────────────────────────────────────────────────────

export type LeadStatus =
  | "new" | "contacted" | "estimate_sent" | "estimate_approved"
  | "in_progress" | "completed" | "lost";

export type LeadUrgency = "asap" | "this_week" | "this_month" | "flexible";
export type LeadSource = "referral" | "nextdoor" | "facebook" | "call" | "website" | "other";

export type ContractorLead = {
  id: string;
  tenantId: string;
  orgId: string;
  createdBy: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  jobType: string | null;
  description: string | null;
  budgetRange: string | null;
  urgency: LeadUrgency | null;
  status: LeadStatus;
  notes: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  jobId: string | null;
  projectId: string | null;
  source: LeadSource | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadStats = {
  total: number;
  new: number;
  contacted: number;
  estimate_sent: number;
  estimate_approved: number;
  in_progress: number;
  completed: number;
  lost: number;
};

export async function fetchLeads(params?: { status?: LeadStatus; search?: string; limit?: number }): Promise<ContractorLead[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.search) qs.set("search", params.search);
  if (params?.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  return fetchSemse<ContractorLead[]>(`/api/semse/contractor/leads${q ? `?${q}` : ""}`);
}

export async function fetchLeadStats(): Promise<LeadStats> {
  return fetchSemse<LeadStats>("/api/semse/contractor/leads/stats");
}

export async function createLead(input: Partial<Omit<ContractorLead, "id" | "tenantId" | "orgId" | "createdBy" | "createdAt" | "updatedAt">> & { name: string }): Promise<ContractorLead> {
  return mutateSemse<ContractorLead>("/api/semse/contractor/leads", input as Record<string, unknown>);
}

export async function updateLead(id: string, patch: Partial<ContractorLead>): Promise<ContractorLead> {
  return patchSemse<ContractorLead>(`/api/semse/contractor/leads/${encodeURIComponent(id)}`, patch as Record<string, unknown>);
}

export async function deleteLead(id: string): Promise<void> {
  await fetchSemse<unknown>(`/api/semse/contractor/leads/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export type SuggestedLineItem = {
  description: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
  total: number;
  category: "materials" | "labor" | "other";
};

export async function suggestEstimateForLead(leadId: string): Promise<SuggestedLineItem[]> {
  return mutateSemse<SuggestedLineItem[]>(`/api/semse/contractor/leads/${encodeURIComponent(leadId)}/suggest-estimate`, {});
}

export async function createEstimateFromLead(leadId: string, input: {
  lineItems: SuggestedLineItem[];
  dueDate?: string;
  notes?: string;
  terms?: string;
}): Promise<Invoice> {
  return mutateSemse<Invoice>(`/api/semse/contractor/leads/${encodeURIComponent(leadId)}/create-estimate`, input as Record<string, unknown>);
}

// ── Conversational Project Builder ────────────────────────────────────────────

export type ProjectDraftSnapshot = {
  id: string;
  status: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  title?: string | null;
  description?: string | null;
  city?: string | null;
  locationType?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  urgency?: string | null;
  attachmentsExpected?: boolean;
  publishedJobId?: string | null;
  completion: number;
};

export type AssistantPublishFromDraftResponse = {
  jobId: string;
  draft: ProjectDraftSnapshot;
  jobUrl: string;
};

export type AssistantBudgetSuggestion = {
  min: number;
  max: number;
  median: number;
  confidence: "high" | "medium" | "low";
  aiNarrative: string;
};

export type AssistantPublishJobResponse = {
  reply: string;
  draftId: string;
  draft: ProjectDraftSnapshot;
  prefillHref: string;
  completion: number;
  sessionId: string;
  readyToFill: boolean;
  budgetSuggestion?: AssistantBudgetSuggestion;
};

export type AssistantConfirmDraftResponse = {
  draft: ProjectDraftSnapshot;
  prefillHref: string;
};

export async function assistantPublishJob(input: {
  message: string;
  draftId?: string;
  sessionId?: string;
  pageRoute?: string;
}): Promise<AssistantPublishJobResponse> {
  return mutateSemse<AssistantPublishJobResponse>("/api/semse/assistant/publish-job", input as Record<string, unknown>);
}

export async function assistantConfirmDraft(draftId: string): Promise<AssistantConfirmDraftResponse> {
  return mutateSemse<AssistantConfirmDraftResponse>("/api/semse/assistant/confirm-draft", { draftId } as Record<string, unknown>);
}

export async function assistantPublishFromDraft(draftId: string): Promise<AssistantPublishFromDraftResponse> {
  return mutateSemse<AssistantPublishFromDraftResponse>("/api/semse/assistant/publish-from-draft", { draftId } as Record<string, unknown>);
}

// ── Contractor Rate Override ──────────────────────────────────────────────────

export type ContractorRateOverrideView = {
  userId:              string;
  laborRatePerHr:      number;
  materialMarkup:      number;
  laborMultiplier:     number;
  materialMultiplier:  number;
  notes?:              string;
  updatedAt:           string;
};

export type ContractorRateStatus = {
  override:                   ContractorRateOverrideView | null;
  nationalBaselineHourlyRate: number;
  hasCustomRates:             boolean;
};

export async function fetchMyLaborRates(): Promise<ContractorRateStatus> {
  return fetchSemse<ContractorRateStatus>("/api/semse/pricing/labor-rates");
}

export async function saveMyLaborRates(input: {
  laborRatePerHr: number;
  materialMarkup: number;
  notes?: string;
}): Promise<{ override: ContractorRateOverrideView; saved: boolean }> {
  return fetchSemse("/api/semse/pricing/labor-rates", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteMyLaborRates(): Promise<{ deleted: boolean; revertedToBls: boolean }> {
  return fetchSemse("/api/semse/pricing/labor-rates", { method: "DELETE" });
}

// ── Stripe Connect ────────────────────────────────────────────────────────────

export type StripeConnectAccountView = {
  userId:          string;
  stripeAccountId: string;
  status:          string;  // pending | active | restricted | disabled
  chargesEnabled:  boolean;
  payoutsEnabled:  boolean;
  onboardingUrl:   string | null;
  country:         string;
  currency:        string;
  updatedAt:       string;
};

export async function fetchMyConnectAccount(): Promise<{
  account: StripeConnectAccountView | null;
  platformFeeRate: number;
}> {
  return fetchSemse("/api/semse/payments/connect/account");
}

export async function createMyConnectAccount(email?: string): Promise<{
  account: StripeConnectAccountView;
  created: boolean;
}> {
  return mutateSemse("/api/semse/payments/connect/account", email ? { email } : {});
}

export async function createOnboardingLink(input?: { returnUrl?: string; refreshUrl?: string }): Promise<{
  stripeAccountId: string;
  onboardingUrl:   string;
  expiresAt:       string;
}> {
  return mutateSemse("/api/semse/payments/connect/onboarding-link", input ?? {});
}

export async function syncConnectAccount(): Promise<{
  account: StripeConnectAccountView;
  synced: boolean;
}> {
  return mutateSemse("/api/semse/payments/connect/sync", {});
}

export type PaymentRailReadiness = {
  key: string;
  label: string;
  clientFunding: boolean;
  professionalPayout: boolean;
  automatic: boolean;
  configured: boolean;
  ready: boolean;
  requiredEnv: string[];
};

export type PaymentProviderReadiness = {
  configuredDefaultProvider: string;
  availableProviders: string[];
  rails: PaymentRailReadiness[];
  mode: "mock" | "live";
  ready: boolean;
  warnings: string[];
};

export async function fetchPaymentProviderReadiness(): Promise<PaymentProviderReadiness> {
  return fetchSemse<PaymentProviderReadiness>("/api/semse/payments/provider-readiness");
}

// ── Browser Agent ─────────────────────────────────────────────────────────────

export interface BrowserInspectionResult {
  runId: string;
  status: string;
  url: string;
  projectId?: string;
  milestoneId?: string;
  success?: boolean;
  finalUrl?: string;
  title?: string;
  pageStatus?: string;
  severity?: string;
  loadTimeMs?: number;
  consoleErrors?: Array<{ text: string; location?: { url: string; lineNumber: number; columnNumber?: number } }>;
  networkFailures?: Array<{ url: string; method: string; status?: number; statusText?: string; errorText?: string }>;
  visibleTextSample?: string;
  screenshotBase64?: string;
  aiSummary?: {
    summary_es: string;
    summary_en: string;
    severity: string;
    recommendations: string[];
    github_issue_body?: string;
    claude_fix_prompt?: string;
  };
  createdAt: string;
  completedAt?: string;
}

export async function startBrowserInspection(input: {
  url: string;
  projectId?: string;
  milestoneId?: string;
  includeScreenshot?: boolean;
  includeText?: boolean;
  includeAiSummary?: boolean;
}): Promise<{ runId: string; status: string; correlationId: string }> {
  return mutateSemse<{ runId: string; status: string; correlationId: string }>(
    "/api/semse/browser-agent/inspect",
    input as Record<string, unknown>
  );
}

export async function fetchBrowserInspectionResult(runId: string): Promise<BrowserInspectionResult> {
  return fetchSemse<BrowserInspectionResult>(`/api/semse/browser-agent/inspect/${encodeURIComponent(runId)}`);
}

export interface BrowserMissionStep {
  id: string;
  missionId: string;
  stepNumber: number;
  actionType: "navigate" | "get_markdown" | "query" | "click" | "fill" | string;
  parameters: any;
  engineUsed: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | string;
  error?: string;
  evidenceRef?: string;
  createdAt: string;
}

export interface BrowserMission {
  id: string;
  tenantId: string;
  actorId: string;
  status: "PLANNED" | "RUNNING" | "COMPLETED" | "FAILED" | string;
  goal: string;
  budgetLimit: number;
  budgetSpent: number;
  createdAt: string;
  updatedAt: string;
  steps: BrowserMissionStep[];
}

export async function createBrowserMission(input: {
  goal: string;
  steps: Array<{
    actionType: string;
    parameters?: any;
    engineUsed?: string;
  }>;
}): Promise<{ missionId: string; runId: string; stepsCount: number }> {
  return mutateSemse<{ missionId: string; runId: string; stepsCount: number }>(
    "/api/semse/browser-agent/missions",
    input as Record<string, unknown>
  );
}

export async function fetchBrowserMission(id: string): Promise<BrowserMission> {
  return fetchSemse<BrowserMission>(`/api/semse/browser-agent/missions/${encodeURIComponent(id)}`);
}

export interface ActivityEvent {
  id: string;
  type: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  occurredAt: string;
  entityType: string;
  entityId: string;
}

export async function fetchBuildOpsProjects(): Promise<Record<string, unknown>[]> {
  const result = await fetchSemse<Record<string, unknown>[] | { data: Record<string, unknown>[] }>("/api/semse/buildops/projects");
  return Array.isArray(result) ? result : ((result as { data: Record<string, unknown>[] }).data ?? []);
}

export async function fetchProjectActivity(buildOpsProjectId: string, limit = 40): Promise<ActivityEvent[]> {
  const envelope = await fetchSemse<{ data: ActivityEvent[] }>(
    `/api/semse/buildops/projects/${encodeURIComponent(buildOpsProjectId)}/activity?limit=${limit}`
  );
  return Array.isArray(envelope)
    ? (envelope as ActivityEvent[])
    : ((envelope as { data: ActivityEvent[] }).data ?? []);
}

// ── Agro ─────────────────────────────────────────────────────────────────────

export type AgroFarm = {
  id: string;
  name: string;
  operationType: "LIVESTOCK" | "MIXED" | "CROP";
  locationLabel: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgroFarmUnit = {
  id: string;
  farmId: string;
  name: string;
  type: string;
  areaValue: string | null;
  areaUnit: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listFarms(): Promise<AgroFarm[]> {
  const data = await fetchSemse<AgroFarm[]>("/api/semse/agro");
  return Array.isArray(data) ? data : [];
}

export async function createFarm(input: {
  name: string;
  operationType?: string;
  locationLabel?: string;
  notes?: string;
}): Promise<AgroFarm> {
  return fetchSemse<AgroFarm>("/api/semse/agro", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getFarm(farmId: string): Promise<AgroFarm> {
  return fetchSemse<AgroFarm>(`/api/semse/agro/${encodeURIComponent(farmId)}`);
}

export async function updateFarm(farmId: string, input: Partial<Pick<AgroFarm, "name" | "operationType" | "locationLabel" | "notes">>): Promise<AgroFarm> {
  return fetchSemse<AgroFarm>(`/api/semse/agro/${encodeURIComponent(farmId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function listFarmUnits(farmId: string): Promise<AgroFarmUnit[]> {
  const data = await fetchSemse<AgroFarmUnit[]>(`/api/semse/agro/${encodeURIComponent(farmId)}/units`);
  return Array.isArray(data) ? data : [];
}

export async function createFarmUnit(farmId: string, input: {
  name: string;
  type?: string;
  areaValue?: number;
  areaUnit?: string;
  notes?: string;
}): Promise<AgroFarmUnit> {
  return fetchSemse<AgroFarmUnit>(`/api/semse/agro/${encodeURIComponent(farmId)}/units`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateFarmUnit(unitId: string, input: {
  name?: string;
  type?: string;
  areaValue?: number;
  areaUnit?: string;
  notes?: string;
}): Promise<AgroFarmUnit> {
  return fetchSemse<AgroFarmUnit>(`/api/semse/agro/farm-units/${encodeURIComponent(unitId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}
