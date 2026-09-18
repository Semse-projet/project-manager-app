import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class ContributorProgramRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Contributor profile ──────────────────────────────────────────────

  async findOrCreateProfile(input: { tenantId: string; userId: string; trade?: string }) {
    const existing = await this.prisma.contributorProfile.findUnique({ where: { userId: input.userId } });
    if (existing) return existing;
    return this.prisma.contributorProfile.create({
      data: { tenantId: input.tenantId, userId: input.userId, trade: input.trade ?? "electrician" }
    });
  }

  // ── Terms ─────────────────────────────────────────────────────────────

  async findActiveTermsVersion() {
    return this.prisma.contributorTermsVersion.findFirst({ where: { isActive: true } });
  }

  async findTermsVersionById(id: string) {
    return this.prisma.contributorTermsVersion.findUnique({ where: { id } });
  }

  async createTermsVersion(input: {
    version: string;
    effectiveAt: Date;
    contentEs: string;
    contentEn: string;
    contentHash: string;
    isActive: boolean;
  }) {
    if (input.isActive) {
      await this.prisma.contributorTermsVersion.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
    }
    return this.prisma.contributorTermsVersion.create({ data: input });
  }

  // ── Consent ───────────────────────────────────────────────────────────

  async findConsent(userId: string, termsVersionId: string) {
    return this.prisma.contributorConsent.findUnique({
      where: { userId_termsVersionId: { userId, termsVersionId } }
    });
  }

  async findLatestConsent(userId: string) {
    return this.prisma.contributorConsent.findFirst({
      where: { userId },
      orderBy: { acceptedAt: "desc" },
      include: { termsVersion: true }
    });
  }

  async createConsent(input: {
    tenantId: string;
    userId: string;
    termsVersionId: string;
    termsContentHash: string;
    locale: string;
    checkboxes: Record<string, boolean>;
  }) {
    return this.prisma.contributorConsent.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        termsVersionId: input.termsVersionId,
        termsContentHash: input.termsContentHash,
        locale: input.locale,
        checkboxesJson: toJson(input.checkboxes)
      },
      include: { termsVersion: true }
    });
  }

  // ── Missions ──────────────────────────────────────────────────────────

  async createMission(input: {
    tenantId: string;
    createdByUserId: string;
    title: string;
    trade: string;
    category: string;
    description: string;
    difficulty: string;
    requirements: string[];
    evidenceRequested: string[];
    acceptanceCriteria: string[];
    baseCompensationCents: number;
    currency: string;
    bonus?: { description: string; amountCents: number } | null;
    deadlineAt?: Date | null;
    maxParticipants?: number | null;
    isDemo: boolean;
  }) {
    return this.prisma.knowledgeMission.create({
      data: {
        tenantId: input.tenantId,
        createdByUserId: input.createdByUserId,
        title: input.title,
        trade: input.trade,
        category: input.category,
        description: input.description,
        difficulty: input.difficulty,
        requirementsJson: toJson(input.requirements),
        evidenceRequestedJson: toJson(input.evidenceRequested),
        acceptanceCriteriaJson: toJson(input.acceptanceCriteria),
        baseCompensationCents: input.baseCompensationCents,
        currency: input.currency,
        bonusJson: input.bonus ? toJson(input.bonus) : undefined,
        deadlineAt: input.deadlineAt ?? undefined,
        maxParticipants: input.maxParticipants ?? undefined,
        isDemo: input.isDemo
      }
    });
  }

  async findMissionById(id: string) {
    return this.prisma.knowledgeMission.findUnique({ where: { id } });
  }

  async listPublishedMissions(tenantId: string) {
    return this.prisma.knowledgeMission.findMany({
      where: { tenantId, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" }
    });
  }

  async listMissionsForAdmin(tenantId: string) {
    return this.prisma.knowledgeMission.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
  }

  async countAcceptancesForMission(missionId: string) {
    return this.prisma.knowledgeMissionAcceptance.count({ where: { missionId } });
  }

  async updateMissionStatus(id: string, status: "DRAFT" | "PUBLISHED" | "PAUSED" | "CLOSED" | "ARCHIVED") {
    return this.prisma.knowledgeMission.update({ where: { id }, data: { status } });
  }

  // ── Mission acceptance ────────────────────────────────────────────────

  async findAcceptance(missionId: string, userId: string) {
    return this.prisma.knowledgeMissionAcceptance.findUnique({
      where: { missionId_userId: { missionId, userId } }
    });
  }

  async findAcceptanceById(id: string) {
    return this.prisma.knowledgeMissionAcceptance.findUnique({
      where: { id },
      include: { mission: true }
    });
  }

  async createAcceptance(input: {
    tenantId: string;
    missionId: string;
    userId: string;
    missionVersionSnapshot: number;
    compensationCentsSnapshot: number;
    currencySnapshot: string;
    deadlineAtSnapshot?: Date | null;
  }) {
    return this.prisma.knowledgeMissionAcceptance.create({
      data: {
        tenantId: input.tenantId,
        missionId: input.missionId,
        userId: input.userId,
        missionVersionSnapshot: input.missionVersionSnapshot,
        compensationCentsSnapshot: input.compensationCentsSnapshot,
        currencySnapshot: input.currencySnapshot,
        deadlineAtSnapshot: input.deadlineAtSnapshot ?? undefined
      }
    });
  }

  async listAcceptancesByUser(tenantId: string, userId: string) {
    return this.prisma.knowledgeMissionAcceptance.findMany({
      where: { tenantId, userId },
      include: { mission: true },
      orderBy: { acceptedAt: "desc" }
    });
  }

  // ── Submissions ───────────────────────────────────────────────────────

  async createSubmission(input: { tenantId: string; acceptanceId: string; missionId: string; userId: string }) {
    return this.prisma.knowledgeSubmission.create({
      data: {
        tenantId: input.tenantId,
        acceptanceId: input.acceptanceId,
        missionId: input.missionId,
        userId: input.userId
      }
    });
  }

  async findSubmissionById(id: string) {
    return this.prisma.knowledgeSubmission.findUnique({
      where: { id },
      include: {
        mission: true,
        acceptance: true,
        assets: { orderBy: { createdAt: "asc" } },
        reviews: { orderBy: { createdAt: "desc" } },
        appeals: { orderBy: { createdAt: "desc" } },
        reward: true
      }
    });
  }

  async listSubmissionsByUser(tenantId: string, userId: string) {
    return this.prisma.knowledgeSubmission.findMany({
      where: { tenantId, userId },
      include: { mission: true, acceptance: true, assets: true, reward: true },
      orderBy: { createdAt: "desc" }
    });
  }

  async listSubmissionsForReview(tenantId: string, status?: string) {
    return this.prisma.knowledgeSubmission.findMany({
      where: { tenantId, status: status ? (status as never) : { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      include: { mission: true, acceptance: true, assets: true },
      orderBy: { submittedAt: "asc" }
    });
  }

  async updateSubmissionStatus(
    id: string,
    status:
      | "DRAFT"
      | "SUBMITTED"
      | "UNDER_REVIEW"
      | "CHANGES_REQUESTED"
      | "APPROVED"
      | "REJECTED"
      | "PAYMENT_PENDING"
      | "PAID"
      | "DISPUTED"
      | "CANCELLED",
    extra?: { notes?: string; submittedAt?: Date }
  ) {
    return this.prisma.knowledgeSubmission.update({
      where: { id },
      data: { status, notes: extra?.notes, submittedAt: extra?.submittedAt }
    });
  }

  // ── Assets ────────────────────────────────────────────────────────────

  async createAsset(input: {
    tenantId: string;
    submissionId: string;
    uploadedByUserId: string;
    kind: "VIDEO" | "IMAGE" | "AUDIO" | "TEXT";
    clipRole: "BEFORE" | "PLANNING" | "EXECUTION" | "PROBLEM_CORRECTION" | "RESULT" | "OTHER";
    storageKey?: string | null;
    textContent?: string | null;
    checksum?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
  }) {
    return this.prisma.knowledgeAsset.create({
      data: {
        tenantId: input.tenantId,
        submissionId: input.submissionId,
        uploadedByUserId: input.uploadedByUserId,
        kind: input.kind,
        clipRole: input.clipRole,
        storageKey: input.storageKey ?? undefined,
        textContent: input.textContent ?? undefined,
        checksum: input.checksum ?? undefined,
        mimeType: input.mimeType ?? undefined,
        sizeBytes: input.sizeBytes ?? undefined
      }
    });
  }

  // ── Reviews ───────────────────────────────────────────────────────────

  async createReview(input: {
    tenantId: string;
    submissionId: string;
    reviewerUserId: string;
    decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
    reason: string;
    qualityFlags?: string[];
  }) {
    return this.prisma.knowledgeReview.create({
      data: {
        tenantId: input.tenantId,
        submissionId: input.submissionId,
        reviewerUserId: input.reviewerUserId,
        decision: input.decision,
        reason: input.reason,
        qualityFlagsJson: input.qualityFlags ? toJson(input.qualityFlags) : undefined
      }
    });
  }

  // ── Appeals ───────────────────────────────────────────────────────────

  async createAppeal(input: {
    tenantId: string;
    submissionId: string;
    userId: string;
    originalReviewId: string;
    reason: string;
  }) {
    return this.prisma.knowledgeAppeal.create({
      data: {
        tenantId: input.tenantId,
        submissionId: input.submissionId,
        userId: input.userId,
        originalReviewId: input.originalReviewId,
        reason: input.reason
      }
    });
  }

  async findAppealById(id: string) {
    return this.prisma.knowledgeAppeal.findUnique({ where: { id }, include: { submission: true } });
  }

  async listOpenAppeals(tenantId: string) {
    return this.prisma.knowledgeAppeal.findMany({
      where: { tenantId, status: { in: ["OPEN", "UNDER_REVIEW"] } },
      include: { submission: { include: { mission: true } } },
      orderBy: { createdAt: "asc" }
    });
  }

  async resolveAppeal(input: {
    id: string;
    resolverUserId: string;
    status: "UPHELD" | "OVERTURNED";
    resolutionReason: string;
  }) {
    return this.prisma.knowledgeAppeal.update({
      where: { id: input.id },
      data: {
        status: input.status,
        resolverUserId: input.resolverUserId,
        resolutionReason: input.resolutionReason,
        resolvedAt: new Date()
      }
    });
  }

  // ── Extractions (Prometeo intake pipeline provenance) ────────────────

  async createExtraction(input: {
    tenantId: string;
    submissionId: string;
    assetId?: string | null;
    kind:
      | "TRANSCRIPTION"
      | "SEGMENTATION"
      | "ENTITY"
      | "TASK_STEP"
      | "MEASUREMENT"
      | "TOOL_MATERIAL"
      | "PROBLEM_SOLUTION"
      | "QUALITY_FLAG";
    status: "PENDING" | "COMPLETED" | "FAILED";
    modelOrProcess: string;
    dataJson?: unknown;
  }) {
    return this.prisma.knowledgeExtraction.create({
      data: {
        tenantId: input.tenantId,
        submissionId: input.submissionId,
        assetId: input.assetId ?? undefined,
        kind: input.kind,
        status: input.status,
        modelOrProcess: input.modelOrProcess,
        dataJson: input.dataJson ? toJson(input.dataJson) : undefined,
        extractedAt: input.status === "COMPLETED" ? new Date() : undefined
      }
    });
  }

  // ── Extractions: read + pipeline (PR-5, transcript/observation) ──────

  async listExtractionsForSubmission(tenantId: string, submissionId: string) {
    return this.prisma.knowledgeExtraction.findMany({
      where: { tenantId, submissionId },
      include: {
        transcriptSegments: { orderBy: { startMs: "asc" } },
        observations: { orderBy: { createdAt: "asc" } }
      },
      orderBy: { createdAt: "asc" }
    });
  }

  async findObservationById(id: string) {
    return this.prisma.observation.findUnique({ where: { id } });
  }

  // Conditional update guards the 409 in the service: it only succeeds
  // against a row that is still uncorrected (correctedAt: null), so two
  // concurrent correction requests for the same Observation can't both win.
  // Writes the corrected text into the actual OBSERVATION field(s) too, not
  // just correctedFieldsJson (the audit trail of what changed) — otherwise
  // the row's visible objective/condition/.../result would silently keep
  // showing the pre-correction text forever, defeating the whole point of a
  // correction.
  async correctObservation(input: {
    id: string;
    correctedFields: Partial<
      Record<"objective" | "condition" | "decision" | "reason" | "method" | "action" | "result", string>
    >;
    correctedByUserId: string;
    reason: string;
  }) {
    const claimed = await this.prisma.observation.updateMany({
      where: { id: input.id, correctedAt: null },
      data: {
        ...input.correctedFields,
        correctedFieldsJson: toJson(input.correctedFields),
        correctedByUserId: input.correctedByUserId,
        correctedReason: input.reason,
        correctedAt: new Date()
      }
    });
    if (claimed.count === 0) return null;
    return this.prisma.observation.findUnique({ where: { id: input.id } });
  }

  // PR-6 (docs/specs/core/knowledge-contributor-evidence-promotion.spec.md):
  // an editorial decision, not a fact — unlike correctObservation, there is
  // no conditional guard here. A reviewer can promote something they'd
  // rejected, or reject something they'd promoted; each call just writes
  // the new decision and the caller (service) audit-logs it, so the
  // previous decision is never silently lost, only superseded.
  async setObservationPromotion(input: {
    id: string;
    status: "PROMOTED" | "REJECTED";
    promotedByUserId: string;
    reason: string;
  }) {
    return this.prisma.observation.update({
      where: { id: input.id },
      data: {
        promotionStatus: input.status,
        promotedByUserId: input.promotedByUserId,
        promotionReason: input.reason,
        promotedAt: new Date()
      }
    });
  }

  // PR-8 (docs/specs/core/knowledge-contributor-registry.spec.md): the
  // registry only ever shows PROMOTED rows — PENDING/REJECTED never leak in,
  // regardless of filters. `search` is a plain ILIKE across the Observation
  // text fields (exact/substring match), not semantic search — that's PR-9's
  // job (RAG ingestion), explicitly out of scope here per the spec.
  async listPromotedObservations(input: {
    tenantId: string;
    trade?: string;
    category?: string;
    missionId?: string;
    search?: string;
    page: number;
    pageSize: number;
  }) {
    const search = input.search;
    const where: Prisma.ObservationWhereInput = {
      tenantId: input.tenantId,
      promotionStatus: "PROMOTED",
      ...(input.missionId || input.trade || input.category
        ? {
            submission: {
              mission: {
                ...(input.missionId ? { id: input.missionId } : {}),
                ...(input.trade ? { trade: input.trade } : {}),
                ...(input.category ? { category: input.category } : {})
              }
            }
          }
        : {}),
      ...(search
        ? {
            OR: (
              ["objective", "condition", "decision", "reason", "method", "action", "result"] as const
            ).map((field) => ({ [field]: { contains: search, mode: "insensitive" } }))
          }
        : {})
    };

    const [rows, total] = await Promise.all([
      this.prisma.observation.findMany({
        where,
        include: { submission: { include: { mission: true } } },
        orderBy: { promotedAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.observation.count({ where })
    ]);

    return { rows, total };
  }

  // Worker entry point. The findFirst + conditional updateMany (WHERE
  // status = 'PENDING') is the idempotency guard the spec (§6) asks for: the
  // UPDATE only affects a row still PENDING, so if a second worker races for
  // the same row its updateMany.count is 0 and it moves on — no
  // SELECT ... FOR UPDATE SKIP LOCKED needed for single-worker-instance
  // correctness, only for claim-contention throughput under many instances
  // (out of scope here, same "por definir en plan" the spec already flags).
  // tenantId is optional: omitted, this sweeps PENDING rows across every
  // tenant (the real worker's normal mode — same as sweepExpiredLiveSessions
  // having no tenant filter). Passing it scopes the sweep to one tenant,
  // which is what the spec's §8 canary plan asks for ("procesar primero
  // solo las entregas del tenant demo") — this was the only way to satisfy
  // that requirement without ever touching another tenant's queue.
  async claimNextPendingTranscriptionExtraction(tenantId?: string) {
    const candidate = await this.prisma.knowledgeExtraction.findFirst({
      where: { kind: "TRANSCRIPTION", status: "PENDING", tenantId },
      orderBy: { createdAt: "asc" },
      include: { asset: true }
    });
    if (!candidate) return null;
    const claimed = await this.prisma.knowledgeExtraction.updateMany({
      where: { id: candidate.id, status: "PENDING" },
      data: { status: "PROCESSING" }
    });
    if (claimed.count === 0) return null;
    return candidate;
  }

  async failExtraction(id: string, reason: string) {
    return this.prisma.knowledgeExtraction.update({
      where: { id },
      data: { status: "FAILED", dataJson: toJson({ failureReason: reason }) }
    });
  }

  async completeExtractionWithTranscript(input: {
    extractionId: string;
    tenantId: string;
    submissionId: string;
    assetId: string;
    segments: Array<{ startMs: number; endMs: number; text: string; confidence?: number | null }>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const createdSegments = [];
      for (const segment of input.segments) {
        createdSegments.push(
          await tx.transcriptSegment.create({
            data: {
              tenantId: input.tenantId,
              submissionId: input.submissionId,
              assetId: input.assetId,
              extractionId: input.extractionId,
              startMs: segment.startMs,
              endMs: segment.endMs,
              text: segment.text,
              confidence: segment.confidence ?? undefined
            }
          })
        );
      }
      const extraction = await tx.knowledgeExtraction.update({
        where: { id: input.extractionId },
        data: { status: "COMPLETED", extractedAt: new Date() }
      });
      return { extraction, segments: createdSegments };
    });
  }

  async createObservation(input: {
    tenantId: string;
    submissionId: string;
    extractionId: string;
    objective?: string | null;
    condition?: string | null;
    decision?: string | null;
    reason?: string | null;
    method?: string | null;
    action?: string | null;
    result?: string | null;
    sourceSegmentIds: string[];
    generatedBy: string;
  }) {
    return this.prisma.observation.create({
      data: {
        tenantId: input.tenantId,
        submissionId: input.submissionId,
        extractionId: input.extractionId,
        objective: input.objective ?? undefined,
        condition: input.condition ?? undefined,
        decision: input.decision ?? undefined,
        reason: input.reason ?? undefined,
        method: input.method ?? undefined,
        action: input.action ?? undefined,
        result: input.result ?? undefined,
        sourceSegmentIdsJson: toJson(input.sourceSegmentIds),
        generatedBy: input.generatedBy
      }
    });
  }

  // ── Rewards ───────────────────────────────────────────────────────────

  async findRewardBySubmissionId(submissionId: string) {
    return this.prisma.contributorReward.findUnique({ where: { submissionId } });
  }

  async createReward(input: {
    tenantId: string;
    submissionId: string;
    userId: string;
    amountCents: number;
    currency: string;
    idempotencyKey: string;
  }) {
    // findUnique-then-create is the idempotency guard (mirrors
    // OriginatorService.evaluateMilestoneFundedTrigger's findRewardByType
    // check) — the @@unique([tenantId, idempotencyKey]) constraint is the
    // durable backstop against a concurrent double-create.
    const existing = await this.findRewardBySubmissionId(input.submissionId);
    if (existing) return existing;
    return this.prisma.contributorReward.create({
      data: {
        tenantId: input.tenantId,
        submissionId: input.submissionId,
        userId: input.userId,
        amountCents: input.amountCents,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey
      }
    });
  }

  async updateRewardStatus(
    id: string,
    status: "PENDING_REVIEW" | "APPROVED" | "PAYMENT_PENDING" | "PAID" | "BLOCKED_NO_PAYOUT_ACCOUNT" | "FAILED" | "REVERSED",
    extra?: { authorizedByUserId?: string; authorizedAt?: Date; paidAt?: Date; failureReason?: string }
  ) {
    return this.prisma.contributorReward.update({
      where: { id },
      data: {
        status,
        authorizedByUserId: extra?.authorizedByUserId,
        authorizedAt: extra?.authorizedAt,
        paidAt: extra?.paidAt,
        failureReason: extra?.failureReason
      }
    });
  }

  async listRewardsForAdmin(tenantId: string) {
    return this.prisma.contributorReward.findMany({
      where: { tenantId },
      include: { submission: { include: { mission: true } } },
      orderBy: { createdAt: "desc" }
    });
  }
}
