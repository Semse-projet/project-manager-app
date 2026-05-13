import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { EvidenceChecklist, MilestonePlan, QuoteSummary } from "../../../../../packages/tools/dist/index.js";
import type { IntakeImage } from "../smart-intake/smart-intake.types.js";
import { z } from "zod";

const quoteSummarySchema = z.object({
  total: z.number(),
  recommendedDeposit: z.number().optional(),
  recommendedEscrow: z.number().optional(),
  currency: z.string().optional(),
}).passthrough();

const milestonePlanSchema = z.object({
  totalAmount: z.number(),
  riskLevel: z.string(),
  milestones: z.array(z.object({
    sequence: z.number().int().positive(),
    title: z.string(),
    description: z.string(),
    percentage: z.number(),
    amount: z.number().positive(),
    evidenceRequired: z.array(z.string()),
    releaseTrigger: z.string(),
  })),
}).passthrough();

const evidenceChecklistSchema = z.object({
  requiredCount: z.number().optional(),
  items: z.array(z.object({
    type: z.enum(["photo", "video", "document", "measurement", "inspection"]),
    description: z.string(),
    required: z.boolean(),
    milestone: z.number().int().positive().nullable().optional(),
  })),
  notes: z.array(z.string()).optional(),
}).passthrough();

const sourceToolResultSchema = z.object({
  bridgeVersion: z.number().optional(),
  estimate: z.object({
    status: z.string(),
    scopeSummary: z.string().optional(),
    missingInputs: z.array(z.string()).optional(),
    tool: z.string().nullable().optional(),
    quoteSummary: quoteSummarySchema.nullish(),
  }).passthrough(),
  milestonePlan: milestonePlanSchema,
  evidenceChecklist: evidenceChecklistSchema,
  paymentReadiness: z.object({
    status: z.string().optional(),
    ready: z.boolean().optional(),
  }).passthrough().optional(),
  escrowPlan: z.unknown().optional(),
}).passthrough();

const intakeImageSchema = z.object({
  id: z.string(),
  key: z.string(),
  url: z.string(),
  thumbnailUrl: z.string(),
  originalName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  uploadedAt: z.string(),
  imageType: z.enum(["before", "damage", "reference", "material", "other"]),
  evidenceStatus: z.enum(["draft", "attached_to_job"]),
});

type ParsedSourceToolResult = {
  estimate: {
    status: string;
    scopeSummary?: string;
    missingInputs?: string[];
    tool?: string | null;
    quoteSummary?: QuoteSummary | null;
  };
  milestonePlan: MilestonePlan;
  evidenceChecklist: EvidenceChecklist;
  paymentReadiness?: {
    status?: string;
    ready?: boolean;
  };
};

export type LegacyMilestonePayload = {
  sequence: number;
  title: string;
  description: string;
  amount: number;
  requiredEvidenceTypes: string[];
  checklistSchema: Record<string, unknown>;
};

export type LegacyJobTaskPayload = {
  promotedFromBuildOpsTaskId: string;
  milestone: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  priority: string;
  assignedTo: string | null;
};

export type LegacyEvidencePayload = {
  sourceImageId: string;
  bucketKey: string;
  kind: "PHOTO";
  metadataJson: Record<string, unknown>;
};

function normalizeEvidenceType(type: string): "PHOTO" | "VIDEO" | "DOCUMENT" {
  if (type === "photo") return "PHOTO";
  if (type === "video") return "VIDEO";
  return "DOCUMENT";
}

function classifyEvidenceLabel(label: string): "PHOTO" | "VIDEO" | "DOCUMENT" {
  const normalized = label.toLowerCase();
  if (normalized.includes("photo")) return "PHOTO";
  if (normalized.includes("video")) return "VIDEO";
  return "DOCUMENT";
}

function buildChecklistItems(input: {
  sequence: number;
  milestoneEvidenceRequired: string[];
  evidenceChecklist: EvidenceChecklist;
}): Array<Record<string, unknown>> {
  const checklistFromPlan = input.milestoneEvidenceRequired.map((label, index) => ({
    id: `milestone_${input.sequence}_requirement_${index + 1}`,
    label,
    required: true,
    evidenceRequired: true,
  }));

  const checklistFromEvidence = input.evidenceChecklist.items
    .filter((item) => item.milestone == null || item.milestone === input.sequence)
    .map((item, index) => ({
      id: `milestone_${input.sequence}_evidence_${index + 1}`,
      label: item.description,
      required: item.required,
      evidenceRequired: true,
      kind: item.type,
    }));

  const dedup = new Map<string, Record<string, unknown>>();
  for (const item of [...checklistFromPlan, ...checklistFromEvidence]) {
    const key = `${String(item.label).trim().toLowerCase()}::${Boolean(item.required)}`;
    if (!dedup.has(key)) {
      dedup.set(key, item);
    }
  }

  return [...dedup.values()];
}

function buildRequiredEvidenceTypes(input: {
  milestoneEvidenceRequired: string[];
  evidenceChecklist: EvidenceChecklist;
  sequence: number;
}): string[] {
  const required = new Set<"PHOTO" | "VIDEO" | "DOCUMENT">();

  for (const label of input.milestoneEvidenceRequired) {
    required.add(classifyEvidenceLabel(label));
  }

  for (const item of input.evidenceChecklist.items) {
    if (item.milestone == null || item.milestone === input.sequence) {
      required.add(normalizeEvidenceType(item.type));
    }
  }

  return [...required];
}

export function parseBuildOpsSourceToolResult(value: Prisma.JsonValue | null): ParsedSourceToolResult {
  const parsed = sourceToolResultSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new BadRequestException(`invalid sourceToolResult: ${issue.path.join(".") || "root"} ${issue.message}`);
  }

  return parsed.data as ParsedSourceToolResult;
}

export function mapLegacyMilestones(input: {
  buildOpsProjectId: string;
  promotedAt: string;
  promotedByUserId: string;
  milestonePlan: MilestonePlan;
  evidenceChecklist: EvidenceChecklist;
}): LegacyMilestonePayload[] {
  return input.milestonePlan.milestones.map((milestone) => ({
    sequence: milestone.sequence,
    title: milestone.title,
    description: milestone.description,
    amount: milestone.amount,
    requiredEvidenceTypes: buildRequiredEvidenceTypes({
      milestoneEvidenceRequired: milestone.evidenceRequired,
      evidenceChecklist: input.evidenceChecklist,
      sequence: milestone.sequence,
    }),
    checklistSchema: {
      items: buildChecklistItems({
        sequence: milestone.sequence,
        milestoneEvidenceRequired: milestone.evidenceRequired,
        evidenceChecklist: input.evidenceChecklist,
      }),
      meta: {
        source: "buildops_legacy_promotion",
        buildOpsProjectId: input.buildOpsProjectId,
        sourceMilestoneSequence: milestone.sequence,
        promotedAt: input.promotedAt,
        promotedByUserId: input.promotedByUserId,
      },
    },
  }));
}

export function mapLegacyJobTasks(input: {
  buildOpsTasks: Array<{
    id: string;
    templateKey: string | null;
    title: string;
    description: string | null;
    dueDate: Date | null;
    priority: string;
    assigneeUserId: string | null;
  }>;
}): LegacyJobTaskPayload[] {
  return input.buildOpsTasks.map((task) => ({
    promotedFromBuildOpsTaskId: task.id,
    milestone: task.templateKey ?? "buildops_plan",
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    priority: task.priority,
    assignedTo: task.assigneeUserId,
  }));
}

export function parseUploadedImages(value: Prisma.JsonValue | null): IntakeImage[] {
  const arraySchema = z.array(intakeImageSchema);
  const parsed = arraySchema.safeParse(value);
  if (!parsed.success) {
    return [];
  }
  return parsed.data;
}

export function mapLegacyEvidence(input: {
  buildOpsProjectId: string;
  projectIntakeId: string | null;
  promotedAt: string;
  promotedByUserId: string;
  uploadedImages: IntakeImage[];
}): LegacyEvidencePayload[] {
  return input.uploadedImages
    .filter((image) => typeof image.key === "string" && image.key.trim().length > 0)
    .map((image) => ({
      sourceImageId: image.id,
      bucketKey: image.key.trim(),
      kind: "PHOTO",
      metadataJson: {
        source: "buildops_legacy_promotion",
        buildOpsProjectId: input.buildOpsProjectId,
        projectIntakeId: input.projectIntakeId,
        sourceImageId: image.id,
        imageType: image.imageType,
        evidenceStatus: image.evidenceStatus ?? null,
        originalUrl: image.url,
        promotedAt: input.promotedAt,
        promotedByUserId: input.promotedByUserId,
      },
    }));
}
