import { Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import type {
  DictionaryEntryView,
  DictionaryListView,
  DictionarySource,
  LibraryItemView,
  VisionCorrectionInput,
  VisionGateView,
  VisionRecognizeResult,
} from "@semse/schemas";
import { DecisionLayerService } from "../ai-models/decision/decision-layer.service.js";
import {
  buildVisionGateInput,
  deterministicVisionGate,
  visionGateInvariant,
  type VisionGateState,
} from "../ai-models/decision/vision-gate.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { VisionServiceClient } from "./clients/vision-service.client.js";
import type { ValidatedVisionInput } from "./vision-frame.js";
import {
  decideRecognition,
  rankLibrarySearch,
  resolveConfidenceThresholds,
  toLibraryItemView,
} from "./vision-library.logic.js";
import { VisionLibraryRepository } from "./vision-library.repository.js";

type Actor = { tenantId: string; orgId: string; userId: string; requestId: string };
type LibraryRow = Awaited<ReturnType<VisionLibraryRepository["listActiveLibraryItems"]>>[number];
type DictionaryRow = NonNullable<Awaited<ReturnType<VisionLibraryRepository["findDictionaryEntry"]>>>;

// The library changes only by migration, but every live-camera frame needs
// it for vocabulary + matching — cache it briefly instead of a DB read per frame.
const LIBRARY_CACHE_TTL_MS = 5 * 60_000;
// Upper bound on rows ranked in memory for a manual search. The whole
// library is ~100 rows today; this keeps the query bounded as it grows.
const SEARCH_CANDIDATE_POOL = 200;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Sense Vision — spec: docs/specs/vision/sense-vision-field-library.spec.md.
@Injectable()
export class VisionLibraryService {
  private readonly logger = new Logger(VisionLibraryService.name);
  private libraryCache: { rows: LibraryRow[]; loadedAt: number } | null = null;

  constructor(
    private readonly repository: VisionLibraryRepository,
    private readonly client: VisionServiceClient,
    private readonly audit: AuditService,
    // Optional so the gate degrades to its deterministic form if the
    // decision layer isn't wired (e.g. isolated tests).
    @Optional() private readonly decisionLayer?: DecisionLayerService,
  ) {}

  private async activeLibrary(): Promise<LibraryRow[]> {
    if (this.libraryCache && Date.now() - this.libraryCache.loadedAt < LIBRARY_CACHE_TTL_MS) {
      return this.libraryCache.rows;
    }
    const rows = await this.repository.listActiveLibraryItems();
    this.libraryCache = { rows, loadedAt: Date.now() };
    return rows;
  }

  // ── Recognition ──────────────────────────────────────────────────────

  /**
   * Live mode: capture → analyze → return → discard. The frame lives only in
   * this call's memory and is forwarded to vision-service; nothing here
   * writes it anywhere (spec §2.1, handoff §15).
   */
  async recognize(
    input: ValidatedVisionInput,
    options: { actor?: { tenantId: string; userId: string }; trade?: string } = {},
  ): Promise<VisionRecognizeResult> {
    const startedAt = Date.now();
    const thresholds = resolveConfidenceThresholds();
    const rows = await this.activeLibrary();
    const vocabulary = rows.map((row) => ({ slug: row.slug, name: row.nameEn }));
    const image =
      input.kind === "url" ? { imageUrl: input.imageUrl } : { imageData: input.imageData, mimeType: input.mimeType };

    const finish = async (partial: Omit<VisionRecognizeResult, "latencyMs" | "thresholds" | "gate">): Promise<VisionRecognizeResult> => {
      // Camera → recognition → library matching → decision gate → UI.
      const gate = await this.decideGate(partial, options);
      const result = { ...partial, gate, latencyMs: Date.now() - startedAt, thresholds };
      // Metrics only — never the frame (spec §8).
      this.logger.log(
        `vision.recognize status=${result.status} source=${result.source} latencyMs=${result.latencyMs}` +
          ` confidence=${result.object?.confidence ?? "n/a"}${result.reason ? ` reason=${result.reason}` : ""}` +
          ` gate=${gate.action}/${gate.source}`,
      );
      return result;
    };

    let response;
    try {
      response = await this.client.recognizeObjects({ ...image, vocabulary });
    } catch {
      return finish({ status: "error", reason: "provider_error", object: null, alternatives: [], source: "none" });
    }

    if (response.disabled) {
      return finish({ status: "unavailable", reason: "provider_disabled", object: null, alternatives: [], source: "none" });
    }

    const body = (response.body ?? {}) as { provider?: unknown; model?: unknown; candidates?: unknown };
    const source =
      typeof body.provider === "string"
        ? `${body.provider}${typeof body.model === "string" ? `:${body.model}` : ""}`
        : "unknown";
    const decision = decideRecognition(body.candidates, rows, thresholds);
    return finish({ ...decision, source });
  }

  /**
   * Jev Decision Gate (spec: prometeo/jev-decision-layer §4 J9/J10): decides
   * what the UI does with an already-matched result. Falls back to the
   * deterministic gate derived from the confidence policy whenever Jev is
   * off, unavailable, slow, malformed, unsure or proposes something the
   * result can't support.
   */
  private async decideGate(
    partial: Pick<VisionRecognizeResult, "status" | "reason" | "object" | "alternatives">,
    options: { actor?: { tenantId: string; userId: string }; trade?: string },
  ): Promise<VisionGateView> {
    const state: VisionGateState = {
      status: partial.status,
      reason: partial.reason,
      candidate: partial.object
        ? { slug: partial.object.slug, confidence: partial.object.confidence, trades: partial.object.trades }
        : null,
      alternatives: partial.alternatives.map((alt) => ({ slug: alt.slug, confidence: alt.confidence })),
      context: { trade: options.trade },
    };
    const fallback = deterministicVisionGate(state);
    if (!this.decisionLayer || !options.actor) return { ...fallback, source: "deterministic" };

    const outcome = await this.decisionLayer.decide({
      feature: "vision_gate",
      tenantId: options.actor.tenantId,
      userId: options.actor.userId,
      input: buildVisionGateInput(state),
      fallback,
      isValid: visionGateInvariant(state),
    });
    return {
      action: outcome.action,
      confidence: outcome.confidence,
      reasonCode: outcome.reasonCode,
      source: outcome.source,
      ...(outcome.eventId ? { decisionEventId: outcome.eventId } : {}),
    };
  }

  private async recordDecisionOutcome(actor: Actor, decisionEventId: string | undefined, outcome: string) {
    if (!decisionEventId || !this.decisionLayer) return;
    await this.decisionLayer.recordOutcome({ eventId: decisionEventId, tenantId: actor.tenantId, outcome });
  }

  // ── Library ──────────────────────────────────────────────────────────

  async searchLibrary(input: { q?: string; category?: string; trade?: string; limit?: number }) {
    const limit = input.limit ?? 20;
    const pool = await this.repository.searchLibraryItems({
      q: input.q,
      category: input.category,
      trade: input.trade,
      take: SEARCH_CANDIDATE_POOL,
    });
    const ranked = rankLibrarySearch(pool, input.q, limit);
    return { items: ranked.map(toLibraryItemView), total: pool.length };
  }

  async getLibraryItem(idOrSlug: string): Promise<LibraryItemView> {
    const row = await this.repository.findLibraryItemByIdOrSlug(idOrSlug);
    if (!row) throw new NotFoundException({ message: "Library item not found" });
    return toLibraryItemView(row);
  }

  // ── Mi Diccionario ───────────────────────────────────────────────────

  async listDictionary(
    actor: Actor,
    query: { q?: string; favorite?: boolean; learned?: boolean; limit?: number },
  ): Promise<DictionaryListView> {
    const [rows, stats] = await Promise.all([
      this.repository.listDictionary({
        tenantId: actor.tenantId,
        userId: actor.userId,
        favorite: query.favorite,
        learned: query.learned,
        q: query.q,
        take: query.limit ?? 100,
      }),
      this.repository.dictionaryStats({
        tenantId: actor.tenantId,
        userId: actor.userId,
        since: new Date(Date.now() - WEEK_MS),
      }),
    ]);
    return { entries: rows.map(toDictionaryEntryView), stats };
  }

  async saveToDictionary(
    actor: Actor,
    libraryItemId: string,
    source: DictionarySource = "manual",
    decisionEventId?: string,
  ): Promise<DictionaryEntryView> {
    const item = await this.repository.findLibraryItemById(libraryItemId);
    if (!item || !item.active) throw new NotFoundException({ message: "Library item not found" });

    const entry = await this.repository.upsertDictionaryEntry({
      tenantId: actor.tenantId,
      userId: actor.userId,
      libraryItemId,
      fromScan: source === "scan",
    });

    await this.audit
      .append({
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        actorUserId: actor.userId,
        action: "vision.dictionary_saved",
        entityType: "UserDictionaryItem",
        entityId: entry.id,
        requestId: actor.requestId,
        timestamp: new Date().toISOString(),
        afterJson: { libraryItemId, slug: item.slug, source },
      })
      .catch(() => undefined);

    await this.recordDecisionOutcome(actor, decisionEventId, "user_saved");
    return toDictionaryEntryView(entry);
  }

  async updateDictionaryEntry(
    actor: Actor,
    libraryItemId: string,
    patch: { favorite?: boolean; learned?: boolean; notes?: string | null; viewed?: boolean },
  ): Promise<DictionaryEntryView> {
    const existing = await this.repository.findDictionaryEntry({ userId: actor.userId, libraryItemId });
    if (!existing || existing.tenantId !== actor.tenantId) {
      throw new NotFoundException({ message: "Word is not in your dictionary" });
    }
    const updated = await this.repository.updateDictionaryEntry(existing.id, patch);
    return toDictionaryEntryView(updated);
  }

  async removeFromDictionary(actor: Actor, libraryItemId: string): Promise<{ removed: boolean }> {
    const removed = await this.repository.deleteDictionaryEntry({
      tenantId: actor.tenantId,
      userId: actor.userId,
      libraryItemId,
    });
    if (removed) {
      await this.audit
        .append({
          tenantId: actor.tenantId,
          orgId: actor.orgId,
          actorUserId: actor.userId,
          action: "vision.dictionary_removed",
          entityType: "UserDictionaryItem",
          entityId: `${actor.userId}:${libraryItemId}`,
          requestId: actor.requestId,
          timestamp: new Date().toISOString(),
          afterJson: { libraryItemId },
        })
        .catch(() => undefined);
    }
    return { removed };
  }

  // ── Corrections ──────────────────────────────────────────────────────

  /**
   * Recorded for evaluation only — never changes the library or the model
   * (handoff §12). Unknown library ids are rejected rather than stored as
   * dangling references.
   */
  async recordCorrection(actor: Actor, input: VisionCorrectionInput) {
    const predictedLibraryItemId = input.predictedLibraryItemId ?? null;
    const selectedLibraryItemId = input.selectedLibraryItemId ?? null;
    for (const id of [predictedLibraryItemId, selectedLibraryItemId]) {
      if (id && !(await this.repository.findLibraryItemById(id))) {
        throw new NotFoundException({ message: "Library item not found" });
      }
    }

    const correction = await this.repository.createCorrection({
      tenantId: actor.tenantId,
      userId: actor.userId,
      predictedLibraryItemId,
      selectedLibraryItemId,
      predictedConfidence: input.predictedConfidence ?? null,
      source: input.source,
    });

    await this.audit
      .append({
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        actorUserId: actor.userId,
        action: "vision.recognition_corrected",
        entityType: "VisionCorrection",
        entityId: correction.id,
        requestId: actor.requestId,
        timestamp: new Date().toISOString(),
        afterJson: {
          predictedLibraryItemId,
          selectedLibraryItemId,
          predictedConfidence: correction.predictedConfidence,
          source: correction.source,
        },
      })
      .catch(() => undefined);

    await this.recordDecisionOutcome(actor, input.decisionEventId, "user_corrected");
    return { id: correction.id, createdAt: correction.createdAt.toISOString() };
  }
}

function toDictionaryEntryView(row: DictionaryRow): DictionaryEntryView {
  return {
    id: row.id,
    libraryItemId: row.libraryItemId,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    timesViewed: row.timesViewed,
    timesScanned: row.timesScanned,
    favorite: row.favorite,
    learned: row.learned,
    notes: row.notes,
    item: toLibraryItemView(row.libraryItem),
  };
}
