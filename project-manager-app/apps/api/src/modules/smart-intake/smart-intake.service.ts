import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { EvidenceService } from "../evidence/evidence.service.js";
import { JobsService } from "../jobs/jobs.service.js";
import {
  buildInitialIntake,
  buildLiveSummary,
  buildNormalizedTitle,
  detectCategoryConfidence,
  detectLanguage,
  derivePaintingScope,
  getAccuracyDetail,
  generateEstimate,
  generateMilestones,
  generateTips,
  getNextQuestion,
  refreshDerivedState,
  updateAnswerSet,
} from "./smart-intake.logic.js";
import { CATEGORY_REGISTRY } from "./config/category-registry.js";
import { getScoringProfile } from "./config/scoring-profiles.js";
import type {
  IntakeAnswer,
  IntakeImage,
  IntakeImageType,
  IntakeQuestion,
  IntakeWarning,
  BilingualString,
  LiveSummary,
  ProjectEstimate,
  ProjectIntakeRecord,
  ProjectMilestone,
  SmartIntakeCategory,
} from "./smart-intake.types.js";

type StoredIntake = {
  id: string;
  tenantId: string;
  userId: string | null;
  sessionToken: string | null;
  publishedJobId: string | null;
  rawDescription: string;
  providedTitle: string | null;
  normalizedTitle: string;
  selectedCategoryId: string | null;
  selectedSubcategoryId: string | null;
  detectedCategory: string;
  detectedSubcategory: string | null;
  modality: string | null;
  city: string | null;
  urgency: string | null;
  detectedLanguage: string;
  categoryConfidence: number;
  accuracyScore: number;
  accuracyLevel: string;
  missingFields: string[];
  recommendedFields: string[];
  answersJson: Prisma.JsonValue | null;
  uploadedImagesJson: Prisma.JsonValue | null;
  estimatePreferenceJson: Prisma.JsonValue | null;
  projectScopeJson: Prisma.JsonValue | null;
  generatedEstimateJson: Prisma.JsonValue | null;
  generatedMilestonesJson: Prisma.JsonValue | null;
  activeWarningsJson: Prisma.JsonValue | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  claimedAt: Date | null;
  publishedAt: Date | null;
  expiresAt: Date | null;
};

type AnalyzeInput = {
  tenantId: string;
  sessionToken: string;
  intakeId?: string;
  rawDescription: string;
  title?: string | null;
  category?: string | null;
  subcategory?: string | null;
  modality?: "on_site" | "remote" | "hybrid" | null;
  city?: string | null;
  urgency?: "low" | "medium" | "high" | "urgent" | null;
};

type PublishResult = {
  jobId: string;
  status: "published";
  jobUrl: string;
  attachedEvidenceCount: number;
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function asArray<T>(value: Prisma.JsonValue | null, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function asObject<T>(value: Prisma.JsonValue | null, fallback: T): T {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as T)
    : fallback;
}

@Injectable()
export class SmartIntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly evidenceService: EvidenceService,
  ) {}

  private hydrate(row: StoredIntake): ProjectIntakeRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      sessionToken: row.sessionToken,
      publishedJobId: row.publishedJobId,
      rawDescription: row.rawDescription,
      providedTitle: row.providedTitle,
      normalizedTitle: row.normalizedTitle,
      selectedCategoryId: row.selectedCategoryId,
      selectedSubcategoryId: row.selectedSubcategoryId,
      detectedCategory: (row.detectedCategory as SmartIntakeCategory) ?? "interior_painting",
      detectedSubcategory: row.detectedSubcategory,
      modality: (row.modality as ProjectIntakeRecord["modality"]) ?? null,
      city: row.city,
      urgency: (row.urgency as ProjectIntakeRecord["urgency"]) ?? null,
      detectedLanguage: (row.detectedLanguage as ProjectIntakeRecord["detectedLanguage"]) ?? "es",
      categoryConfidence: row.categoryConfidence,
      accuracyScore: row.accuracyScore,
      accuracyLevel: row.accuracyLevel as ProjectIntakeRecord["accuracyLevel"],
      missingFields: row.missingFields,
      recommendedFields: row.recommendedFields,
      answers: asArray<IntakeAnswer>(row.answersJson, []),
      uploadedImages: asArray<IntakeImage>(row.uploadedImagesJson, []),
      estimatePreference: asObject<ProjectIntakeRecord["estimatePreference"]>(row.estimatePreferenceJson, {
        includeMaterials: true,
        includeLabor: true,
        pricingMode: "not_sure",
      }),
      projectScope: asObject<ProjectIntakeRecord["projectScope"]>(row.projectScopeJson, {}),
      generatedEstimate: row.generatedEstimateJson ? (row.generatedEstimateJson as ProjectEstimate) : null,
      generatedMilestones: asArray<ProjectMilestone>(row.generatedMilestonesJson, []),
      activeWarnings: asArray<IntakeWarning>(row.activeWarningsJson, []),
      status: row.status as ProjectIntakeRecord["status"],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      claimedAt: row.claimedAt?.toISOString() ?? null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    };
  }

  private async save(intake: ProjectIntakeRecord): Promise<ProjectIntakeRecord> {
    const row = (await this.prisma.projectIntake.upsert({
      where: { id: intake.id },
      update: {
        userId: intake.userId,
        sessionToken: intake.sessionToken,
        publishedJobId: intake.publishedJobId,
        rawDescription: intake.rawDescription,
        providedTitle: intake.providedTitle,
        normalizedTitle: intake.normalizedTitle,
        selectedCategoryId: intake.selectedCategoryId,
        selectedSubcategoryId: intake.selectedSubcategoryId,
        detectedCategory: intake.detectedCategory,
        detectedSubcategory: intake.detectedSubcategory,
        modality: intake.modality,
        city: intake.city,
        urgency: intake.urgency,
        detectedLanguage: intake.detectedLanguage,
        categoryConfidence: intake.categoryConfidence,
        accuracyScore: intake.accuracyScore,
        accuracyLevel: intake.accuracyLevel,
        missingFields: intake.missingFields,
        recommendedFields: intake.recommendedFields,
        answersJson: toJson(intake.answers),
        uploadedImagesJson: toJson(intake.uploadedImages),
        estimatePreferenceJson: toJson(intake.estimatePreference),
        projectScopeJson: toJson(intake.projectScope),
        generatedEstimateJson: intake.generatedEstimate ? toJson(intake.generatedEstimate) : Prisma.DbNull,
        generatedMilestonesJson: toJson(intake.generatedMilestones),
        activeWarningsJson: toJson(intake.activeWarnings),
        status: intake.status,
        claimedAt: intake.claimedAt ? new Date(intake.claimedAt) : null,
        publishedAt: intake.publishedAt ? new Date(intake.publishedAt) : null,
        expiresAt: intake.expiresAt ? new Date(intake.expiresAt) : null,
      },
      create: {
        id: intake.id,
        tenantId: intake.tenantId,
        userId: intake.userId,
        sessionToken: intake.sessionToken,
        publishedJobId: intake.publishedJobId,
        rawDescription: intake.rawDescription,
        providedTitle: intake.providedTitle,
        normalizedTitle: intake.normalizedTitle,
        selectedCategoryId: intake.selectedCategoryId,
        selectedSubcategoryId: intake.selectedSubcategoryId,
        detectedCategory: intake.detectedCategory,
        detectedSubcategory: intake.detectedSubcategory,
        modality: intake.modality,
        city: intake.city,
        urgency: intake.urgency,
        detectedLanguage: intake.detectedLanguage,
        categoryConfidence: intake.categoryConfidence,
        accuracyScore: intake.accuracyScore,
        accuracyLevel: intake.accuracyLevel,
        missingFields: intake.missingFields,
        recommendedFields: intake.recommendedFields,
        answersJson: toJson(intake.answers),
        uploadedImagesJson: toJson(intake.uploadedImages),
        estimatePreferenceJson: toJson(intake.estimatePreference),
        projectScopeJson: toJson(intake.projectScope),
        generatedEstimateJson: intake.generatedEstimate ? toJson(intake.generatedEstimate) : Prisma.DbNull,
        generatedMilestonesJson: toJson(intake.generatedMilestones),
        activeWarningsJson: toJson(intake.activeWarnings),
        status: intake.status,
        claimedAt: intake.claimedAt ? new Date(intake.claimedAt) : null,
        publishedAt: intake.publishedAt ? new Date(intake.publishedAt) : null,
        expiresAt: intake.expiresAt ? new Date(intake.expiresAt) : null,
      },
    })) as StoredIntake;

    return this.hydrate(row);
  }

  private buildResponse(intake: ProjectIntakeRecord): {
    intake: ProjectIntakeRecord;
    nextQuestion: IntakeQuestion | null;
    tips: BilingualString[];
    liveSummary: LiveSummary;
    estimateUnlocked: boolean;
  } {
    return {
      intake,
      nextQuestion: getNextQuestion(intake),
      tips: generateTips(intake),
      liveSummary: buildLiveSummary(intake),
      estimateUnlocked: getAccuracyDetail(intake).estimateReady,
    };
  }

  private async findById(id: string): Promise<ProjectIntakeRecord> {
    const row = (await this.prisma.projectIntake.findUnique({
      where: { id },
    })) as StoredIntake | null;

    if (!row) {
      throw new NotFoundException(`Intake '${id}' not found`);
    }

    return this.hydrate(row);
  }

  private assertSessionAccess(intake: ProjectIntakeRecord, sessionToken: string): void {
    if (intake.expiresAt && new Date(intake.expiresAt).getTime() <= Date.now()) {
      throw new ForbiddenException("Intake session expired");
    }
    if (!intake.sessionToken || intake.sessionToken !== sessionToken) {
      throw new ForbiddenException("Invalid intake session");
    }
  }

  private rebuildFromAnswers(intake: ProjectIntakeRecord): ProjectIntakeRecord {
    const derived = derivePaintingScope(intake.answers);
    return refreshDerivedState({
      ...intake,
      estimatePreference: derived.estimatePreference,
      projectScope: derived.projectScope,
      generatedEstimate: null,
      generatedMilestones: [],
      publishedJobId: intake.publishedJobId,
    });
  }

  async analyze(input: AnalyzeInput) {
    if (input.rawDescription.trim().length < 10) {
      throw new BadRequestException("rawDescription must be at least 10 characters");
    }

    let intake: ProjectIntakeRecord;
    if (input.intakeId) {
      const existing = await this.findById(input.intakeId);
      this.assertSessionAccess(existing, input.sessionToken);
      intake = refreshDerivedState({
        ...existing,
        rawDescription: input.rawDescription,
        providedTitle: input.title?.trim() || null,
        normalizedTitle: buildNormalizedTitle({
          providedTitle: input.title?.trim() || existing.providedTitle,
          rawDescription: input.rawDescription,
        }),
        selectedCategoryId: input.category?.trim() || existing.selectedCategoryId,
        selectedSubcategoryId: input.subcategory?.trim() || existing.selectedSubcategoryId,
        modality: input.modality ?? existing.modality,
        city: input.city?.trim() || existing.city,
        urgency: input.urgency ?? existing.urgency,
        detectedLanguage: detectLanguage(input.rawDescription),
        categoryConfidence: detectCategoryConfidence({
          selectedCategoryId: input.category?.trim() || existing.selectedCategoryId,
          selectedSubcategoryId: input.subcategory?.trim() || existing.selectedSubcategoryId,
          rawDescription: input.rawDescription,
        }),
        updatedAt: new Date().toISOString(),
      });
    } else {
      intake = buildInitialIntake({
        id: `intk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        tenantId: input.tenantId,
        sessionToken: input.sessionToken,
        rawDescription: input.rawDescription,
        providedTitle: input.title ?? null,
        selectedCategoryId: input.category ?? null,
        selectedSubcategoryId: input.subcategory ?? null,
        modality: input.modality ?? null,
        city: input.city ?? null,
        urgency: input.urgency ?? null,
      });
    }

    intake = await this.save(intake);
    return this.buildResponse(intake);
  }

  async answer(input: {
    intakeId: string;
    sessionToken: string;
    questionId: string;
    selectedValues: string[];
    customText?: string;
    isNotSure: boolean;
  }) {
    const intake = await this.findById(input.intakeId);
    this.assertSessionAccess(intake, input.sessionToken);

    const nextAnswer: IntakeAnswer = {
      questionId: input.questionId,
      selectedValues: input.selectedValues,
      customText: input.customText?.trim() || undefined,
      isNotSure: input.isNotSure,
      answeredAt: new Date().toISOString(),
    };

    const updated = this.rebuildFromAnswers({
      ...intake,
      answers: updateAnswerSet(intake.answers, nextAnswer),
      updatedAt: new Date().toISOString(),
    });

    const saved = await this.save(updated);
    return this.buildResponse(saved);
  }

  async addImages(input: {
    intakeId: string;
    sessionToken: string;
    imageType: IntakeImageType;
    images: Array<{
      key: string;
      url: string;
      thumbnailUrl?: string;
      originalName: string;
      contentType: string;
      sizeBytes: number;
    }>;
  }) {
    const intake = await this.findById(input.intakeId);
    this.assertSessionAccess(intake, input.sessionToken);
    const previousScore = intake.accuracyScore;

    const newImages: IntakeImage[] = input.images.map((image) => ({
      id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      key: image.key,
      url: image.url,
      thumbnailUrl: image.thumbnailUrl ?? image.url,
      originalName: image.originalName,
      contentType: image.contentType,
      sizeBytes: image.sizeBytes,
      uploadedAt: new Date().toISOString(),
      imageType: input.imageType,
      evidenceStatus: "draft",
    }));

    const saved = await this.save(refreshDerivedState({
      ...intake,
      uploadedImages: [...intake.uploadedImages, ...newImages],
      generatedEstimate: null,
      generatedMilestones: [],
      updatedAt: new Date().toISOString(),
    }));

    return {
      intake: saved,
      accuracyScoreDelta: saved.accuracyScore - previousScore,
      newAccuracyScore: saved.accuracyScore,
      estimateUnlocked: getAccuracyDetail(saved).estimateReady,
    };
  }

  async estimate(input: {
    intakeId: string;
    sessionToken: string;
    force?: boolean;
  }) {
    const intake = await this.findById(input.intakeId);
    this.assertSessionAccess(intake, input.sessionToken);

    const detail = getAccuracyDetail(intake);
    if (!detail.estimateReady) {
      throw new BadRequestException({
        currentScore: intake.accuracyScore,
        requiredScore: getScoringProfile(intake.detectedCategory).estimateReadyThreshold,
        missingFields: intake.missingFields,
        missingCriticalFields: detail.missingCriticalFields,
      });
    }

    if (intake.generatedEstimate && !input.force) {
      throw new ConflictException({ estimate: intake.generatedEstimate });
    }

    const estimate = generateEstimate(intake);
    const milestones = generateMilestones(intake);
    const saved = await this.save({
      ...intake,
      generatedEstimate: estimate,
      generatedMilestones: milestones,
      status: "estimate_generated",
      updatedAt: new Date().toISOString(),
    });

    return {
      intake: saved,
      estimate,
      milestones,
    };
  }

  async get(input: {
    intakeId: string;
    sessionToken: string;
  }): Promise<ProjectIntakeRecord> {
    const intake = await this.findById(input.intakeId);
    this.assertSessionAccess(intake, input.sessionToken);
    return intake;
  }

  async claim(input: {
    intakeId: string;
    tenantId: string;
    userId: string;
    sessionToken: string;
  }) {
    const intake = await this.findById(input.intakeId);
    if (intake.tenantId !== input.tenantId) {
      throw new ForbiddenException("Cross-tenant intake access is not allowed");
    }
    this.assertSessionAccess(intake, input.sessionToken);

    if (intake.userId && intake.userId !== input.userId) {
      throw new ConflictException("Intake already belongs to another user");
    }

    const saved = await this.save({
      ...intake,
      userId: input.userId,
      sessionToken: null,
      expiresAt: null,
      claimedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return {
      intakeId: saved.id,
      claimed: true,
      userId: input.userId,
    };
  }

  async cleanupExpired(input: { tenantId: string }) {
    const result = await this.prisma.projectIntake.deleteMany({
      where: {
        tenantId: input.tenantId,
        publishedAt: null,
        status: { not: "published" },
        expiresAt: { lt: new Date() },
      },
    });

    return {
      deleted: result.count,
    };
  }

  async publish(input: {
    intakeId: string;
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    requestId: string;
    confirmEstimate: boolean;
    title?: string;
    description?: string;
    category?: string;
    categoryId?: string;
    subcategoryId?: string;
    locationType?: "on_site" | "remote" | "hybrid";
    city?: string;
    urgency?: "low" | "medium" | "high" | "urgent";
    deadline?: string;
    budgetType?: "fixed" | "range" | "hourly";
    budgetMin?: number;
    budgetMax?: number;
    preferredProfessional?: {
      userId: string;
      displayName: string;
      publicSlug?: string;
    };
  }): Promise<PublishResult> {
    const intake = await this.findById(input.intakeId);

    if (intake.tenantId !== input.tenantId) {
      throw new ForbiddenException("Cross-tenant intake access is not allowed");
    }
    if (intake.userId && intake.userId !== input.userId) {
      throw new ForbiddenException("This intake belongs to another user");
    }
    if (intake.status === "published" && intake.publishedJobId) {
      return {
        jobId: intake.publishedJobId,
        status: "published",
        jobUrl: `/client/jobs/${intake.publishedJobId}`,
        attachedEvidenceCount: intake.uploadedImages.length,
      };
    }

    const estimate = intake.generatedEstimate ?? (getAccuracyDetail(intake).estimateReady && input.confirmEstimate ? generateEstimate(intake) : null);
    const categoryDef = CATEGORY_REGISTRY[intake.detectedCategory as keyof typeof CATEGORY_REGISTRY];
    const title = input.title?.trim() || intake.normalizedTitle || intake.providedTitle || categoryDef?.label.en || "Home improvement request";
    const category = input.category?.trim() || categoryDef?.label.es || intake.normalizedTitle || "Trabajo en el hogar";
    const scope = input.description?.trim() || intake.rawDescription;
    const budgetType = input.budgetType?.trim() || (estimate ? "range" : undefined);
    const budgetMin = input.budgetMin ?? estimate?.totalRange.min;
    const budgetMax = input.budgetMax ?? estimate?.totalRange.max;
    const locationType = input.locationType ?? intake.modality ?? "on_site";
    const city = input.city?.trim() || intake.city || undefined;
    const urgency = input.urgency?.trim() || intake.urgency || undefined;

    const job = await this.jobsService.create({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      title,
      category,
      scope,
      budgetType,
      budgetMin,
      budgetMax,
      locationType,
      city,
      urgency,
      deadline: input.deadline,
      preferredProfessional: input.preferredProfessional,
      requestId: input.requestId,
    });

    let attachedEvidenceCount = 0;
    for (const image of intake.uploadedImages) {
      await this.evidenceService.register({
        tenantId: input.tenantId,
        orgId: input.orgId,
        userId: input.userId,
        roles: input.roles,
        requestId: input.requestId,
        jobId: job.id,
        key: image.key,
        kind: "PHOTO",
      });
      attachedEvidenceCount += 1;
    }

    await this.save({
      ...intake,
      userId: input.userId,
      rawDescription: scope,
      providedTitle: input.title?.trim() || intake.providedTitle,
      normalizedTitle: title,
      selectedCategoryId: input.categoryId?.trim() || intake.selectedCategoryId,
      selectedSubcategoryId: input.subcategoryId?.trim() || intake.selectedSubcategoryId,
      modality: locationType,
      city: city ?? null,
      urgency: (urgency as ProjectIntakeRecord["urgency"] | undefined) ?? null,
      generatedEstimate: estimate,
      generatedMilestones: intake.generatedMilestones.length > 0 ? intake.generatedMilestones : generateMilestones(intake),
      uploadedImages: intake.uploadedImages.map((image) => ({ ...image, evidenceStatus: "attached_to_job" })),
      publishedJobId: job.id,
      publishedAt: new Date().toISOString(),
      status: "published",
      updatedAt: new Date().toISOString(),
    });

    return {
      jobId: job.id,
      status: "published",
      jobUrl: `/client/jobs/${job.id}`,
      attachedEvidenceCount,
    };
  }
}
