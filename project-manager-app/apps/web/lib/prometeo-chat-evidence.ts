/**
 * Evidencias en el chat de Prometeo (spec `prometeo.chat-evidence`, Ola 4): helper puro de la UI.
 *
 * El servidor propone `chat.analyze_evidence` como botón; el análisis visual SOLO se lanza con el clic (nunca solo) y por el
 * BFF `/api/semse/prometeo/chat-evidence/analyze/:id`. Lo que vuelve es una «opinión asistida, no una aprobación»: la UI no
 * aprueba ni rechaza evidencias, y descarta de la respuesta todo lo que no sea un resumen conocido (sin enlaces ni rawResult).
 */

export const EVIDENCE_OPINION_LABEL = "Opinión asistida, no es una aprobación";

const SAFE_ID = /^[A-Za-z0-9_.:-]{1,64}$/;
const URL_LIKE = /(?:https?|data|mock|s3|file|javascript):\S*|www\.\S*/gi;

type RawAction = { namespace?: unknown; tool?: unknown; input?: unknown };

export type EvidenceAnalysisSummary = {
  evidenceId: string;
  analysisStatus: string;
  qualityScore: number | null;
  riskLevel: string | null;
  riskReasons: string[];
  requiresHumanReview: boolean | null;
  recommendedAction: string | null;
};

export type EvidenceAnalysisOutcome =
  | { state: "done"; summary: EvidenceAnalysisSummary }
  | { state: "degraded"; summary: EvidenceAnalysisSummary; message: string }
  | { state: "limit"; message: string }
  | { state: "error"; message: string };

export type EvidenceAnalysisState = { state: "loading" } | EvidenceAnalysisOutcome;

/** El id de la evidencia de una acción, solo si tiene una forma segura. */
export function evidenceIdOf(action: RawAction | null | undefined): string | null {
  const input = action?.input && typeof action.input === "object" ? (action.input as { evidenceId?: unknown }) : null;
  const id = input?.evidenceId;
  return typeof id === "string" && SAFE_ID.test(id) ? id : null;
}

export function isAnalyzeEvidenceAction(action: RawAction | null | undefined): boolean {
  return Boolean(action) && action!.namespace === "chat" && action!.tool === "analyze_evidence" && evidenceIdOf(action) !== null;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(URL_LIKE, "").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function toSummary(data: unknown): EvidenceAnalysisSummary | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.evidenceId !== "string" || typeof d.analysisStatus !== "string") return null;
  return {
    evidenceId: cleanText(d.evidenceId, 64),
    analysisStatus: cleanText(d.analysisStatus, 24),
    qualityScore: typeof d.qualityScore === "number" && Number.isFinite(d.qualityScore) ? d.qualityScore : null,
    riskLevel: cleanText(d.riskLevel, 24) || null,
    riskReasons: (Array.isArray(d.riskReasons) ? d.riskReasons : []).map((r) => cleanText(r, 160)).filter(Boolean).slice(0, 5),
    requiresHumanReview: typeof d.requiresHumanReview === "boolean" ? d.requiresHumanReview : null,
    recommendedAction: cleanText(d.recommendedAction, 80) || null,
  };
}

/** Traduce la respuesta del BFF a un estado de UI. Nunca lanza. */
export function classifyAnalysisResponse(status: number, body: unknown): EvidenceAnalysisOutcome {
  if (status === 429) return { state: "limit", message: "Alcanzaste el límite diario de análisis. Inténtalo mañana." };
  if (status !== 200) return { state: "error", message: "No se pudo analizar la evidencia. Inténtalo de nuevo más tarde." };
  const summary = toSummary(body && typeof body === "object" ? (body as { data?: unknown }).data : null);
  if (!summary) return { state: "error", message: "La respuesta del análisis no es válida." };
  if (summary.analysisStatus !== "completed") {
    return { state: "degraded", summary, message: "El análisis visual no pudo completarse. Revisa la evidencia manualmente." };
  }
  return { state: "done", summary };
}

/** Pide el análisis de UNA evidencia (solo desde el clic). Un id inseguro ni siquiera se envía. */
export async function requestEvidenceAnalysis(
  evidenceId: string,
  opts: { fetchImpl?: typeof fetch; chatRequestId?: string } = {},
): Promise<EvidenceAnalysisOutcome> {
  if (!SAFE_ID.test(evidenceId)) return { state: "error", message: "Evidencia no válida." };
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const chatRequestId = opts.chatRequestId && SAFE_ID.test(opts.chatRequestId) ? opts.chatRequestId : undefined;
    const response = await doFetch(`/api/semse/prometeo/chat-evidence/analyze/${encodeURIComponent(evidenceId)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(chatRequestId ? { chatRequestId } : {}),
    });
    const body = await response.json().catch(() => null);
    return classifyAnalysisResponse(response.status, body);
  } catch {
    return { state: "error", message: "No se pudo conectar para analizar la evidencia." };
  }
}
