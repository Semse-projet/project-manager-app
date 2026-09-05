import { apiFetch } from "./client";

/**
 * Mirrors apps/api/src/modules/contractor/contractor.service.ts's real
 * LeadStatus/LeadSource/LeadUrgency unions -- NOT apps/web's Contractors
 * page, whose local types (`"won" | "archived"`, a `trade` field, a
 * `conversionRate` stat) drifted from the backend contract (see
 * mobile-admin-contractors.spec.md §5 for the specifics). Building against
 * the real contract here rather than copying that drift.
 */
export type LeadStatus =
  | "new" | "contacted" | "estimate_sent" | "estimate_approved"
  | "in_progress" | "completed" | "lost";

export type LeadUrgency = "asap" | "this_week" | "this_month" | "flexible";

export type LeadSource = "referral" | "nextdoor" | "facebook" | "call" | "website" | "whatsapp" | "web_chat" | "other";

export type LeadRecordView = {
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

export type CreateLeadInput = {
  name: string;
  phone?: string;
  email?: string;
  jobType?: string;
  source?: LeadSource;
  notes?: string;
};

export async function fetchLeads(options?: { status?: LeadStatus; search?: string }): Promise<LeadRecordView[]> {
  const qs = new URLSearchParams();
  if (options?.status) qs.set("status", options.status);
  if (options?.search) qs.set("search", options.search);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<LeadRecordView[]>(`/v1/contractor/leads${suffix}`);
}

export async function fetchLeadStats(): Promise<LeadStats> {
  return apiFetch<LeadStats>("/v1/contractor/leads/stats");
}

export async function createLead(input: CreateLeadInput): Promise<LeadRecordView> {
  return apiFetch<LeadRecordView>("/v1/contractor/leads", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
