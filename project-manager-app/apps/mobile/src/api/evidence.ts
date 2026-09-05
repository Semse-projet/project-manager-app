import type { EvidenceRecordView, PresignEvidenceInput, RegisterEvidenceInput } from "@semse/schemas";
import { API_BASE_URL, apiFetch, getAccessToken } from "./client";

export type EvidencePresignResult = {
  uploadUrl: string;
  key: string;
  contentType: string;
  fileSizeBytes?: number;
  domain: "evidence" | "contract" | "dispute" | "travel";
};

export type RegisteredEvidence = EvidenceRecordView;

/** GET /v1/uploads/files/:key is intentionally public (see uploads.controller.ts) — no auth header needed to view/render it. */
export function buildEvidenceFileUrl(key: string): string {
  return `${API_BASE_URL}/v1/uploads/files/${encodeURIComponent(key)}`;
}

export async function fetchEvidenceByJob(jobId: string): Promise<EvidenceRecordView[]> {
  return apiFetch<EvidenceRecordView[]>(`/v1/jobs/${encodeURIComponent(jobId)}/evidence`);
}

export async function presignEvidenceUpload(input: PresignEvidenceInput): Promise<EvidencePresignResult> {
  return apiFetch<EvidencePresignResult>("/v1/evidence/presign", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * PUTs the raw file bytes to the presigned URL — not a JSON request, so this
 * bypasses apiFetch (which assumes a JSON body/response) and talks to fetch
 * directly. The upload endpoint is authenticated the same as the rest of the
 * API (no S3-style signed query params), so the bearer token still applies.
 */
export async function uploadToPresignedUrl(
  uploadUrl: string,
  fileUri: string,
  contentType: string,
): Promise<void> {
  const token = await getAccessToken();
  const fileResponse = await fetch(fileUri);
  const blob = await fileResponse.blob();

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "content-type": contentType,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: blob,
  });

  if (!res.ok) {
    throw new Error(`No se pudo subir el archivo (${res.status})`);
  }
}

export async function registerEvidence(input: RegisterEvidenceInput): Promise<RegisteredEvidence> {
  return apiFetch<RegisteredEvidence>("/v1/evidence", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
