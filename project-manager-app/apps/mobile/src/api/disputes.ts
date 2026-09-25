import type { CreateDisputeInput, DisputeRecordView } from "@semse/schemas";
import { apiFetch } from "./client";

export async function fetchDisputes(): Promise<DisputeRecordView[]> {
  return apiFetch<DisputeRecordView[]>("/v1/disputes");
}

export async function createDispute(input: CreateDisputeInput): Promise<DisputeRecordView> {
  return apiFetch<DisputeRecordView>("/v1/disputes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function submitDisputeEvidence(disputeId: string, evidenceIds: string[]): Promise<DisputeRecordView> {
  return apiFetch<DisputeRecordView>(`/v1/disputes/${encodeURIComponent(disputeId)}/submit-evidence`, {
    method: "POST",
    body: JSON.stringify({ evidenceIds }),
  });
}
