import type { WorkspaceRole } from "./workspace-model";

export type EvidenceRow = Record<string, unknown>;
export type EvidenceKind = "PHOTO" | "VIDEO" | "DOCUMENT";
export type EvidenceFilters = { kind: string; status: string; milestoneId: string };

export const DIRECT_EVIDENCE_UPLOAD_LIMIT = 25 * 1024 * 1024;
export const EVIDENCE_KIND_LABELS: Record<string, string> = {
  PHOTO: "Foto", VIDEO: "Video", DOCUMENT: "Documento",
};
const STATUS_LABELS: Record<string, string> = {
  approved: "Aprobada", accepted: "Aceptada", passed: "Aprobada",
  pending: "Pendiente", uploaded: "Subida", under_review: "En revisión",
  manual_review: "Revisión manual", rejected: "Rechazada", failed: "Validación fallida",
  unknown: "Estado no disponible",
};

export function evidenceText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
export function evidenceStatus(row: EvidenceRow): string {
  return (evidenceText(row.validationStatus) || evidenceText(row.status) || "unknown").toLowerCase().replace(/-/g, "_");
}
export function evidenceStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? `Estado: ${status}`;
}
export function filterEvidence(rows: readonly EvidenceRow[], filters: EvidenceFilters): EvidenceRow[] {
  return rows.filter((row) =>
    (!filters.kind || evidenceText(row.kind).toUpperCase() === filters.kind.toUpperCase()) &&
    (!filters.status || evidenceStatus(row) === filters.status.toLowerCase().replace(/-/g, "_")) &&
    (!filters.milestoneId || (filters.milestoneId === "__none__" ? !evidenceText(row.milestoneId) : evidenceText(row.milestoneId) === filters.milestoneId)),
  );
}
/** A query parameter is a selection request, never authorization. */
export function resolveAccessibleJobId(jobs: readonly { id: string }[], requested: string): string {
  return requested ? (jobs.some((job) => job.id === requested) ? requested : "") : jobs[0]?.id ?? "";
}
export function evidenceUploadHref(role: WorkspaceRole | null, jobId: string): string | null {
  if (!role || !jobId) return null;
  const encoded = encodeURIComponent(jobId);
  return role === "worker" ? `/worker/evidence?jobId=${encoded}` : `/jobs/${encoded}/evidence`;
}
export function evidenceUploadProxyUrl(key: string): string {
  return `/api/semse/uploads/files/${encodeURIComponent(key)}`;
}
export function evidenceKindForFile(file: File): EvidenceKind {
  return file.type.startsWith("image/") ? "PHOTO" : file.type.startsWith("video/") ? "VIDEO" : "DOCUMENT";
}

export type RealEvidenceUploadInput = {
  jobId: string;
  kind?: EvidenceKind;
  milestoneId?: string;
  metadata?: Record<string, unknown>;
};
export type EvidenceUploadTransport = {
  plan: (input: { domain: "evidence"; filename: string; contentType: string; fileSizeBytes: number; source: "local_device" }) => Promise<Record<string, unknown>>;
  put: (key: string, file: File, contentType: string) => Promise<void>;
  register: (encodedJobId: string, input: { key: string; kind: EvidenceKind; filename: string; milestoneId?: string; metadata?: Record<string, unknown> }) => Promise<Record<string, unknown>>;
};

/** UI orchestration of the existing plan → BFF PUT → register contract only. */
export async function uploadRealEvidenceFile(file: File, input: RealEvidenceUploadInput, transport: EvidenceUploadTransport): Promise<EvidenceRow> {
  if (typeof File === "undefined" || !(file instanceof File)) throw new Error("Selecciona un archivo real de tu dispositivo; una key o un tamaño declarado no son una carga.");
  if (!input.jobId.trim()) throw new Error("Selecciona un trabajo autorizado antes de subir el archivo.");
  if (!file.size) throw new Error("No se puede subir un archivo vacío.");
  if (!file.name.trim() || file.name.length > 300) throw new Error("El nombre del archivo debe tener entre 1 y 300 caracteres.");
  if (file.size > DIRECT_EVIDENCE_UPLOAD_LIMIT) throw new Error("Esta pantalla admite archivos de hasta 25 MiB por subida directa. Usa un archivo más pequeño; aquí no se realiza transferencia externa ni multipart.");
  const contentType = file.type || "application/octet-stream";
  const plan = await transport.plan({ domain: "evidence", filename: file.name, contentType, fileSizeBytes: file.size, source: "local_device" });
  if (plan.recommendedStrategy === "external_transfer") throw new Error("El servidor requiere transferencia externa para este archivo. Esta pantalla solo admite subida directa de bytes reales; no creará una sesión multipart ni registrará una key sin archivo.");
  if (plan.recommendedStrategy !== "single_put") throw new Error("El servidor no ofreció una estrategia de subida directa compatible. No se registró la evidencia.");
  if (typeof plan.maxSingleUploadBytes === "number" && file.size > plan.maxSingleUploadBytes) throw new Error("El archivo supera el límite de subida directa indicado por el servidor.");
  const key = evidenceText(plan.key);
  if (!key) throw new Error("No se pudo preparar el almacenamiento del archivo.");
  await transport.put(key, file, contentType);
  return transport.register(encodeURIComponent(input.jobId), {
    key, kind: input.kind ?? evidenceKindForFile(file), filename: file.name,
    ...(input.milestoneId ? { milestoneId: input.milestoneId } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  });
}

export type EvidenceUploadResult = { file: File; ok: boolean; error: string | null };
export async function uploadEvidenceBatch(files: readonly File[], upload: (file: File) => Promise<unknown>): Promise<EvidenceUploadResult[]> {
  const results: EvidenceUploadResult[] = [];
  for (const file of files) {
    try {
      await upload(file);
      results.push({ file, ok: true, error: null });
    } catch (error) {
      results.push({ file, ok: false, error: error instanceof Error ? error.message : "No se pudo subir y registrar este archivo." });
    }
  }
  return results;
}
