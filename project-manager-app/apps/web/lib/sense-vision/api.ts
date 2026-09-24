// Sense Vision — client-side API functions. Every call goes through the BFF
// under /api/semse/vision/* (never straight to the NestJS API).
// Spec: docs/specs/vision/sense-vision-field-library.spec.md §5.
import type {
  DictionaryEntryView,
  DictionaryListView,
  DictionarySource,
  LibraryItemView,
  VisionRecognizeResult,
} from "@semse/schemas";

export class SenseVisionApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "SenseVisionApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new SenseVisionApiError(err?.error?.message ?? `Sense Vision error ${res.status}`, res.status);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export function recognizeFrame(
  frame: { imageData: string; mimeType: string },
  signal?: AbortSignal,
): Promise<VisionRecognizeResult> {
  return request("/api/semse/vision/recognize", { ...json("POST", frame), signal });
}

export function searchLibrary(query: { q?: string; category?: string; trade?: string; limit?: number }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
  return request<{ items: LibraryItemView[]; total: number }>(`/api/semse/vision/library?${params.toString()}`);
}

export function getLibraryItem(idOrSlug: string) {
  return request<LibraryItemView>(`/api/semse/vision/library/${encodeURIComponent(idOrSlug)}`);
}

export function listDictionary(query: { q?: string; favorite?: boolean; learned?: boolean } = {}) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.favorite !== undefined) params.set("favorite", String(query.favorite));
  if (query.learned !== undefined) params.set("learned", String(query.learned));
  const qs = params.toString();
  return request<DictionaryListView>(`/api/semse/vision/dictionary${qs ? `?${qs}` : ""}`);
}

export function saveWord(libraryItemId: string, source: DictionarySource, decisionEventId?: string) {
  return request<DictionaryEntryView>(
    `/api/semse/vision/dictionary/${encodeURIComponent(libraryItemId)}`,
    json("POST", { source, ...(decisionEventId ? { decisionEventId } : {}) }),
  );
}

export function updateWord(
  libraryItemId: string,
  patch: { favorite?: boolean; learned?: boolean; notes?: string | null; viewed?: true },
) {
  return request<DictionaryEntryView>(`/api/semse/vision/dictionary/${encodeURIComponent(libraryItemId)}`, json("PATCH", patch));
}

export function removeWord(libraryItemId: string) {
  return request<{ removed: boolean }>(`/api/semse/vision/dictionary/${encodeURIComponent(libraryItemId)}`, { method: "DELETE" });
}

export function reportCorrection(input: {
  predictedLibraryItemId?: string | null;
  selectedLibraryItemId?: string | null;
  predictedConfidence?: number | null;
  source: string;
  /** Jev Decision Gate event to annotate with the user's outcome. */
  decisionEventId?: string;
}) {
  return request<{ id: string; createdAt: string }>("/api/semse/vision/corrections", json("POST", input));
}
