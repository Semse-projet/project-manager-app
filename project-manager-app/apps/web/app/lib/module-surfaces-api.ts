/**
 * Client-side wrappers for the liens, forge and satellites BFF routes
 * (apps/web/app/api/semse/{liens,forge,satellites,admin/liens}/**). Components
 * call these functions; they never build NestJS URLs themselves.
 *
 * Types mirror the API's real response shapes:
 * - liens: apps/api/src/modules/liens/*.controller.ts + LienCalendar/LienNotice/LienWaiver in schema.prisma
 * - forge: packages/forge/src/types.ts (ForgeRun) + ForgeRepository.missionControlSummary
 * - satellites: SatellitesService.listTokens/issueToken + SatelliteWebhookView
 */

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init });
  const payload = (await response.json().catch(() => ({}))) as { data?: T; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `La solicitud falló (${response.status})`);
  }
  return payload.data as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });

const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

const seg = encodeURIComponent;

/* ───────────────────────────── Projects (picker) ───────────────────────────── */

export type CanonicalProject = {
  id: string;
  jobId: string;
  assignedProOrgId: string;
  status: string;
};

export const fetchCanonicalProjects = () => request<CanonicalProject[]>("/api/semse/projects");

/* ───────────────────────────────── Liens ───────────────────────────────── */

export type LienCalendarStatus =
  | "CREATED"
  | "ALERTED_30D"
  | "ALERTED_7D"
  | "ALERTED_3D"
  | "NOTICE_SENT"
  | "NOTICE_DELIVERED"
  | "NOTICE_FAILED";

export type LienRecipientType = "owner" | "general_contractor" | "lender" | "architect";

export type LienNotice = {
  id: string;
  lienCalendarId: string;
  noticeType: string;
  recipientType: LienRecipientType | string;
  generatedAt: string;
  sentVia: string;
  lobLetterTrackingId?: string | null;
  lobLetterUrl?: string | null;
  sentAt?: string | null;
  status: string;
  deliveredAt?: string | null;
  createdAt: string;
};

export type LienCalendar = {
  id: string;
  projectId: string;
  stateName: string;
  preliminaryNoticeDeadline: string;
  waiverDeadline: string;
  finalNoticeDeadline?: string | null;
  statusLienDeadline?: string | null;
  status: LienCalendarStatus | string;
  requiresNotary: boolean;
  requiresCertifiedMail: boolean;
  notices?: LienNotice[];
  createdAt: string;
  updatedAt: string;
};

export type LienWaiver = {
  id: string;
  lienCalendarId: string;
  stateName?: string | null;
  waiverType: "conditional" | "unconditional" | string;
  releaseAmount?: string | number | null;
  requiredBefore: string;
  status: "PENDING" | "SIGNED" | "REJECTED" | "EXPIRED" | string;
  signingUrl?: string | null;
};

export type LienNoticePreview = Record<string, unknown> & { html?: string; content?: string; noticeContent?: string };

const liensBase = (projectId: string) => `/api/semse/liens/${seg(projectId)}`;

export const fetchLienCalendars = (projectId: string) => request<LienCalendar[]>(`${liensBase(projectId)}/calendar`);

export const createLienCalendar = (projectId: string, input: { stateName: string; projectStartDate: string }) =>
  post<LienCalendar>(`${liensBase(projectId)}/calendar`, input);

export const generateLienNotices = (projectId: string, calendarId: string, recipientType?: LienRecipientType) =>
  post<LienNotice | LienNotice[]>(
    `${liensBase(projectId)}/calendar/${seg(calendarId)}/generate-notice`,
    recipientType ? { recipientType } : {}
  );

export const fetchLienNotices = (projectId: string) => request<LienNotice[]>(`${liensBase(projectId)}/notices`);

export const fetchLienNoticePreview = (projectId: string, noticeId: string) =>
  request<LienNoticePreview>(`${liensBase(projectId)}/notices/${seg(noticeId)}/preview`);

export const sendLienNotice = (projectId: string, noticeId: string) =>
  post<LienNotice>(`${liensBase(projectId)}/notices/${seg(noticeId)}/send`);

export const fetchLienWaivers = (projectId: string) => request<LienWaiver[]>(`${liensBase(projectId)}/waivers`);

export const signLienWaiver = (projectId: string, waiverId: string, signature: string) =>
  post<LienWaiver>(`${liensBase(projectId)}/waivers/${seg(waiverId)}/sign`, { signature });

export const runLienDeadlineCheck = () =>
  post<{ success: boolean; message: string }>("/api/semse/admin/liens/check-deadlines");

/* ───────────────────────────────── Forge ───────────────────────────────── */

export type ForgeRunState =
  | "idea"
  | "intake"
  | "spec_draft"
  | "spec_review"
  | "approved"
  | "planned"
  | "building"
  | "verifying"
  | "ready_for_review"
  | "merged"
  | "deployed"
  | "observing"
  | "closed"
  | "blocked"
  | "rolled_back";

export type ForgeSpecStatus = "DRAFT" | "REVIEW" | "APPROVED" | "IMPLEMENTED" | "VERIFIED";
export type ForgeApprovalMode = "none" | "creator_review" | "ops_admin" | "security" | "dual_control";
export type ForgeTaskStatus =
  | "pending"
  | "ready"
  | "running"
  | "blocked_on_dependency"
  | "blocked_on_approval"
  | "succeeded"
  | "failed"
  | "cancelled";

export type ForgeTask = {
  id: string;
  title: string;
  requestedRole: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  objective: string;
  dependencies: string[];
  targetBranch: string;
  environment: string;
  status?: ForgeTaskStatus;
  priority?: number;
  acceptanceCriteria?: Array<{ id: string; statement: string; required: boolean }>;
};

export type ForgeApproval = {
  mode: ForgeApprovalMode;
  status: "pending" | "approved" | "rejected";
  actor?: string;
  at?: string;
  requestedBy?: string;
  approvedBy?: string[];
};

export type ForgeEvent = {
  id: string;
  type: string;
  runId: string;
  timestamp: string;
  actor: string;
  detail: Record<string, unknown>;
};

export type ForgeRun = {
  id: string;
  title: string;
  state: ForgeRunState;
  spec: { id: string; path: string; digest: string; status: ForgeSpecStatus };
  tasks: ForgeTask[];
  assignedAgents: Record<string, string[]>;
  approvals: ForgeApproval[];
  events: ForgeEvent[];
  agentRunIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ForgeMissionControl = {
  total: number;
  blocked: number;
  pendingApprovals: number;
  readyForReview: number;
  recent: ForgeRun[];
};

/**
 * Mirror of packages/forge/src/state-machine.ts `forgeRunTransitions`. The
 * web app does not depend on @semse/forge; the API remains the authority and
 * rejects any transition not in its own table. Keep in sync when the FSM
 * (docs/specs/fsm/forge-run-lifecycle.spec.md) changes.
 */
export const FORGE_RUN_TRANSITIONS: Record<ForgeRunState, readonly ForgeRunState[]> = {
  idea: ["intake", "blocked"],
  intake: ["spec_draft", "blocked"],
  spec_draft: ["spec_review", "blocked"],
  spec_review: ["approved", "spec_draft", "blocked"],
  approved: ["planned", "blocked"],
  planned: ["building", "blocked"],
  building: ["verifying", "blocked", "rolled_back"],
  verifying: ["ready_for_review", "building", "blocked", "rolled_back"],
  ready_for_review: ["merged", "building", "blocked"],
  merged: ["deployed", "closed", "rolled_back"],
  deployed: ["observing", "rolled_back", "blocked"],
  observing: ["closed", "rolled_back", "blocked"],
  closed: [],
  blocked: ["intake", "spec_draft", "spec_review", "planned", "building", "verifying", "rolled_back"],
  rolled_back: ["spec_draft", "planned", "closed"]
};

export const fetchForgeMissionControl = () => request<ForgeMissionControl>("/api/semse/forge/mission-control");
export const fetchForgeRuns = () => request<ForgeRun[]>("/api/semse/forge/runs");
export const fetchForgeRun = (runId: string) => request<ForgeRun>(`/api/semse/forge/runs/${seg(runId)}`);
export const fetchForgeRunnableTasks = (runId: string) =>
  request<ForgeTask[]>(`/api/semse/forge/runs/${seg(runId)}/tasks/runnable`);

export const createForgeRun = (input: {
  title: string;
  spec: { id: string; path: string; digest: string; status: ForgeSpecStatus };
}) => post<ForgeRun>("/api/semse/forge/runs", input);

export const transitionForgeRun = (runId: string, next: ForgeRunState) =>
  post<ForgeRun>(`/api/semse/forge/runs/${seg(runId)}/transitions`, { next });

export const dispatchNextForgeTask = (runId: string) =>
  post<Record<string, unknown>>(`/api/semse/forge/runs/${seg(runId)}/dispatch-next`);

export const decideForgeApproval = (runId: string, mode: ForgeApprovalMode, decision: "approved" | "rejected") =>
  post<ForgeRun>(`/api/semse/forge/runs/${seg(runId)}/approvals/${seg(mode)}/decide`, { decision });

/* ─────────────────────────────── Satellites ─────────────────────────────── */

/** Mirror of SATELLITE_SCOPE_CATALOG (apps/api/src/modules/satellites/satellites.service.ts). */
export const SATELLITE_SCOPES = [
  "intake:read",
  "intake:write",
  "jobs:read",
  "jobs:write",
  "milestones:read",
  "knowledge:read",
  "uploads:driver",
  "tools:invoke",
  "events:subscribe"
] as const;

export type SatelliteScope = (typeof SATELLITE_SCOPES)[number];

export type SatelliteToken = {
  id: string;
  name: string;
  scopes: string[];
  status: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

export type IssuedSatelliteToken = {
  id: string;
  name: string;
  token: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
};

export type SatelliteWebhook = {
  id: string;
  url: string;
  events: string[];
  status: string;
  lastDeliveryAt: string | null;
  consecutiveFailures: number;
  createdAt: string;
};

export const fetchSatelliteTokens = () => request<SatelliteToken[]>("/api/semse/satellites/tokens");

export const issueSatelliteToken = (input: { name: string; scopes: SatelliteScope[]; expiresAt?: string }) =>
  post<IssuedSatelliteToken>("/api/semse/satellites/tokens", input);

export const revokeSatelliteToken = (id: string) => del<Record<string, unknown>>(`/api/semse/satellites/tokens/${seg(id)}`);

export const fetchSatelliteWebhooks = () => request<SatelliteWebhook[]>("/api/semse/satellites/webhooks");

export const revokeSatelliteWebhook = (id: string) =>
  del<{ id: string; status: string }>(`/api/semse/satellites/webhooks/${seg(id)}`);
