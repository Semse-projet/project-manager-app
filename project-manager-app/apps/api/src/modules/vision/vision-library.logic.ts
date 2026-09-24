// Sense Vision — pure library logic: search ranking, recognition-candidate
// matching and the confidence policy.
// Spec: docs/specs/vision/sense-vision-field-library.spec.md §4 (P1–P3, P9, P10) / §5.
//
// "El modelo reconoce; la Construction Library normaliza, traduce y
// enriquece." The recognizer only proposes candidates; this file decides
// whether a candidate is a real library item and how sure we are. It never
// invents an object: a candidate that doesn't map to a library row is
// dropped, not guessed.
import {
  normalizeLibraryText,
  type LibraryItemView,
  type RecognizedLibraryItem,
  type VisionRecognizeResult,
} from "@semse/schemas";

export type LibraryRow = LibraryItemView & { searchTerms?: string[]; active?: boolean };

export interface RecognitionCandidate {
  slug?: string | null;
  label?: string | null;
  confidence?: number | null;
}

export interface ConfidenceThresholds {
  recognized: number;
  uncertain: number;
}

export const DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholds = { recognized: 0.8, uncertain: 0.5 };
export const MAX_ALTERNATIVES = 3;

export function resolveConfidenceThresholds(env: NodeJS.ProcessEnv = process.env): ConfidenceThresholds {
  const parse = (value: string | undefined, fallback: number) => {
    const n = Number.parseFloat(value ?? "");
    return Number.isFinite(n) && n > 0 && n <= 1 ? n : fallback;
  };
  const recognized = parse(env.VISION_CONFIDENCE_RECOGNIZED, DEFAULT_CONFIDENCE_THRESHOLDS.recognized);
  const uncertain = parse(env.VISION_CONFIDENCE_UNCERTAIN, DEFAULT_CONFIDENCE_THRESHOLDS.uncertain);
  // A misconfigured pair (uncertain >= recognized) would make "uncertain"
  // unreachable; fall back to the spec defaults rather than guess intent.
  return uncertain < recognized ? { recognized, uncertain } : { ...DEFAULT_CONFIDENCE_THRESHOLDS };
}

export function toLibraryItemView(row: LibraryRow): LibraryItemView {
  return {
    id: row.id,
    slug: row.slug,
    canonicalName: row.canonicalName,
    nameEn: row.nameEn,
    nameEs: row.nameEs,
    aliasesEn: row.aliasesEn,
    aliasesEs: row.aliasesEs,
    category: row.category,
    subcategory: row.subcategory,
    trades: row.trades,
    descriptionEn: row.descriptionEn,
    descriptionEs: row.descriptionEs,
    usageEn: row.usageEn,
    usageEs: row.usageEs,
    exampleSentenceEn: row.exampleSentenceEn,
    exampleSentenceEs: row.exampleSentenceEs,
  };
}

function primaryNames(row: LibraryRow): string[] {
  return [row.nameEn, row.nameEs, row.canonicalName, row.slug.replace(/-/g, " ")];
}

function aliasNames(row: LibraryRow): string[] {
  return [...row.aliasesEn, ...row.aliasesEs];
}

// searchTerms are deliberately generic helpers ("coupling", "conduit") —
// good for manual search recall, never valid as an exact recognition name.
function searchHelpers(row: LibraryRow): string[] {
  return [...aliasNames(row), ...(row.searchTerms ?? [])];
}

/**
 * Relevance of one library row for a free-text query. 0 means "no match".
 * Exact primary name > exact alias > primary prefix > alias prefix >
 * word-boundary contains > plain contains.
 */
export function scoreLibraryMatch(row: LibraryRow, query: string): number {
  const q = normalizeLibraryText(query);
  if (!q) return 0;
  const primary = primaryNames(row).map(normalizeLibraryText);
  const aliases = searchHelpers(row).map(normalizeLibraryText);

  if (primary.includes(q)) return 100;
  if (aliases.includes(q)) return 90;
  if (primary.some((name) => name.startsWith(q))) return 70;
  if (aliases.some((name) => name.startsWith(q))) return 60;
  const wordRe = new RegExp(`(^| )${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`);
  if (primary.some((name) => wordRe.test(name))) return 50;
  if (aliases.some((name) => wordRe.test(name))) return 40;
  if (primary.some((name) => name.includes(q))) return 30;
  if (aliases.some((name) => name.includes(q))) return 20;
  return 0;
}

export function rankLibrarySearch<T extends LibraryRow>(rows: readonly T[], query: string | undefined, limit: number): T[] {
  const q = query?.trim() ?? "";
  if (!q) {
    return [...rows].sort((a, b) => a.nameEn.localeCompare(b.nameEn)).slice(0, limit);
  }
  return rows
    .map((row) => ({ row, score: scoreLibraryMatch(row, q) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.row.nameEn.localeCompare(b.row.nameEn))
    .slice(0, limit)
    .map((entry) => entry.row);
}

/**
 * Maps one recognizer candidate to a library row: exact slug first, then an
 * exact normalized name/alias match. Deliberately no fuzzy/contains match —
 * a partial string hit ("coupling" → any coupling) would invent specificity
 * the model never expressed.
 */
export function matchCandidateToLibrary<T extends LibraryRow>(candidate: RecognitionCandidate, rows: readonly T[]): T | null {
  const slug = typeof candidate.slug === "string" ? candidate.slug.trim().toLowerCase() : "";
  if (slug) {
    const bySlug = rows.find((row) => row.slug === slug);
    if (bySlug) return bySlug;
  }
  const label = typeof candidate.label === "string" ? normalizeLibraryText(candidate.label) : "";
  if (!label) return null;
  return (
    rows.find((row) => [...primaryNames(row), ...aliasNames(row)].some((name) => normalizeLibraryText(name) === label)) ??
    null
  );
}

function clampConfidence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

export interface RecognitionDecision {
  status: VisionRecognizeResult["status"];
  reason?: string;
  object: RecognizedLibraryItem | null;
  alternatives: RecognizedLibraryItem[];
}

/**
 * Applies the spec's confidence policy to raw recognizer candidates:
 *   ≥ recognized  → "recognized"
 *   ≥ uncertain   → "uncertain" + up to 3 alternatives
 *   otherwise     → "unknown" (never a guessed object)
 * Candidates that are malformed or don't map to the library are dropped.
 */
export function decideRecognition<T extends LibraryRow>(
  candidates: unknown,
  rows: readonly T[],
  thresholds: ConfidenceThresholds = DEFAULT_CONFIDENCE_THRESHOLDS,
): RecognitionDecision {
  if (!Array.isArray(candidates)) {
    return { status: "unknown", reason: "malformed_result", object: null, alternatives: [] };
  }

  const best = new Map<string, { row: T; confidence: number }>();
  let sawValidCandidate = false;
  for (const raw of candidates) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as RecognitionCandidate;
    const confidence = clampConfidence(candidate.confidence);
    if (confidence === null) continue;
    sawValidCandidate = true;
    const row = matchCandidateToLibrary(candidate, rows);
    if (!row) continue;
    const previous = best.get(row.id);
    if (!previous || previous.confidence < confidence) best.set(row.id, { row, confidence });
  }

  const ranked = [...best.values()].sort((a, b) => b.confidence - a.confidence);
  const toRecognized = (entry: { row: T; confidence: number }): RecognizedLibraryItem => ({
    ...toLibraryItemView(entry.row),
    confidence: Math.round(entry.confidence * 100) / 100,
  });

  if (ranked.length === 0) {
    return {
      status: "unknown",
      reason: sawValidCandidate ? "not_in_library" : candidates.length > 0 ? "malformed_result" : "no_candidates",
      object: null,
      alternatives: [],
    };
  }

  const [top, ...rest] = ranked;
  if (top.confidence >= thresholds.recognized) {
    return { status: "recognized", object: toRecognized(top), alternatives: [] };
  }
  if (top.confidence >= thresholds.uncertain) {
    return {
      status: "uncertain",
      reason: "low_confidence",
      object: toRecognized(top),
      alternatives: rest.slice(0, MAX_ALTERNATIVES).map(toRecognized),
    };
  }
  return { status: "unknown", reason: "low_confidence", object: null, alternatives: [] };
}
