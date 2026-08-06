import { normalizeMilestoneRecordStatus, type MilestoneRecordView } from "@semse/schemas";
import { apiFetch } from "./client";

/** See jobs.ts for why mobile has to normalize `status` itself (no BFF to do it for us). */
export async function fetchMilestonesByJob(jobId: string): Promise<MilestoneRecordView[]> {
  const milestones = await apiFetch<MilestoneRecordView[]>(`/v1/jobs/${encodeURIComponent(jobId)}/milestones`);
  return milestones.map(normalizeMilestoneRecordStatus);
}

export async function approveMilestone(milestoneId: string): Promise<MilestoneRecordView> {
  const milestone = await apiFetch<MilestoneRecordView>(`/v1/milestones/${encodeURIComponent(milestoneId)}/approve`, {
    method: "POST",
  });
  return normalizeMilestoneRecordStatus(milestone);
}
