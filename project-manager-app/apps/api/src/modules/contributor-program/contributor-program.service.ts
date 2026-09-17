import crypto from "node:crypto";
import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";
import { StripeConnectService } from "../payments/stripe-connect.service.js";
import { ContributorProgramRepository } from "./contributor-program.repository.js";
import { assertOwnsResource, assertIsOpsAdmin, type ContributorActor } from "./contributor-program.policy.js";

type Ctx = ContributorActor & { requestId: string };

function toMissionView(mission: {
  id: string;
  title: string;
  trade: string;
  category: string;
  description: string;
  difficulty: string;
  requirementsJson: unknown;
  evidenceRequestedJson: unknown;
  acceptanceCriteriaJson: unknown;
  baseCompensationCents: number;
  currency: string;
  bonusJson: unknown;
  deadlineAt: Date | null;
  maxParticipants: number | null;
  status: string;
  version: number;
  isDemo: boolean;
  createdAt: Date;
}) {
  return {
    id: mission.id,
    title: mission.title,
    trade: mission.trade,
    category: mission.category,
    description: mission.description,
    difficulty: mission.difficulty,
    requirements: (mission.requirementsJson as string[]) ?? [],
    evidenceRequested: (mission.evidenceRequestedJson as string[]) ?? [],
    acceptanceCriteria: (mission.acceptanceCriteriaJson as string[]) ?? [],
    baseCompensationCents: mission.baseCompensationCents,
    currency: mission.currency,
    bonus: (mission.bonusJson as { description: string; amountCents: number } | null) ?? null,
    deadlineAt: mission.deadlineAt?.toISOString() ?? null,
    maxParticipants: mission.maxParticipants,
    status: mission.status,
    version: mission.version,
    isDemo: mission.isDemo,
    createdAt: mission.createdAt.toISOString()
  };
}

function toAssetView(asset: {
  id: string;
  kind: string;
  clipRole: string;
  mimeType: string | null;
  sizeBytes: number | null;
  processingStatus: string;
  createdAt: Date;
}) {
  return {
    id: asset.id,
    kind: asset.kind,
    clipRole: asset.clipRole,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    processingStatus: asset.processingStatus,
    createdAt: asset.createdAt.toISOString()
  };
}

const REWARD_ELIGIBLE_TRANSITION = new Set(["APPROVED"]);

@Injectable()
export class ContributorProgramService {
  constructor(
    private readonly repository: ContributorProgramRepository,
    private readonly audit: AuditService,
    @Optional() private readonly sse?: SseEventBusService,
    @Optional() private readonly stripeConnect?: StripeConnectService
  ) {}

  private notify(userId: string, event: string, data: unknown): void {
    this.sse?.emit(`contributor:${userId}`, event, data);
  }

  // ── Terms & consent ────────────────────────────────────────────────────

  async getActiveTerms() {
    const terms = await this.repository.findActiveTermsVersion();
    if (!terms) {
      throw new NotFoundException({
        code: "CONTRIBUTOR_PROGRAM_TERMS_NOT_PUBLISHED",
        message: "No active contributor program terms version"
      });
    }
    return terms;
  }

  async acceptTerms(ctx: Ctx, input: {
    termsVersionId: string;
    termsContentHash: string;
    locale: "es" | "en";
    checkboxes: Record<string, boolean>;
  }) {
    const terms = await this.repository.findTermsVersionById(input.termsVersionId);
    if (!terms || !terms.isActive) {
      throw new BadRequestException({
        code: "CONTRIBUTOR_PROGRAM_TERMS_VERSION_INVALID",
        message: "termsVersionId does not match the currently active terms version"
      });
    }
    if (terms.contentHash !== input.termsContentHash) {
      throw new BadRequestException({
        code: "CONTRIBUTOR_PROGRAM_TERMS_HASH_MISMATCH",
        message: "termsContentHash does not match the server's active terms content"
      });
    }

    const existing = await this.repository.findConsent(ctx.userId, terms.id);
    if (existing) {
      // Re-accepting the same version is a no-op, not an error — never
      // overwrite an existing immutable consent row.
      return existing;
    }

    await this.repository.findOrCreateProfile({ tenantId: ctx.tenantId, userId: ctx.userId });

    const consent = await this.repository.createConsent({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      termsVersionId: terms.id,
      termsContentHash: input.termsContentHash,
      locale: input.locale,
      checkboxes: input.checkboxes
    });

    await this.audit
      .append({
        tenantId: ctx.tenantId,
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: "contributor_program.terms.accepted",
        entityType: "ContributorConsent",
        entityId: consent.id,
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
        afterJson: { termsVersion: terms.version, locale: input.locale }
      })
      .catch(() => undefined);

    return consent;
  }

  // ── Missions ──────────────────────────────────────────────────────────

  async listPublishedMissions(tenantId: string) {
    const missions = await this.repository.listPublishedMissions(tenantId);
    return Promise.all(
      missions.map(async (mission) => ({
        ...toMissionView(mission),
        acceptedCount: await this.repository.countAcceptancesForMission(mission.id)
      }))
    );
  }

  async getMission(missionId: string) {
    const mission = await this.repository.findMissionById(missionId);
    if (!mission) {
      throw new NotFoundException({ code: "CONTRIBUTOR_PROGRAM_MISSION_NOT_FOUND", message: "Mission not found" });
    }
    return toMissionView(mission);
  }

  async createMission(ctx: Ctx, input: {
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
    bonus?: { description: string; amountCents: number };
    deadlineAt?: string;
    maxParticipants?: number;
    isDemo: boolean;
  }) {
    assertIsOpsAdmin(ctx);
    const mission = await this.repository.createMission({
      tenantId: ctx.tenantId,
      createdByUserId: ctx.userId,
      title: input.title,
      trade: input.trade,
      category: input.category,
      description: input.description,
      difficulty: input.difficulty,
      requirements: input.requirements,
      evidenceRequested: input.evidenceRequested,
      acceptanceCriteria: input.acceptanceCriteria,
      baseCompensationCents: input.baseCompensationCents,
      currency: input.currency,
      bonus: input.bonus ?? null,
      deadlineAt: input.deadlineAt ? new Date(input.deadlineAt) : null,
      maxParticipants: input.maxParticipants ?? null,
      isDemo: input.isDemo
    });

    await this.audit
      .append({
        tenantId: ctx.tenantId,
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: "contributor_program.mission.created",
        entityType: "KnowledgeMission",
        entityId: mission.id,
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
        afterJson: { title: mission.title, isDemo: mission.isDemo }
      })
      .catch(() => undefined);

    return toMissionView(mission);
  }

  async listMissionsForAdmin(ctx: Ctx) {
    assertIsOpsAdmin(ctx);
    const missions = await this.repository.listMissionsForAdmin(ctx.tenantId);
    return missions.map(toMissionView);
  }

  async setMissionStatus(ctx: Ctx, missionId: string, status: "PUBLISHED" | "PAUSED" | "CLOSED" | "ARCHIVED") {
    assertIsOpsAdmin(ctx);
    const mission = await this.repository.findMissionById(missionId);
    if (!mission || mission.tenantId !== ctx.tenantId) {
      throw new NotFoundException({ code: "CONTRIBUTOR_PROGRAM_MISSION_NOT_FOUND", message: "Mission not found" });
    }
    const updated = await this.repository.updateMissionStatus(missionId, status);

    await this.audit
      .append({
        tenantId: ctx.tenantId,
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: "contributor_program.mission.status_changed",
        entityType: "KnowledgeMission",
        entityId: missionId,
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
        beforeJson: { status: mission.status },
        afterJson: { status }
      })
      .catch(() => undefined);

    return toMissionView(updated);
  }

  // ── Mission acceptance ────────────────────────────────────────────────

  async acceptMission(ctx: Ctx, missionId: string) {
    const consent = await this.repository.findLatestConsent(ctx.userId);
    const activeTerms = await this.repository.findActiveTermsVersion();
    if (!consent || !activeTerms || consent.termsVersionId !== activeTerms.id) {
      throw new BadRequestException({
        code: "CONTRIBUTOR_PROGRAM_CONSENT_REQUIRED",
        message: "Accept the current contributor program terms before accepting a mission"
      });
    }

    const mission = await this.repository.findMissionById(missionId);
    if (!mission || mission.tenantId !== ctx.tenantId || mission.status !== "PUBLISHED") {
      throw new NotFoundException({
        code: "CONTRIBUTOR_PROGRAM_MISSION_NOT_AVAILABLE",
        message: "Mission not found or not currently accepting participants"
      });
    }

    if (mission.isDemo) {
      // Demo/example missions exist for onboarding only — never payable, never acceptable.
      throw new BadRequestException({
        code: "CONTRIBUTOR_PROGRAM_MISSION_IS_DEMO",
        message: "This is a demo/example mission and cannot be accepted"
      });
    }

    const existing = await this.repository.findAcceptance(missionId, ctx.userId);
    if (existing) {
      throw new ConflictException({
        code: "CONTRIBUTOR_PROGRAM_ALREADY_ACCEPTED",
        message: "This mission was already accepted"
      });
    }

    if (mission.maxParticipants) {
      const count = await this.repository.countAcceptancesForMission(missionId);
      if (count >= mission.maxParticipants) {
        throw new ConflictException({
          code: "CONTRIBUTOR_PROGRAM_MISSION_FULL",
          message: "This mission has reached its maximum number of participants"
        });
      }
    }

    await this.repository.findOrCreateProfile({ tenantId: ctx.tenantId, userId: ctx.userId, trade: mission.trade });

    // Pin compensation/currency/deadline at acceptance time — later edits to
    // the mission (a new .version) never change what this contributor is owed.
    const acceptance = await this.repository.createAcceptance({
      tenantId: ctx.tenantId,
      missionId: mission.id,
      userId: ctx.userId,
      missionVersionSnapshot: mission.version,
      compensationCentsSnapshot: mission.baseCompensationCents,
      currencySnapshot: mission.currency,
      deadlineAtSnapshot: mission.deadlineAt
    });

    await this.audit
      .append({
        tenantId: ctx.tenantId,
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: "contributor_program.mission.accepted",
        entityType: "KnowledgeMissionAcceptance",
        entityId: acceptance.id,
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
        afterJson: { missionId: mission.id, compensationCentsSnapshot: acceptance.compensationCentsSnapshot }
      })
      .catch(() => undefined);

    this.notify(ctx.userId, "mission.accepted", { acceptanceId: acceptance.id, missionId: mission.id });

    return acceptance;
  }

  // ── Submissions ───────────────────────────────────────────────────────

  async createSubmission(ctx: Ctx, acceptanceId: string) {
    const acceptance = await this.repository.findAcceptanceById(acceptanceId);
    if (!acceptance || acceptance.tenantId !== ctx.tenantId) {
      throw new NotFoundException({
        code: "CONTRIBUTOR_PROGRAM_ACCEPTANCE_NOT_FOUND",
        message: "Mission acceptance not found"
      });
    }
    assertOwnsResource(ctx, acceptance.userId);

    const submission = await this.repository.createSubmission({
      tenantId: ctx.tenantId,
      acceptanceId: acceptance.id,
      missionId: acceptance.missionId,
      userId: ctx.userId
    });

    await this.audit
      .append({
        tenantId: ctx.tenantId,
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: "contributor_program.submission.created",
        entityType: "KnowledgeSubmission",
        entityId: submission.id,
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
        afterJson: { acceptanceId: acceptance.id }
      })
      .catch(() => undefined);

    return submission;
  }

  private async loadOwnedSubmission(ctx: Ctx, submissionId: string) {
    const submission = await this.repository.findSubmissionById(submissionId);
    if (!submission || submission.tenantId !== ctx.tenantId) {
      throw new NotFoundException({
        code: "CONTRIBUTOR_PROGRAM_SUBMISSION_NOT_FOUND",
        message: "Submission not found"
      });
    }
    assertOwnsResource(ctx, submission.userId);
    return submission;
  }

  async getSubmission(ctx: Ctx, submissionId: string) {
    return this.toSubmissionView(await this.loadOwnedSubmission(ctx, submissionId));
  }

  async registerAsset(ctx: Ctx, submissionId: string, input: {
    kind: "VIDEO" | "IMAGE" | "AUDIO" | "TEXT";
    clipRole: "BEFORE" | "PLANNING" | "EXECUTION" | "PROBLEM_CORRECTION" | "RESULT" | "OTHER";
    key?: string;
    checksum?: string;
    mimeType?: string;
    sizeBytes?: number;
    textContent?: string;
  }) {
    const submission = await this.loadOwnedSubmission(ctx, submissionId);
    if (submission.status !== "DRAFT" && submission.status !== "CHANGES_REQUESTED") {
      throw new ConflictException({
        code: "CONTRIBUTOR_PROGRAM_SUBMISSION_LOCKED",
        message: "Assets can only be added while the submission is in draft or changes-requested state"
      });
    }

    const asset = await this.repository.createAsset({
      tenantId: ctx.tenantId,
      submissionId,
      uploadedByUserId: ctx.userId,
      kind: input.kind,
      clipRole: input.clipRole,
      storageKey: input.key ?? null,
      textContent: input.textContent ?? null,
      checksum: input.checksum ?? null,
      mimeType: input.mimeType ?? null,
      sizeBytes: input.sizeBytes ?? null
    });

    await this.audit
      .append({
        tenantId: ctx.tenantId,
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: "contributor_program.asset.registered",
        entityType: "KnowledgeAsset",
        entityId: asset.id,
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
        afterJson: { submissionId, kind: input.kind, clipRole: input.clipRole }
      })
      .catch(() => undefined);

    return toAssetView(asset);
  }

  async submitSubmission(ctx: Ctx, submissionId: string, notes?: string) {
    const submission = await this.loadOwnedSubmission(ctx, submissionId);
    if (submission.status !== "DRAFT" && submission.status !== "CHANGES_REQUESTED") {
      throw new ConflictException({
        code: "CONTRIBUTOR_PROGRAM_SUBMISSION_NOT_SUBMITTABLE",
        message: `Submission cannot be submitted from status ${submission.status}`
      });
    }
    if (submission.assets.length === 0) {
      throw new BadRequestException({
        code: "CONTRIBUTOR_PROGRAM_SUBMISSION_NO_ASSETS",
        message: "At least one clip, photo, audio note or text note is required before submitting"
      });
    }

    const updated = await this.repository.updateSubmissionStatus(submissionId, "SUBMITTED", {
      notes,
      submittedAt: new Date()
    });

    // Pipeline stage placeholders (Upload -> Transcription -> ... -> Human
    // review): interfaces + provenance rows only. No video/audio ML model is
    // wired up yet, so every row is recorded PENDING, never COMPLETED with
    // fabricated data — see
    // docs/specs/core/knowledge-contributor-transcript-observation.spec.md
    // (DRAFT; the real processing pipeline, transcript/observation read API
    // and ASR provider decision are scoped there, not implemented here).
    for (const asset of submission.assets) {
      if (asset.kind === "VIDEO" || asset.kind === "AUDIO") {
        await this.repository
          .createExtraction({
            tenantId: ctx.tenantId,
            submissionId,
            assetId: asset.id,
            kind: "TRANSCRIPTION",
            status: "PENDING",
            modelOrProcess: "prometeo-intake-pipeline"
          })
          .catch(() => undefined);
      }
    }

    await this.audit
      .append({
        tenantId: ctx.tenantId,
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: "contributor_program.submission.submitted",
        entityType: "KnowledgeSubmission",
        entityId: submissionId,
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
        afterJson: { assetCount: submission.assets.length }
      })
      .catch(() => undefined);

    this.notify(ctx.userId, "submission.submitted", { submissionId });

    return this.toSubmissionView({ ...submission, ...updated });
  }

  // ── Review (admin) ────────────────────────────────────────────────────

  async listSubmissionsForReview(ctx: Ctx, status?: string) {
    assertIsOpsAdmin(ctx);
    const submissions = await this.repository.listSubmissionsForReview(ctx.tenantId, status);
    return submissions.map((submission) => this.toSubmissionView(submission));
  }

  async reviewSubmission(ctx: Ctx, submissionId: string, input: {
    decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
    reason: string;
    qualityFlags?: string[];
  }) {
    assertIsOpsAdmin(ctx);
    const submission = await this.repository.findSubmissionById(submissionId);
    if (!submission || submission.tenantId !== ctx.tenantId) {
      throw new NotFoundException({
        code: "CONTRIBUTOR_PROGRAM_SUBMISSION_NOT_FOUND",
        message: "Submission not found"
      });
    }
    if (submission.status !== "SUBMITTED" && submission.status !== "UNDER_REVIEW") {
      throw new ConflictException({
        code: "CONTRIBUTOR_PROGRAM_SUBMISSION_NOT_REVIEWABLE",
        message: `Submission in status ${submission.status} is not reviewable`
      });
    }

    const review = await this.repository.createReview({
      tenantId: ctx.tenantId,
      submissionId,
      reviewerUserId: ctx.userId,
      decision: input.decision,
      reason: input.reason,
      qualityFlags: input.qualityFlags
    });

    const nextStatus =
      input.decision === "APPROVED" ? "APPROVED" : input.decision === "REJECTED" ? "REJECTED" : "CHANGES_REQUESTED";
    const updated = await this.repository.updateSubmissionStatus(submissionId, nextStatus);

    await this.audit
      .append({
        tenantId: ctx.tenantId,
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: "contributor_program.submission.reviewed",
        entityType: "KnowledgeSubmission",
        entityId: submissionId,
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
        afterJson: { decision: input.decision, reviewId: review.id }
      })
      .catch(() => undefined);

    this.notify(submission.userId, "submission.reviewed", { submissionId, decision: input.decision });

    if (REWARD_ELIGIBLE_TRANSITION.has(nextStatus)) {
      await this.makeRewardEligible(ctx, { ...submission, ...updated });
    }

    return review;
  }

  // ── Appeals ───────────────────────────────────────────────────────────

  async createAppeal(ctx: Ctx, submissionId: string, reason: string) {
    const submission = await this.loadOwnedSubmission(ctx, submissionId);
    if (submission.status !== "REJECTED") {
      throw new ConflictException({
        code: "CONTRIBUTOR_PROGRAM_APPEAL_NOT_ALLOWED",
        message: "Only a rejected submission can be appealed"
      });
    }
    const latestReview = submission.reviews[0];
    if (!latestReview) {
      throw new ConflictException({
        code: "CONTRIBUTOR_PROGRAM_NO_REVIEW_TO_APPEAL",
        message: "No review found to appeal"
      });
    }

    const appeal = await this.repository.createAppeal({
      tenantId: ctx.tenantId,
      submissionId,
      userId: ctx.userId,
      originalReviewId: latestReview.id,
      reason
    });

    await this.repository.updateSubmissionStatus(submissionId, "DISPUTED");

    await this.audit
      .append({
        tenantId: ctx.tenantId,
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: "contributor_program.submission.appealed",
        entityType: "KnowledgeAppeal",
        entityId: appeal.id,
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
        afterJson: { submissionId }
      })
      .catch(() => undefined);

    return appeal;
  }

  async resolveAppeal(ctx: Ctx, appealId: string, input: { status: "UPHELD" | "OVERTURNED"; resolutionReason: string }) {
    assertIsOpsAdmin(ctx);
    const appeal = await this.repository.findAppealById(appealId);
    if (!appeal || appeal.tenantId !== ctx.tenantId) {
      throw new NotFoundException({ code: "CONTRIBUTOR_PROGRAM_APPEAL_NOT_FOUND", message: "Appeal not found" });
    }
    if (appeal.status !== "OPEN" && appeal.status !== "UNDER_REVIEW") {
      throw new ConflictException({
        code: "CONTRIBUTOR_PROGRAM_APPEAL_ALREADY_RESOLVED",
        message: "This appeal was already resolved"
      });
    }

    const resolved = await this.repository.resolveAppeal({
      id: appealId,
      resolverUserId: ctx.userId,
      status: input.status,
      resolutionReason: input.resolutionReason
    });

    const nextSubmissionStatus = input.status === "OVERTURNED" ? "APPROVED" : "REJECTED";
    const updatedSubmission = await this.repository.updateSubmissionStatus(appeal.submissionId, nextSubmissionStatus);

    await this.audit
      .append({
        tenantId: ctx.tenantId,
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: "contributor_program.appeal.resolved",
        entityType: "KnowledgeAppeal",
        entityId: appealId,
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
        afterJson: { status: input.status }
      })
      .catch(() => undefined);

    this.notify(appeal.userId, "appeal.resolved", { appealId, status: input.status });

    if (input.status === "OVERTURNED") {
      const submission = await this.repository.findSubmissionById(appeal.submissionId);
      if (submission) {
        await this.makeRewardEligible(ctx, { ...submission, ...updatedSubmission });
      }
    }

    return resolved;
  }

  // ── Rewards ───────────────────────────────────────────────────────────

  private async makeRewardEligible(ctx: Ctx, submission: { id: string; userId: string }) {
    const acceptance = await this.repository.findAcceptanceById(
      (await this.repository.findSubmissionById(submission.id))?.acceptanceId ?? ""
    );
    if (!acceptance) return;

    const idempotencyKey = `contributor-reward:${submission.id}`;
    const reward = await this.repository.createReward({
      tenantId: ctx.tenantId,
      submissionId: submission.id,
      userId: submission.userId,
      amountCents: acceptance.compensationCentsSnapshot,
      currency: acceptance.currencySnapshot,
      idempotencyKey
    });

    await this.repository.updateSubmissionStatus(submission.id, "PAYMENT_PENDING");

    await this.audit
      .append({
        tenantId: ctx.tenantId,
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: "contributor_program.reward.authorized",
        entityType: "ContributorReward",
        entityId: reward.id,
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
        afterJson: { amountCents: reward.amountCents, currency: reward.currency }
      })
      .catch(() => undefined);

    return reward;
  }

  async listRewardsForAdmin(ctx: Ctx) {
    assertIsOpsAdmin(ctx);
    return this.repository.listRewardsForAdmin(ctx.tenantId);
  }

  async listAppealsForAdmin(ctx: Ctx) {
    assertIsOpsAdmin(ctx);
    return this.repository.listOpenAppeals(ctx.tenantId);
  }

  // Human-triggered payout — never automatic. Requires a payouts-enabled
  // StripeConnectAccount (payments:connect:self flow, reused as-is); when
  // absent the reward is explicitly BLOCKED_NO_PAYOUT_ACCOUNT rather than
  // silently retried or paid to the wrong destination.
  async authorizePayout(ctx: Ctx, rewardId: string) {
    assertIsOpsAdmin(ctx);
    const rewards = await this.repository.listRewardsForAdmin(ctx.tenantId);
    const reward = rewards.find((row) => row.id === rewardId);
    if (!reward) {
      throw new NotFoundException({ code: "CONTRIBUTOR_PROGRAM_REWARD_NOT_FOUND", message: "Reward not found" });
    }
    if (reward.status === "PAID") {
      return reward; // idempotent: repeated authorize calls never pay twice
    }
    if (reward.status !== "PENDING_REVIEW" && reward.status !== "BLOCKED_NO_PAYOUT_ACCOUNT" && reward.status !== "FAILED") {
      throw new ConflictException({
        code: "CONTRIBUTOR_PROGRAM_REWARD_NOT_PAYABLE",
        message: `Reward in status ${reward.status} cannot be authorized for payout`
      });
    }

    if (!this.stripeConnect) {
      throw new ConflictException({
        code: "CONTRIBUTOR_PROGRAM_PAYOUTS_UNAVAILABLE",
        message: "Payout provider is not wired up in this environment"
      });
    }

    try {
      const transfer = await this.stripeConnect.transferToContractor({
        userId: reward.userId,
        amountUsd: reward.amountCents / 100,
        currency: reward.currency,
        metadata: { submissionId: reward.submissionId, contributorRewardId: reward.id }
      });

      const updated = await this.repository.updateRewardStatus(reward.id, "PAID", {
        authorizedByUserId: ctx.userId,
        authorizedAt: new Date(),
        paidAt: new Date()
      });
      await this.repository.updateSubmissionStatus(reward.submissionId, "PAID");

      await this.audit
        .append({
          tenantId: ctx.tenantId,
          orgId: ctx.orgId,
          actorUserId: ctx.userId,
          action: "contributor_program.reward.paid",
          entityType: "ContributorReward",
          entityId: reward.id,
          requestId: ctx.requestId,
          timestamp: new Date().toISOString(),
          afterJson: { transferId: transfer.transferId, netAmountUsd: transfer.netAmountUsd }
        })
        .catch(() => undefined);

      this.notify(reward.userId, "reward.paid", { submissionId: reward.submissionId, amountCents: reward.amountCents });

      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown payout error";
      const noAccount = message.includes("No Stripe account");
      const updated = await this.repository.updateRewardStatus(
        reward.id,
        noAccount ? "BLOCKED_NO_PAYOUT_ACCOUNT" : "FAILED",
        { failureReason: message }
      );

      await this.audit
        .append({
          tenantId: ctx.tenantId,
          orgId: ctx.orgId,
          actorUserId: ctx.userId,
          action: "contributor_program.reward.payout_failed",
          entityType: "ContributorReward",
          entityId: reward.id,
          requestId: ctx.requestId,
          timestamp: new Date().toISOString(),
          afterJson: { reason: message }
        })
        .catch(() => undefined);

      return updated;
    }
  }

  // ── Dashboard ────────────────────────────────────────────────────────

  async getDashboard(ctx: Ctx) {
    const [acceptances, submissions] = await Promise.all([
      this.repository.listAcceptancesByUser(ctx.tenantId, ctx.userId),
      this.repository.listSubmissionsByUser(ctx.tenantId, ctx.userId)
    ]);

    const consent = await this.repository.findLatestConsent(ctx.userId);
    const activeTerms = await this.repository.findActiveTermsVersion();

    const totalPaidCents = submissions
      .filter((submission) => submission.reward?.status === "PAID")
      .reduce((sum, submission) => sum + (submission.reward?.amountCents ?? 0), 0);

    return {
      profile: await this.repository.findOrCreateProfile({ tenantId: ctx.tenantId, userId: ctx.userId }),
      hasAcceptedActiveTerms: Boolean(consent && activeTerms && consent.termsVersionId === activeTerms.id),
      acceptances: acceptances.map((acceptance) => ({
        id: acceptance.id,
        missionId: acceptance.missionId,
        missionTitle: acceptance.mission.title,
        compensationCentsSnapshot: acceptance.compensationCentsSnapshot,
        currencySnapshot: acceptance.currencySnapshot,
        deadlineAtSnapshot: acceptance.deadlineAtSnapshot?.toISOString() ?? null,
        status: acceptance.status,
        acceptedAt: acceptance.acceptedAt.toISOString()
      })),
      submissions: submissions.map((submission) => this.toSubmissionView(submission)),
      totalPaidCents,
      currency: submissions[0]?.reward?.currency ?? "USD"
    };
  }

  private toSubmissionView(submission: {
    id: string;
    acceptanceId: string;
    missionId: string;
    mission?: { title: string };
    status: string;
    notes: string | null;
    assets: Array<Parameters<typeof toAssetView>[0]>;
    createdAt: Date;
    submittedAt: Date | null;
    acceptance?: { compensationCentsSnapshot: number; currencySnapshot: string };
    reward?: { status: string; amountCents: number; currency: string; paidAt: Date | null } | null;
  }) {
    return {
      id: submission.id,
      acceptanceId: submission.acceptanceId,
      missionId: submission.missionId,
      missionTitle: submission.mission?.title ?? "",
      status: submission.status,
      notes: submission.notes,
      assets: submission.assets.map(toAssetView),
      compensationCentsSnapshot: submission.acceptance?.compensationCentsSnapshot ?? 0,
      currencySnapshot: submission.acceptance?.currencySnapshot ?? "USD",
      submittedAt: submission.submittedAt?.toISOString() ?? null,
      createdAt: submission.createdAt.toISOString(),
      reward: submission.reward
        ? {
            status: submission.reward.status,
            amountCents: submission.reward.amountCents,
            currency: submission.reward.currency,
            paidAt: submission.reward.paidAt?.toISOString() ?? null
          }
        : null
    };
  }
}

export function hashTermsContent(contentEs: string, contentEn: string): string {
  return crypto.createHash("sha256").update(`${contentEs}|${contentEn}`).digest("hex");
}
