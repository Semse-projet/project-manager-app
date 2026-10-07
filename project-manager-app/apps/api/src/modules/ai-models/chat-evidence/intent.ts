/**
 * Detección de intención «revisar evidencias» (spec `prometeo.chat-evidence`, CE-004).
 * PURA y de vocabulario CERRADO: evita consultar la base en cada mensaje; el texto del usuario nunca elige datos ni parámetros.
 */
import { normalizeMessage } from "../chat-actions/intent.js";

const EVIDENCE_WORD = /\bevidencias?\b/;
const REVIEW_WORD = /\b(pendientes?|revis\w*|ver|veo|muestr\w*|mostrar|listar?|lista|tengo|hay|faltan?|falta|queda\w*|cuales|cuantas?|que)\b/;
const PENDING_OR_REVIEW = /\b(pendientes?|revis\w*|por revisar|sin revisar)\b/;
const CREATE_WORD = /\b(sub\w*|cargar|carga|subir|adjunt\w*|crear|crea|agreg\w*|anad\w*)\b/;

export function isEvidenceReviewRequest(message: string): boolean {
  if (typeof message !== "string" || !message.trim()) return false;
  const text = normalizeMessage(message);
  if (!EVIDENCE_WORD.test(text)) return false;
  if (CREATE_WORD.test(text) && !PENDING_OR_REVIEW.test(text)) return false;
  return PENDING_OR_REVIEW.test(text) && REVIEW_WORD.test(text);
}
