import { z } from "zod";

/**
 * Sense Vision — Construction Library, Mi Diccionario y correcciones.
 * Spec: docs/specs/vision/sense-vision-field-library.spec.md
 *
 * Construction Library = qué conoce SEMSE (catálogo global de plataforma).
 * Mi Diccionario       = qué está aprendiendo cada profesional (relación, no copia).
 */

export const CONSTRUCTION_LIBRARY_CATEGORIES = [
  "tools",
  "materials",
  "electrical",
  "plumbing",
  "hvac",
  "carpentry",
  "drywall",
  "concrete",
  "roofing",
  "painting",
  "flooring",
  "tile",
  "fasteners",
  "hardware",
  "fittings",
  "equipment",
  "ppe",
] as const;
export const constructionLibraryCategorySchema = z.enum(CONSTRUCTION_LIBRARY_CATEGORIES);
export type ConstructionLibraryCategory = z.infer<typeof constructionLibraryCategorySchema>;

export const CONSTRUCTION_TRADES = [
  "general",
  "electrical",
  "plumbing",
  "hvac",
  "carpentry",
  "drywall",
  "concrete",
  "roofing",
  "painting",
  "flooring",
  "tile",
] as const;
export const constructionTradeSchema = z.enum(CONSTRUCTION_TRADES);
export type ConstructionTrade = z.infer<typeof constructionTradeSchema>;

/**
 * Lowercase, strip accents/diacritics and collapse punctuation to single
 * spaces so "Pinza de canal", "pinza-de-canal" and "PINZA DE CANAL" compare
 * equal. Shared by the seed generator (denormalized `searchText` column) and
 * the API's query-side matching so both sides normalize identically.
 */
export function normalizeLibraryText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ── Library item ─────────────────────────────────────────────────────────

export const constructionLibraryItemSeedSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameEn: z.string().min(1).max(120),
  nameEs: z.string().min(1).max(120),
  aliasesEn: z.array(z.string().min(1).max(120)),
  aliasesEs: z.array(z.string().min(1).max(120)),
  category: constructionLibraryCategorySchema,
  subcategory: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  trades: z.array(constructionTradeSchema).min(1),
  descriptionEn: z.string().min(1).max(400),
  descriptionEs: z.string().min(1).max(400),
  usageEn: z.string().min(1).max(400),
  usageEs: z.string().min(1).max(400),
  exampleSentenceEn: z.string().min(1).max(200),
  exampleSentenceEs: z.string().min(1).max(200),
  searchTerms: z.array(z.string().min(1).max(120)),
});
export type ConstructionLibraryItemSeed = z.infer<typeof constructionLibraryItemSeedSchema>;

export interface LibraryItemView {
  id: string;
  slug: string;
  canonicalName: string;
  nameEn: string;
  nameEs: string;
  aliasesEn: string[];
  aliasesEs: string[];
  category: string;
  subcategory: string;
  trades: string[];
  descriptionEn: string;
  descriptionEs: string;
  usageEn: string;
  usageEs: string;
  exampleSentenceEn: string;
  exampleSentenceEs: string;
}

export const librarySearchQuerySchema = z.object({
  q: z.string().max(120).optional(),
  category: constructionLibraryCategorySchema.optional(),
  trade: constructionTradeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
export type LibrarySearchQuery = z.infer<typeof librarySearchQuerySchema>;

// ── Recognition ──────────────────────────────────────────────────────────

export const VISION_FRAME_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type VisionFrameMimeType = (typeof VISION_FRAME_MIME_TYPES)[number];

export const visionRecognizeInputSchema = z
  .object({
    imageUrl: z.string().url().max(2048).optional(),
    imageData: z.string().max(2_000_000).optional(),
    mimeType: z.enum(VISION_FRAME_MIME_TYPES).optional(),
    /** Optional job context for the Jev Decision Gate (spec: prometeo/jev-decision-layer). */
    trade: constructionTradeSchema.optional(),
  })
  .strict();
export type VisionRecognizeInputRaw = z.infer<typeof visionRecognizeInputSchema>;

export type VisionRecognizeStatus = "recognized" | "uncertain" | "unknown" | "unavailable" | "error";

export interface RecognizedLibraryItem extends LibraryItemView {
  confidence: number;
}

export type VisionGateActionView =
  | "ACCEPT_RESULT"
  | "SHOW_ALTERNATIVES"
  | "RETRY_SCAN"
  | "ASK_USER"
  | "ESCALATE_MODEL"
  | "UNKNOWN";

/**
 * What the UI should do with the result (Jev Decision Gate, or its
 * deterministic fallback). Never changes *what* was recognized.
 */
export interface VisionGateView {
  action: VisionGateActionView;
  confidence: number;
  reasonCode: string;
  source: "jev" | "deterministic";
  /** JevDecisionEvent id — send back as decisionEventId on save/correction. */
  decisionEventId?: string;
}

export interface VisionRecognizeResult {
  status: VisionRecognizeStatus;
  reason?: string;
  object: RecognizedLibraryItem | null;
  alternatives: RecognizedLibraryItem[];
  source: string;
  latencyMs: number;
  thresholds: { recognized: number; uncertain: number };
  gate: VisionGateView;
}

// ── Mi Diccionario ───────────────────────────────────────────────────────

export const dictionarySourceSchema = z.enum(["scan", "search", "manual"]);
export type DictionarySource = z.infer<typeof dictionarySourceSchema>;

export const saveDictionaryItemSchema = z
  .object({ source: dictionarySourceSchema.optional(), decisionEventId: z.string().min(1).max(64).optional() })
  .strict();

export const updateDictionaryItemSchema = z
  .object({
    favorite: z.boolean().optional(),
    learned: z.boolean().optional(),
    notes: z.string().max(500).nullable().optional(),
    viewed: z.literal(true).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "at least one field is required" });

export const dictionaryListQuerySchema = z.object({
  q: z.string().max(120).optional(),
  favorite: z.enum(["true", "false"]).optional(),
  learned: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export interface DictionaryEntryView {
  id: string;
  libraryItemId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  timesViewed: number;
  timesScanned: number;
  favorite: boolean;
  learned: boolean;
  notes: string | null;
  item: LibraryItemView;
}

export interface DictionaryListView {
  entries: DictionaryEntryView[];
  stats: { total: number; learned: number; favorites: number; addedThisWeek: number };
}

// ── Correcciones ─────────────────────────────────────────────────────────

export const visionCorrectionSchema = z
  .object({
    predictedLibraryItemId: z.string().min(1).max(64).nullable().optional(),
    selectedLibraryItemId: z.string().min(1).max(64).nullable().optional(),
    predictedConfidence: z.number().min(0).max(1).nullable().optional(),
    source: z.string().min(1).max(120),
    decisionEventId: z.string().min(1).max(64).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.predictedLibraryItemId || value.selectedLibraryItemId), {
    message: "predictedLibraryItemId or selectedLibraryItemId is required",
  });
export type VisionCorrectionInput = z.infer<typeof visionCorrectionSchema>;
