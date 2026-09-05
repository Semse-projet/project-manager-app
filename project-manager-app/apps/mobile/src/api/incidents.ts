import type { CreateIncidentInput, IncidentRecordView } from "@semse/schemas";
import { apiFetch } from "./client";

export async function fetchMyIncidents(): Promise<IncidentRecordView[]> {
  return apiFetch<IncidentRecordView[]>("/v1/incidents");
}

export async function fetchIncidentsByJob(jobId: string): Promise<IncidentRecordView[]> {
  return apiFetch<IncidentRecordView[]>(`/v1/incidents/by-job/${encodeURIComponent(jobId)}`);
}

export async function createIncident(input: CreateIncidentInput): Promise<IncidentRecordView> {
  return apiFetch<IncidentRecordView>("/v1/incidents", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
