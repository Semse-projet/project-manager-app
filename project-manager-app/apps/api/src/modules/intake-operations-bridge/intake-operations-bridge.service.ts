import { ForbiddenException, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  EvidenceChecklist,
  EscrowPlan,
  MilestonePlan,
  QuoteSummary,
  SemseToolResult,
} from "../../../../../packages/tools/dist/index.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { buildLiveSummary, generateEstimate, generateMilestones } from "../smart-intake/smart-intake.logic.js";
import { CATEGORY_REGISTRY } from "../smart-intake/config/category-registry.js";
import type {
  IntakeAnswer,
  IntakeImage,
  IntakeWarning,
  ProjectEstimate,
  ProjectIntakeRecord,
  ProjectMilestone,
} from "../smart-intake/smart-intake.types.js";
import { MatchingService } from "../matching/matching.service.js";
import { BuildOpsIntelligenceAgent } from "../operational-intelligence/buildops-intelligence.agent.js";
import { PaymentsService } from "../payments/payments.service.js";
import { ToolsService } from "../tools/tools.service.js";
import type {
  BridgeEstimateStatus,
  BridgeEvidenceRequirementSummary,
  BridgeMatchingSummary,
  BridgeMilestoneSummary,
  BridgePaymentReadinessStatus,
  IntakeOperationsBridgeComputationResult,
  IntakeOperationsBridgeRerunContext,
  IntakeOperationsBridgeResult,
  IntakeOperationsBridgeTaskTemplate,
} from "./intake-operations-bridge.types.js";

type StoredJob = {
  id: string;
  tenantId: string;
  clientOrgId: string;
  title: string;
  category: string | null;
  scope: string;
  status: string;
  location: string | null;
  urgency: string | null;
  budgetMin: Prisma.Decimal | null;
  budgetMax: Prisma.Decimal | null;
  clientOrg: {
    name: string;
  };
};

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

type StoredBuildOpsProject = {
  id: string;
  tenantId: string;
  orgId: string;
  jobId: string | null;
  sourceToolResult: Prisma.JsonValue | null;
  completion: number;
};

type StoredBuildOpsTask = {
  id: string;
  projectId: string | null;
  templateKey: string | null;
};

type TaskTemplate = IntakeOperationsBridgeTaskTemplate;

type BridgeArtifacts = {
  sourceKind: "smart_intake" | "job_only";
  trade: string;
  projectType: string;
  scopeSummary: string;
  missingInputs: string[];
  estimateStatus: BridgeEstimateStatus;
  toolName: string | null;
  toolInput: Record<string, unknown> | null;
  toolResult: SemseToolResult | null;
  quoteSummary: QuoteSummary | null;
  milestonePlan: MilestonePlan;
  milestoneItems: BridgeMilestoneSummary[];
  evidenceChecklist: EvidenceChecklist;
  evidenceItems: BridgeEvidenceRequirementSummary[];
  escrowPlan: EscrowPlan | null;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskScore: number;
  budgetEstimate: number | null;
  warnings: string[];
  recommendations: string[];
};

const SOURCE_TOOL_RESULT_SCHEMA_VERSION = "1.0";

function asArray<T>(value: Prisma.JsonValue | null, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function asObject<T>(value: Prisma.JsonValue | null, fallback: T): T {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as T)
    : fallback;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function midpoint(range: { min: number; max: number } | null | undefined): number | null {
  if (!range) return null;
  return round2((range.min + range.max) / 2);
}

function parseAreaNumber(text?: string | null): number | null {
  if (!text) return null;
  const values = Array.from(text.matchAll(/\d+(?:\.\d+)?/g))
    .map((match) => Number(match[0]))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) return null;
  if (values.length === 1) return values[0] ?? null;
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function resolveAreaSqft(intake: ProjectIntakeRecord | null): number | null {
  const area = intake?.projectScope.area;
  if (!area) return null;
  if (typeof area.value === "number" && Number.isFinite(area.value) && area.value > 0) {
    return area.value;
  }
  return parseAreaNumber(area.range ?? area.customText ?? null);
}

function mapDetectedTrade(input: { intake: ProjectIntakeRecord | null; job: StoredJob }): string {
  if (input.intake?.detectedCategory) {
    const def = CATEGORY_REGISTRY[input.intake.detectedCategory as keyof typeof CATEGORY_REGISTRY];
    if (def) return def.trade;
  }
  const lowerCategory = `${input.job.category ?? ""} ${input.job.title} ${input.job.scope}`.toLowerCase();
  if (/(paint|painting|pintura|pared)/.test(lowerCategory)) return "painting";
  if (/(drywall|sheetrock|yeso|placa)/.test(lowerCategory)) return "drywall";
  if (/(bath|bathroom|bano|ducha|shower)/.test(lowerCategory)) return "remodeling";
  if (/(kitchen|cocina|gabinete|cabinet)/.test(lowerCategory)) return "remodeling";
  if (/(clean|limpieza|limpiar)/.test(lowerCategory)) return "cleaning";
  if (/(door|window|puerta|ventana|floor|piso|deck|wood|madera)/.test(lowerCategory)) return "carpentry";
  return "project-manager";
}

function mapProjectType(input: { intake: ProjectIntakeRecord | null; trade: string }): string {
  if (input.intake?.detectedCategory) {
    const def = CATEGORY_REGISTRY[input.intake.detectedCategory as keyof typeof CATEGORY_REGISTRY];
    if (def) return def.projectType;
  }
  return input.trade === "project-manager" ? "general-operations" : `${input.trade}-operations`;
}

function mapRiskLevel(input: { intake: ProjectIntakeRecord | null; warnings: string[] }): "low" | "medium" | "high" | "critical" {
  const warningText = input.warnings.join(" ").toLowerCase();
  if (warningText.includes("critical") || warningText.includes("mold") || warningText.includes("moisture")) {
    return "high";
  }
  const score = input.intake?.accuracyScore ?? 0;
  if (score >= 70) return "low";
  if (score >= 36) return "medium";
  return input.intake ? "high" : "medium";
}

function mapRiskScore(level: "low" | "medium" | "high" | "critical"): number {
  switch (level) {
    case "critical":
      return 85;
    case "high":
      return 70;
    case "medium":
      return 45;
    default:
      return 20;
  }
}

function mapConditionToSurfaceType(condition: string | undefined): "smooth" | "textured" | "newDrywall" | "exterior" {
  switch (condition) {
    case "extensive_prep":
    case "peeling_paint":
    case "mold_or_moisture":
      return "textured";
    default:
      return "smooth";
  }
}

function buildEstimateNotes(estimate: ProjectEstimate | null, missingInputs: string[]): string[] {
  if (!estimate) {
    return [`Missing inputs: ${missingInputs.join(", ") || "project_intake"}`];
  }
  return [
    ...estimate.assumptions,
    ...estimate.confidenceReasons,
  ];
}

function depositRate(level: "low" | "medium" | "high" | "critical"): number {
  switch (level) {
    case "critical":
      return 0.45;
    case "high":
      return 0.4;
    case "medium":
      return 0.35;
    default:
      return 0.3;
  }
}

function holdbackRate(level: "low" | "medium" | "high" | "critical"): number {
  switch (level) {
    case "critical":
      return 0.2;
    case "high":
      return 0.15;
    case "medium":
      return 0.1;
    default:
      return 0.05;
  }
}

function reserveRate(level: "low" | "medium" | "high" | "critical"): number {
  switch (level) {
    case "critical":
      return 0.12;
    case "high":
      return 0.1;
    case "medium":
      return 0.08;
    default:
      return 0.05;
  }
}

function buildQuoteFromEstimate(
  estimate: ProjectEstimate,
  riskLevel: "low" | "medium" | "high" | "critical",
): QuoteSummary {
  const materials = midpoint(estimate.breakdown.materials ?? null) ?? 0;
  const labor = midpoint(estimate.breakdown.labor ?? null) ?? 0;
  const preparation = midpoint(estimate.breakdown.preparation ?? null) ?? 0;
  const contingency = midpoint(estimate.breakdown.contingency ?? null) ?? 0;
  const subtotal = round2(materials + labor + preparation);
  const total = midpoint(estimate.totalRange) ?? round2(subtotal + contingency);
  const recommendedDeposit = round2(total * depositRate(riskLevel));
  const recommendedEscrow = round2(Math.max(0, total - recommendedDeposit));

  return {
    materials,
    labor: round2(labor + preparation),
    overhead: 0,
    profit: 0,
    semseFee: 0,
    contingency,
    taxes: 0,
    subtotal,
    total,
    recommendedDeposit,
    recommendedEscrow,
    currency: "USD",
    notes: buildEstimateNotes(estimate, []),
  };
}

function buildEscrowPlanFromQuote(
  quote: QuoteSummary,
  milestones: BridgeMilestoneSummary[],
  riskLevel: "low" | "medium" | "high" | "critical",
  trade: string,
): EscrowPlan {
  return {
    trade: trade as EscrowPlan["trade"],
    totalAmount: quote.total,
    initialDeposit: quote.recommendedDeposit,
    holdback: round2(quote.total * holdbackRate(riskLevel)),
    releaseSchedule: milestones.map((milestone) => milestone.amount),
    recommendedReserve: round2(quote.total * reserveRate(riskLevel)),
    notes: [
      "Bridge draft: escrow remains not ready until reservation, contract, and project link exist.",
      "Release amounts are aligned to suggested milestones.",
    ],
  };
}

function buildMilestonePlanFromIntake(
  trade: string,
  riskLevel: "low" | "medium" | "high" | "critical",
  milestones: ProjectMilestone[],
  totalAmount: number,
): MilestonePlan {
  const normalized = milestones.map((milestone) => {
    const percentage = milestone.paymentPercentage ?? 0;
    const amount = round2(totalAmount * (percentage / 100));
    return {
      sequence: milestone.order,
      title: milestone.title.en,
      description: milestone.description?.en ?? milestone.title.en,
      percentage,
      amount,
      evidenceRequired: milestone.requiresEvidence
        ? ["before_photos", "progress_photos", "after_photos", "client_approval"]
        : ["client_approval"],
      releaseTrigger: milestone.requiresEvidence ? "evidence_and_client_approval" : "client_approval",
    };
  });

  return {
    trade: trade as MilestonePlan["trade"],
    totalAmount,
    riskLevel,
    milestones: normalized,
    fundingSchedule: normalized.map((milestone) => milestone.amount),
  };
}

function buildGenericMilestonePlan(
  trade: string,
  riskLevel: "low" | "medium" | "high" | "critical",
  totalAmount: number,
): MilestonePlan {
  const template = [
    { sequence: 1, title: "Scope confirmation", description: "Confirm scope, measurements, and site conditions.", percentage: 20 },
    { sequence: 2, title: "Preparation and materials", description: "Prepare materials, access, and pre-work checklist.", percentage: 30 },
    { sequence: 3, title: "Work execution", description: "Execute the main scope and document progress.", percentage: 35 },
    { sequence: 4, title: "Final inspection and approval", description: "Collect final evidence and client approval.", percentage: 15 },
  ];

  const milestones = template.map((item) => ({
    ...item,
    amount: round2(totalAmount * (item.percentage / 100)),
    evidenceRequired: item.sequence === 4
      ? ["after_photos", "client_approval"]
      : ["before_photos", "progress_photos"],
    releaseTrigger: item.sequence === 4 ? "final_approval" : "approved_progress_evidence",
  }));

  return {
    trade: trade as MilestonePlan["trade"],
    totalAmount,
    riskLevel,
    milestones,
    fundingSchedule: milestones.map((milestone) => milestone.amount),
  };
}

function toBridgeMilestones(plan: MilestonePlan): BridgeMilestoneSummary[] {
  return plan.milestones.map((milestone) => ({
    key: `milestone_${milestone.sequence}`,
    sequence: milestone.sequence,
    title: milestone.title,
    description: milestone.description,
    percentage: milestone.percentage,
    amount: round2(milestone.amount),
    evidenceRequired: [...milestone.evidenceRequired],
    releaseTrigger: milestone.releaseTrigger,
  }));
}

function buildEvidenceChecklistFromMilestones(
  trade: string,
  riskLevel: "low" | "medium" | "high" | "critical",
  milestones: BridgeMilestoneSummary[],
  missingInputs: string[],
): EvidenceChecklist {
  const items: BridgeEvidenceRequirementSummary[] = [];
  for (const milestone of milestones) {
    if (milestone.sequence === 1) {
      items.push({
        key: `evidence_${milestone.sequence}_before`,
        type: "photo",
        description: "Before photos and site condition evidence.",
        required: true,
        milestone: milestone.sequence,
      });
    }
    if (milestone.sequence < milestones.length) {
      items.push({
        key: `evidence_${milestone.sequence}_progress`,
        type: "photo",
        description: "Progress photos for this milestone.",
        required: true,
        milestone: milestone.sequence,
      });
    }
    if (milestone.sequence === milestones.length) {
      items.push({
        key: `evidence_${milestone.sequence}_after`,
        type: "photo",
        description: "Final completion photos.",
        required: true,
        milestone: milestone.sequence,
      });
      items.push({
        key: `evidence_${milestone.sequence}_approval`,
        type: "document",
        description: "Client approval or completion acknowledgment.",
        required: true,
        milestone: milestone.sequence,
      });
    }
  }

  if (missingInputs.some((field) => field.includes("area") || field.includes("scope"))) {
    items.push({
      key: "evidence_measurements",
      type: "measurement",
      description: "Updated measurements to tighten the estimate and scope.",
      required: true,
      milestone: 1,
    });
  }

  return {
    trade: trade as EvidenceChecklist["trade"],
    riskLevel,
    requiredCount: items.filter((item) => item.required).length,
    items: items.map((item) => ({
      type: item.type,
      description: item.description,
      required: item.required,
      milestone: item.milestone ?? undefined,
    })),
    notes: [
      "Bridge draft: evidence remains suggested until a legacy Project exists.",
      "Use milestone evidence to reduce dispute and escrow risk.",
    ],
  };
}

function toBridgeEvidence(checklist: EvidenceChecklist): BridgeEvidenceRequirementSummary[] {
  return checklist.items.map((item, index) => ({
    key: `evidence_${index + 1}`,
    type: item.type,
    description: item.description,
    required: item.required,
    milestone: item.milestone ?? null,
  }));
}

function buildScopeSummary(job: StoredJob, intake: ProjectIntakeRecord | null): string {
  if (!intake) {
    return job.scope;
  }

  const live = buildLiveSummary(intake);
  const segments = [
    `Category: ${live.category}`,
    live.area ? `Area: ${live.area}` : null,
    live.condition ? `Condition: ${live.condition}` : null,
    live.coats ? `Coats: ${live.coats}` : null,
    live.materials ? `Estimate mode: ${live.materials}` : null,
    live.duration ? `Duration: ${live.duration}` : null,
    job.location ? `Location: ${job.location}` : null,
  ].filter((segment): segment is string => Boolean(segment));

  return [job.scope, segments.join(" | ")].filter(Boolean).join("\n\n");
}

function buildTaskTemplates(input: {
  scopeSummary: string;
  missingInputs: string[];
  matching: BridgeMatchingSummary;
  estimateStatus: BridgeEstimateStatus;
  quoteTotal: number | null;
  milestoneCount: number;
  evidenceCount: number;
  paymentStatus: BridgePaymentReadinessStatus;
}): TaskTemplate[] {
  const missing = input.missingInputs.length > 0 ? input.missingInputs.join(", ") : "none";
  const quoteText = input.quoteTotal != null ? `$${input.quoteTotal.toLocaleString()}` : "pending";
  const candidateText = input.matching.candidateCount > 0
    ? `${input.matching.candidateCount} candidate(s) ready for review`
    : "No active candidates yet";

  return [
    {
      templateKey: "review_client_request",
      title: "Review client request",
      description: input.scopeSummary,
      priority: "high",
      evidenceRequired: { items: ["client_brief"], required: true },
    },
    {
      templateKey: "confirm_scope_measurements",
      title: "Confirm scope and measurements",
      description: `Missing inputs: ${missing}. Tighten the job scope before quoting.`,
      priority: input.missingInputs.length > 0 ? "urgent" : "high",
      evidenceRequired: { items: ["measurements", "before_photos"], required: true },
    },
    {
      templateKey: "prepare_initial_estimate",
      title: "Prepare initial estimate",
      description: `Estimate status: ${input.estimateStatus}. Current quote total: ${quoteText}.`,
      priority: "high",
      evidenceRequired: { items: ["scope_confirmation"], required: true },
    },
    {
      templateKey: "review_marketplace_matching",
      title: "Review marketplace matching",
      description: candidateText,
      priority: input.matching.candidateCount > 0 ? "medium" : "low",
      evidenceRequired: { items: ["candidate_review"], required: false },
    },
    {
      templateKey: "request_missing_photos_evidence",
      title: "Request missing photos and evidence",
      description: `Evidence draft contains ${input.evidenceCount} item(s). Collect missing proof before release planning.`,
      priority: input.evidenceCount > 0 ? "medium" : "low",
      evidenceRequired: { items: ["before_photos", "progress_photos", "after_photos"], required: true },
    },
    {
      templateKey: "define_milestones_payment_plan",
      title: "Define milestones and payment plan",
      description: `Milestones draft: ${input.milestoneCount}. Payment readiness: ${input.paymentStatus}.`,
      priority: "medium",
      evidenceRequired: { items: ["client_approval", "milestone_plan"], required: true },
    },
  ];
}

function hasStoredMilestones(sourceToolResult: Prisma.JsonValue | null): boolean {
  const payload = asObject<Record<string, unknown>>(sourceToolResult, {});
  if (!isSupportedSourceToolResult(payload)) {
    return false;
  }
  const milestonePlan = payload["milestonePlan"];
  if (!milestonePlan || typeof milestonePlan !== "object" || Array.isArray(milestonePlan)) {
    return false;
  }
  const milestones = (milestonePlan as Record<string, unknown>)["milestones"];
  return Array.isArray(milestones) && milestones.length > 0;
}

function hasStoredEvidence(sourceToolResult: Prisma.JsonValue | null): boolean {
  const payload = asObject<Record<string, unknown>>(sourceToolResult, {});
  if (!isSupportedSourceToolResult(payload)) {
    return false;
  }
  const evidenceChecklist = payload["evidenceChecklist"];
  if (!evidenceChecklist || typeof evidenceChecklist !== "object" || Array.isArray(evidenceChecklist)) {
    return false;
  }
  const items = (evidenceChecklist as Record<string, unknown>)["items"];
  return Array.isArray(items) && items.length > 0;
}

function isSupportedSourceToolResult(payload: Record<string, unknown>): boolean {
  if (payload["schemaVersion"] === SOURCE_TOOL_RESULT_SCHEMA_VERSION) {
    return true;
  }
  return payload["schemaVersion"] == null && payload["bridgeVersion"] === 1;
}

@Injectable()
export class IntakeOperationsBridgeService {
  private readonly logger = new Logger(IntakeOperationsBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matchingService: MatchingService,
    private readonly paymentsService: PaymentsService,
    private readonly toolsService: ToolsService,
    @Optional() private readonly intelligenceAgent?: BuildOpsIntelligenceAgent,
  ) {}

  async bridgePublishedJobToOperations(input: {
    jobId: string;
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
  }): Promise<IntakeOperationsBridgeResult> {
    const job = await this.findJobOrThrow(input.tenantId, input.jobId);
    this.assertAccess(input, job);

    const intake = await this.findIntakeByJob(job.tenantId, job.id);
    const artifacts = this.buildBridgeArtifacts(job, intake);
    const matching = await this.buildMatchingSummary(job.tenantId, job.id);
    const rawPaymentReadiness = await this.paymentsService.paymentReadinessByJob({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
      jobId: job.id,
    });

    const paymentStatus = this.derivePaymentStatus(rawPaymentReadiness.ready, artifacts.quoteSummary != null);
    const paymentReason =
      rawPaymentReadiness.reasons[0]
      ?? (paymentStatus === "draft"
        ? "Estimate and escrow draft are prepared; assignment, project link, and contract are still pending."
        : null);

    const existingProject = (await this.prisma.buildOpsProject.findFirst({
      where: { tenantId: input.tenantId, jobId: job.id },
      select: {
        id: true,
        tenantId: true,
        orgId: true,
        jobId: true,
        sourceToolResult: true,
        completion: true,
      },
    })) as StoredBuildOpsProject | null;

    const reusedBuildOpsProject = Boolean(existingProject);
    const reusedMilestones = hasStoredMilestones(existingProject?.sourceToolResult ?? null);
    const reusedEvidenceRequirements = hasStoredEvidence(existingProject?.sourceToolResult ?? null);

    const sourceToolInput = {
      sourceKind: artifacts.sourceKind,
      jobId: job.id,
      projectIntakeId: intake?.id ?? null,
      trade: artifacts.trade,
      tool: artifacts.toolName,
      toolInput: artifacts.toolInput,
      missingInputs: artifacts.missingInputs,
    };

    const sourceToolResult = {
      schemaVersion: SOURCE_TOOL_RESULT_SCHEMA_VERSION,
      bridgeVersion: 1,
      sourceKind: artifacts.sourceKind,
      projectIntakeId: intake?.id ?? null,
      job: {
        id: job.id,
        title: job.title,
        category: job.category,
        status: job.status,
        location: job.location,
        urgency: job.urgency,
      },
      estimate: {
        status: artifacts.estimateStatus,
        scopeSummary: artifacts.scopeSummary,
        missingInputs: artifacts.missingInputs,
        tool: artifacts.toolName,
        quoteSummary: artifacts.quoteSummary,
      },
      toolResult: artifacts.toolResult,
      matching,
      milestonePlan: artifacts.milestonePlan,
      evidenceChecklist: artifacts.evidenceChecklist,
      escrowPlan: artifacts.escrowPlan,
      paymentReadiness: {
        status: paymentStatus,
        ready: rawPaymentReadiness.ready,
        checks: rawPaymentReadiness.checks,
        reasons: rawPaymentReadiness.reasons,
        reservationId: rawPaymentReadiness.reservationId,
        contractId: rawPaymentReadiness.contractId,
      },
      warnings: artifacts.warnings,
      recommendations: artifacts.recommendations,
      syncedAt: new Date().toISOString(),
    };

    const budgetEstimate = artifacts.budgetEstimate;

    const project = existingProject
      ? await this.prisma.buildOpsProject.update({
          where: { id: existingProject.id },
          data: {
            title: job.title,
            description: artifacts.scopeSummary,
            trade: artifacts.trade,
            projectType: artifacts.projectType,
            clientName: job.clientOrg.name,
            location: job.location ?? intake?.city ?? "TBD",
            budgetEstimate: budgetEstimate != null ? new Prisma.Decimal(budgetEstimate) : null,
            status: "estimating",
            riskScore: artifacts.riskScore,
            riskLevel: artifacts.riskLevel,
            sourceTool: "intake_operations_bridge",
            sourceToolInput: toJson(sourceToolInput),
            sourceToolResult: toJson(sourceToolResult),
          },
          select: { id: true },
        })
      : await this.prisma.buildOpsProject.create({
          data: {
            tenantId: input.tenantId,
            orgId: input.orgId,
            jobId: job.id,
            createdBy: input.userId,
            title: job.title,
            description: artifacts.scopeSummary,
            trade: artifacts.trade,
            projectType: artifacts.projectType,
            clientName: job.clientOrg.name,
            location: job.location ?? intake?.city ?? "TBD",
            budgetEstimate: budgetEstimate != null ? new Prisma.Decimal(budgetEstimate) : null,
            status: "estimating",
            riskScore: artifacts.riskScore,
            riskLevel: artifacts.riskLevel,
            sourceTool: "intake_operations_bridge",
            sourceToolInput: toJson(sourceToolInput),
            sourceToolResult: toJson(sourceToolResult),
            completion: artifacts.estimateStatus === "ready" ? 15 : 5,
          },
          select: { id: true },
        });

    const templates = buildTaskTemplates({
      scopeSummary: artifacts.scopeSummary,
      missingInputs: artifacts.missingInputs,
      matching,
      estimateStatus: artifacts.estimateStatus,
      quoteTotal: artifacts.quoteSummary?.total ?? null,
      milestoneCount: artifacts.milestoneItems.length,
      evidenceCount: artifacts.evidenceItems.length,
      paymentStatus,
    });

    const existingTasks = (await this.prisma.buildOpsTask.findMany({
      where: {
        tenantId: input.tenantId,
        projectId: project.id,
        templateKey: { not: null },
      },
      select: {
        id: true,
        projectId: true,
        templateKey: true,
      },
    })) as StoredBuildOpsTask[];

    const existingTaskByTemplate = new Map(
      existingTasks
        .filter((task): task is StoredBuildOpsTask & { templateKey: string } => typeof task.templateKey === "string")
        .map((task) => [task.templateKey, task]),
    );

    const taskIds: string[] = [];
    let tasksCreated = 0;
    let tasksReused = 0;

    for (const template of templates) {
      const existingTask = existingTaskByTemplate.get(template.templateKey);
      if (existingTask) {
        const updated = await this.prisma.buildOpsTask.update({
          where: { id: existingTask.id },
          data: {
            title: template.title,
            description: template.description,
            priority: template.priority,
            sourceTool: "intake_operations_bridge",
            evidenceRequired: toJson(template.evidenceRequired),
          },
          select: { id: true },
        });
        taskIds.push(updated.id);
        tasksReused += 1;
        continue;
      }

      const created = await this.prisma.buildOpsTask.create({
        data: {
          tenantId: input.tenantId,
          orgId: input.orgId,
          projectId: project.id,
          templateKey: template.templateKey,
          createdBy: input.userId,
          title: template.title,
          description: template.description,
          priority: template.priority,
          sourceTool: "intake_operations_bridge",
          evidenceRequired: toJson(template.evidenceRequired),
        },
        select: { id: true },
      });
      taskIds.push(created.id);
      tasksCreated += 1;
    }

    const result: IntakeOperationsBridgeResult = {
      projectIntakeId: intake?.id ?? null,
      jobId: job.id,
      buildOpsProjectId: project.id,
      buildOpsTaskIds: taskIds,
      tasksCreated,
      tasksReused,
      estimate: {
        status: artifacts.estimateStatus,
        scopeSummary: artifacts.scopeSummary,
        missingInputs: artifacts.missingInputs,
        tool: artifacts.toolName,
        quoteTotal: artifacts.quoteSummary?.total ?? null,
      },
      matching,
      milestones: {
        storage: "buildops_project.sourceToolResult",
        count: artifacts.milestoneItems.length,
        created: reusedMilestones ? 0 : artifacts.milestoneItems.length,
        reused: reusedMilestones ? artifacts.milestoneItems.length : 0,
        items: artifacts.milestoneItems,
      },
      evidenceRequirements: {
        storage: "buildops_project.sourceToolResult",
        count: artifacts.evidenceItems.length,
        created: reusedEvidenceRequirements ? 0 : artifacts.evidenceItems.length,
        reused: reusedEvidenceRequirements ? artifacts.evidenceItems.length : 0,
        items: artifacts.evidenceItems,
      },
      paymentReadiness: {
        status: paymentStatus,
        ready: rawPaymentReadiness.ready,
        reason: paymentReason,
        suggestedDeposit: artifacts.quoteSummary?.recommendedDeposit ?? artifacts.escrowPlan?.initialDeposit ?? null,
        suggestedEscrow: artifacts.quoteSummary?.recommendedEscrow ?? artifacts.escrowPlan?.totalAmount ?? null,
        checks: rawPaymentReadiness.checks,
      },
      idempotency: {
        reusedBuildOpsProject,
        reusedTasks: tasksCreated === 0,
        reusedMilestones,
        reusedEvidenceRequirements,
      },
    };

    // Trigger operational intelligence evaluation after bridge creates/updates project
    void this.intelligenceAgent?.evaluateBuildOpsProject({
      tenantId: input.tenantId,
      buildOpsProjectId: project.id,
      jobId: job.id,
      triggerEvent: "buildops.bridge.completed",
    }).catch((err) => this.logger.warn(`intelligence agent failed after bridge: ${(err as Error)?.message ?? String(err)}`));

    return result;
  }

  async computeBridgePlan(input: {
    jobId: string;
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
    rerunContext?: IntakeOperationsBridgeRerunContext | null;
  }): Promise<IntakeOperationsBridgeComputationResult> {
    const job = await this.findJobOrThrow(input.tenantId, input.jobId);
    this.assertAccess(input, job);

    const intake = await this.findIntakeByJob(job.tenantId, job.id);
    const artifacts = this.buildBridgeArtifacts(job, intake);
    const matching = await this.buildMatchingSummary(job.tenantId, job.id);
    const rawPaymentReadiness = await this.paymentsService.paymentReadinessByJob({
      tenantId: input.tenantId,
      orgId: input.orgId,
      userId: input.userId,
      roles: input.roles,
      jobId: job.id,
    });

    const paymentStatus = this.derivePaymentStatus(rawPaymentReadiness.ready, artifacts.quoteSummary != null);
    const paymentReason =
      rawPaymentReadiness.reasons[0]
      ?? (paymentStatus === "draft"
        ? "Estimate and escrow draft are prepared; assignment, project link, and contract are still pending."
        : null);

    const sourceToolInput = {
      sourceKind: artifacts.sourceKind,
      jobId: job.id,
      projectIntakeId: intake?.id ?? null,
      trade: artifacts.trade,
      tool: artifacts.toolName,
      toolInput: artifacts.toolInput,
      missingInputs: artifacts.missingInputs,
      rerunContext: input.rerunContext ?? null,
    };

    const sourceToolResult = {
      schemaVersion: SOURCE_TOOL_RESULT_SCHEMA_VERSION,
      bridgeVersion: 1,
      sourceKind: artifacts.sourceKind,
      projectIntakeId: intake?.id ?? null,
      rerunContext: input.rerunContext ?? null,
      job: {
        id: job.id,
        title: job.title,
        category: job.category,
        status: job.status,
        location: job.location,
        urgency: job.urgency,
      },
      estimate: {
        status: artifacts.estimateStatus,
        scopeSummary: artifacts.scopeSummary,
        missingInputs: artifacts.missingInputs,
        tool: artifacts.toolName,
        quoteSummary: artifacts.quoteSummary,
      },
      toolResult: artifacts.toolResult,
      matching,
      milestonePlan: artifacts.milestonePlan,
      evidenceChecklist: artifacts.evidenceChecklist,
      escrowPlan: artifacts.escrowPlan,
      paymentReadiness: {
        status: paymentStatus,
        ready: rawPaymentReadiness.ready,
        checks: rawPaymentReadiness.checks,
        reasons: rawPaymentReadiness.reasons,
        reservationId: rawPaymentReadiness.reservationId,
        contractId: rawPaymentReadiness.contractId,
      },
      warnings: artifacts.warnings,
      recommendations: artifacts.recommendations,
      syncedAt: new Date().toISOString(),
    };

    const taskTemplates = buildTaskTemplates({
      scopeSummary: artifacts.scopeSummary,
      missingInputs: artifacts.missingInputs,
      matching,
      estimateStatus: artifacts.estimateStatus,
      quoteTotal: artifacts.quoteSummary?.total ?? null,
      milestoneCount: artifacts.milestoneItems.length,
      evidenceCount: artifacts.evidenceItems.length,
      paymentStatus,
    });

    return {
      jobId: job.id,
      projectIntakeId: intake?.id ?? null,
      projectPatch: {
        title: job.title,
        description: artifacts.scopeSummary,
        trade: artifacts.trade,
        projectType: artifacts.projectType,
        clientName: job.clientOrg.name,
        location: job.location ?? intake?.city ?? "TBD",
        budgetEstimate: artifacts.budgetEstimate,
        status: "estimating",
        riskScore: artifacts.riskScore,
        riskLevel: artifacts.riskLevel,
        sourceTool: "intake_operations_bridge",
        completion: artifacts.estimateStatus === "ready" ? 15 : 5,
      },
      sourceToolInput,
      sourceToolResult,
      taskTemplates,
      estimate: {
        status: artifacts.estimateStatus,
        scopeSummary: artifacts.scopeSummary,
        missingInputs: artifacts.missingInputs,
        tool: artifacts.toolName,
        quoteTotal: artifacts.quoteSummary?.total ?? null,
      },
      matching,
      milestones: {
        count: artifacts.milestoneItems.length,
        items: artifacts.milestoneItems,
      },
      evidenceRequirements: {
        count: artifacts.evidenceItems.length,
        items: artifacts.evidenceItems,
      },
      paymentReadiness: {
        status: paymentStatus,
        ready: rawPaymentReadiness.ready,
        reason: paymentReason,
        suggestedDeposit: artifacts.quoteSummary?.recommendedDeposit ?? artifacts.escrowPlan?.initialDeposit ?? null,
        suggestedEscrow: artifacts.quoteSummary?.recommendedEscrow ?? artifacts.escrowPlan?.totalAmount ?? null,
        checks: rawPaymentReadiness.checks,
      },
    };
  }

  async syncProjectedBuildOpsTasks(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    buildOpsProjectId: string;
    taskTemplates: IntakeOperationsBridgeTaskTemplate[];
    tx?: Prisma.TransactionClient & Pick<PrismaService, "buildOpsTask">;
  }): Promise<{ taskIds: string[]; tasksCreated: number; tasksReused: number }> {
    const db = input.tx ?? this.prisma;
    const existingTasks = (await db.buildOpsTask.findMany({
      where: {
        tenantId: input.tenantId,
        projectId: input.buildOpsProjectId,
        templateKey: { not: null },
      },
      select: {
        id: true,
        projectId: true,
        templateKey: true,
      },
    })) as StoredBuildOpsTask[];

    const existingTaskByTemplate = new Map(
      existingTasks
        .filter((task): task is StoredBuildOpsTask & { templateKey: string } => typeof task.templateKey === "string")
        .map((task) => [task.templateKey, task]),
    );

    const taskIds: string[] = [];
    let tasksCreated = 0;
    let tasksReused = 0;

    for (const template of input.taskTemplates) {
      const existingTask = existingTaskByTemplate.get(template.templateKey);
      if (existingTask) {
        const updated = await db.buildOpsTask.update({
          where: { id: existingTask.id },
          data: {
            title: template.title,
            description: template.description,
            priority: template.priority,
            sourceTool: "intake_operations_bridge",
            evidenceRequired: toJson(template.evidenceRequired),
          },
          select: { id: true },
        });
        taskIds.push(updated.id);
        tasksReused += 1;
        continue;
      }

      const created = await db.buildOpsTask.create({
        data: {
          tenantId: input.tenantId,
          orgId: input.orgId,
          projectId: input.buildOpsProjectId,
          templateKey: template.templateKey,
          createdBy: input.userId,
          title: template.title,
          description: template.description,
          priority: template.priority,
          sourceTool: "intake_operations_bridge",
          evidenceRequired: toJson(template.evidenceRequired),
        },
        select: { id: true },
      });
      taskIds.push(created.id);
      tasksCreated += 1;
    }

    return {
      taskIds,
      tasksCreated,
      tasksReused,
    };
  }

  private async findJobOrThrow(tenantId: string, jobId: string): Promise<StoredJob> {
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        tenantId: true,
        clientOrgId: true,
        title: true,
        category: true,
        scope: true,
        status: true,
        location: true,
        urgency: true,
        budgetMin: true,
        budgetMax: true,
        clientOrg: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job '${jobId}' not found`);
    }

    return job as StoredJob;
  }

  private assertAccess(
    actor: { orgId: string; roles: string[] },
    job: StoredJob,
  ): void {
    if (actor.roles.includes("OPS_ADMIN")) {
      return;
    }
    if (job.clientOrgId !== actor.orgId) {
      throw new ForbiddenException("Only the client org or ops admin can bridge this job");
    }
  }

  private async findIntakeByJob(tenantId: string, jobId: string): Promise<ProjectIntakeRecord | null> {
    const row = (await this.prisma.projectIntake.findFirst({
      where: {
        tenantId,
        publishedJobId: jobId,
      },
    })) as StoredIntake | null;

    return row ? this.hydrateIntake(row) : null;
  }

  private hydrateIntake(row: StoredIntake): ProjectIntakeRecord {
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
      detectedCategory: (row.detectedCategory as import("../smart-intake/smart-intake.types.js").SmartIntakeCategory) ?? "interior_painting",
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

  private buildBridgeArtifacts(job: StoredJob, intake: ProjectIntakeRecord | null): BridgeArtifacts {
    const warnings = intake?.activeWarnings.map((warning) => warning.message.en) ?? [];
    const trade = mapDetectedTrade({ intake, job });
    const projectType = mapProjectType({ intake, trade });
    const scopeSummary = buildScopeSummary(job, intake);
    const estimateStatus = intake
      ? intake.generatedEstimate || intake.accuracyScore >= 36
        ? "ready"
        : "needs_more_info"
      : "not_available";
    const missingInputs = intake?.missingFields.length
      ? [...intake.missingFields]
      : intake
        ? []
        : ["project_intake", "measurements", "photos"];

    const toolArtifacts = this.tryBuildToolArtifacts(job, intake, scopeSummary, missingInputs, warnings);
    if (toolArtifacts) {
      return toolArtifacts;
    }

    const fallbackEstimate = intake
      ? intake.generatedEstimate ?? (intake.accuracyScore >= 36 ? generateEstimate(intake) : null)
      : null;
    const fallbackMilestones = intake
      ? (intake.generatedMilestones.length > 0 ? intake.generatedMilestones : fallbackEstimate ? generateMilestones(intake) : [])
      : [];
    const riskLevel = mapRiskLevel({ intake, warnings });
    const riskScore = mapRiskScore(riskLevel);
    const quoteSummary = fallbackEstimate ? buildQuoteFromEstimate(fallbackEstimate, riskLevel) : null;
    const totalAmount = quoteSummary?.total ?? midpoint(fallbackEstimate?.totalRange ?? null) ?? 0;
    const milestonePlan = fallbackMilestones.length > 0
      ? buildMilestonePlanFromIntake(trade, riskLevel, fallbackMilestones, totalAmount)
      : buildGenericMilestonePlan(trade, riskLevel, totalAmount);
    const milestoneItems = toBridgeMilestones(milestonePlan);
    const evidenceChecklist = buildEvidenceChecklistFromMilestones(trade, riskLevel, milestoneItems, missingInputs);
    const evidenceItems = toBridgeEvidence(evidenceChecklist);

    return {
      sourceKind: intake ? "smart_intake" : "job_only",
      trade,
      projectType,
      scopeSummary,
      missingInputs,
      estimateStatus,
      toolName: fallbackEstimate ? "smart_intake_formula" : null,
      toolInput: null,
      toolResult: null,
      quoteSummary,
      milestonePlan,
      milestoneItems,
      evidenceChecklist,
      evidenceItems,
      escrowPlan: quoteSummary ? buildEscrowPlanFromQuote(quoteSummary, milestoneItems, riskLevel, trade) : null,
      riskLevel,
      riskScore,
      budgetEstimate: quoteSummary?.total ?? midpoint(fallbackEstimate?.totalRange ?? null) ?? null,
      warnings,
      recommendations: fallbackEstimate
        ? fallbackEstimate.assumptions
        : ["Collect measurements, photos, and exact scope details before pricing."],
    };
  }

  /**
   * Dispatches to the correct trade engine based on intake.detectedCategory.
   * Returns null if no matching engine or insufficient data.
   */
  private tryBuildToolArtifacts(
    job: StoredJob,
    intake: ProjectIntakeRecord | null,
    scopeSummary: string,
    missingInputs: string[],
    warnings: string[],
  ): BridgeArtifacts | null {
    if (!intake) return null;

    const category = intake.detectedCategory;
    const resolvedTrade = mapDetectedTrade({ intake, job });
    const resolvedProjectType = mapProjectType({ intake, trade: resolvedTrade });

    // Helper: find a specific answer value
    const answer = (qId: string): string | null =>
      intake.answers.find(a => a.questionId === qId && !a.isNotSure)?.selectedValues[0] ?? null;

    let toolName: string;
    let toolInput: Record<string, unknown>;

    // ── Painting (interior) ────────────────────────────────────────────────
    if (category === "interior_painting" || category === "exterior_painting") {
      const areaSqft = resolveAreaSqft(intake);
      if (!areaSqft || areaSqft <= 0) return null;

      const wallHeightFt = 9;
      const baseSide = Math.max(6, round2(areaSqft / (4 * wallHeightFt)));
      const isExterior = category === "exterior_painting";
      toolName = "painting";
      toolInput = {
        roomLengthFt: round2(baseSide * 1.1),
        roomWidthFt: round2(baseSide),
        wallHeightFt,
        doors: areaSqft >= 320 ? 2 : 1,
        windows: areaSqft >= 450 ? 2 : 1,
        coats: Math.min(4, Math.max(1, intake.projectScope.paintCoats?.value ?? 2)),
        surfaceType: isExterior ? "exterior" : mapConditionToSurfaceType(intake.projectScope.condition?.value),
        includeCeiling: false,
        includePrimer: ["extensive_prep", "peeling_paint", "mold_or_moisture"].includes(
          intake.projectScope.condition?.value ?? "",
        ),
        paintQuality: "standard",
      };
    }

    // ── Drywall repair ─────────────────────────────────────────────────────
    else if (category === "drywall_repair") {
      const drywallAreaMap: Record<string, number> = {
        patches: 6, "10_100_sqft": 55, "100_500_sqft": 300, "over_500_sqft": 700,
      };
      const areaKey = answer("drywall_area") ?? "10_100_sqft";
      const wallArea = drywallAreaMap[areaKey] ?? 55;
      toolName = "drywall";
      toolInput = {
        wallAreaSqft: wallArea,
        ceilingAreaSqft: 0,
        panelType: answer("drywall_condition") === "water_damage" ? "moisture-resistant" : "regular",
        panelSize: "4x8",
        finishLevel: answer("drywall_finish") === "full_finish" ? 4 : answer("drywall_finish") === "paint_ready" ? 3 : 1,
        includeCeiling: false,
        repairMode: answer("drywall_type") === "repair" || answer("drywall_type") === "finishing",
        textureMatch: false,
      };
    }

    // ── Bathroom remodel ───────────────────────────────────────────────────
    else if (category === "bathroom_remodel") {
      const scopeMap: Record<string, "cosmetic" | "tile_floor" | "tub_shower" | "full_remodel"> = {
        cosmetic: "cosmetic", tile_floor: "tile_floor",
        tub_shower: "tub_shower", full_remodel: "full_remodel",
      };
      const sizeMap: Record<string, "small" | "medium" | "large" | "extra_large"> = {
        small: "small", medium: "medium", large: "large", extra_large: "extra_large",
      };
      const plumbingMap: Record<string, "no_move" | "fixtures_only" | "relocate"> = {
        no_move: "no_move", fixtures_only: "fixtures_only", relocate: "relocate",
      };
      const matMap: Record<string, "budget" | "standard" | "premium"> = {
        budget: "budget", standard: "standard", premium: "premium",
      };
      const scope = scopeMap[answer("bathroom_scope") ?? "full_remodel"] ?? "full_remodel";
      toolName = "bathroom";
      toolInput = {
        scope,
        bathroomSqFt: sizeMap[answer("bathroom_size") ?? "medium"] ?? "medium",
        plumbingWork: plumbingMap[answer("bathroom_plumbing") ?? "no_move"] ?? "no_move",
        materialQuality: matMap[answer("bathroom_materials") ?? "standard"] ?? "standard",
        includesShower: scope !== "cosmetic",
        includesTub: false,
        demoRequired: scope === "full_remodel" || scope === "tile_floor",
        clientProvidesMaterials: false,
      };
    }

    // ── Kitchen remodel ────────────────────────────────────────────────────
    else if (category === "kitchen_remodel") {
      const scopeMap: Record<string, "cabinet_update" | "countertops" | "flooring" | "full_remodel"> = {
        cabinet_update: "cabinet_update", countertops: "countertops",
        flooring: "flooring", full_remodel: "full_remodel",
      };
      const sizeMap: Record<string, "small" | "medium" | "large" | "extra_large"> = {
        small: "small", medium: "medium", large: "large", extra_large: "extra_large",
      };
      const applianceMap: Record<string, "no_appliances" | "basic_appliances" | "premium_appliances"> = {
        no_appliances: "no_appliances", basic_appliances: "basic_appliances", premium_appliances: "premium_appliances",
      };
      const matMap: Record<string, "budget" | "standard" | "premium"> = {
        budget: "budget", standard: "standard", premium: "premium",
      };
      const plumbingMap: Record<string, "no" | "minor" | "relocate"> = {
        no: "no", minor: "minor", relocate: "relocate",
      };
      toolName = "kitchen";
      toolInput = {
        scope: scopeMap[answer("kitchen_scope") ?? "full_remodel"] ?? "full_remodel",
        kitchenSize: sizeMap[answer("kitchen_size") ?? "medium"] ?? "medium",
        appliances: applianceMap[answer("kitchen_appliances") ?? "no_appliances"] ?? "no_appliances",
        materialQuality: matMap[answer("kitchen_materials") ?? "standard"] ?? "standard",
        plumbingElectrical: plumbingMap[answer("kitchen_plumbing") ?? "no"] ?? "no",
        clientProvidesMaterials: false,
      };
    }

    // ── Cleaning ───────────────────────────────────────────────────────────
    else if (category === "cleaning") {
      const typeMap: Record<string, "standard" | "deep" | "move_inout" | "post_construction" | "commercial"> = {
        standard: "standard", deep: "deep", move_inout: "move_inout",
        post_construction: "post_construction", commercial: "commercial",
      };
      const sizeToSqFt: Record<string, number> = {
        under_500: 350, "500_1000": 750, "1000_2000": 1500, over_2000: 2500,
      };
      const freqMap: Record<string, "one_time" | "weekly" | "biweekly" | "monthly"> = {
        one_time: "one_time", weekly: "weekly", biweekly: "biweekly", monthly: "monthly",
      };
      const cleaningType = typeMap[answer("cleaning_type") ?? "deep"] ?? "deep";
      toolName = "cleaning";
      toolInput = {
        serviceType: cleaningType,
        squareFt: sizeToSqFt[answer("cleaning_size") ?? "1000_2000"] ?? 1500,
        bedrooms: 2,
        bathrooms: 2,
        condition: cleaningType === "post_construction" ? "post_construction" : "moderate",
        addOns: answer("cleaning_extras") === "windows" ? ["windows"] : [],
        frequency: freqMap[answer("cleaning_frequency") ?? "one_time"] ?? "one_time",
        suppliesIncluded: true,
      };
    }

    // ── General carpentry ──────────────────────────────────────────────────
    else if (category === "general_carpentry") {
      toolName = "carpentry";
      const unitsMap: Record<string, number> = { small: 2, medium: 6, large: 12 };
      const matMap: Record<string, "standard" | "premium"> = {
        budget: "standard", standard: "standard", premium: "premium",
      };
      toolInput = {
        linearFt: unitsMap[answer("carpentry_units") ?? "medium"] ?? 6,
        materialType: answer("carpentry_type") ?? "doors",
        woodSpecies: matMap[answer("carpentry_material") ?? "standard"] === "premium" ? "oak" : "poplar",
        finishType: "painted",
        includesInstallation: true,
      };
    }

    // ── No matching engine ─────────────────────────────────────────────────
    else {
      return null;
    }

    try {
      const toolResult = this.toolsService.calculate({
        tool: toolName,
        mode: "professional",
        input: toolInput,
      }) as SemseToolResult;
      const quoteSummary    = this.toolsService.quote(toolResult);
      const milestonePlan   = this.toolsService.milestones(toolResult);
      const evidenceChecklist = this.toolsService.evidence(toolResult);
      const escrowPlan      = this.toolsService.escrow(toolResult);
      const milestoneItems  = toBridgeMilestones(milestonePlan);
      const evidenceItems   = toBridgeEvidence(evidenceChecklist);

      return {
        sourceKind: "smart_intake",
        trade: resolvedTrade,
        projectType: resolvedProjectType,
        scopeSummary,
        missingInputs,
        estimateStatus: toolResult.isValid ? "ready" : "needs_more_info",
        toolName,
        toolInput,
        toolResult,
        quoteSummary,
        milestonePlan,
        milestoneItems,
        evidenceChecklist,
        evidenceItems,
        escrowPlan,
        riskLevel: toolResult.risk.level,
        riskScore: toolResult.risk.score,
        budgetEstimate: quoteSummary.total,
        warnings: Array.from(new Set([...warnings, ...toolResult.warnings])),
        recommendations: toolResult.recommendations,
      };
    } catch {
      // If the engine fails, fall through to fallback
      return null;
    }
  }

  private async buildMatchingSummary(tenantId: string, jobId: string): Promise<BridgeMatchingSummary> {
    try {
      const result = await this.matchingService.matchJob(tenantId, {
        jobId,
        limit: 5,
        minScore: 0,
      });

      return {
        status: result.candidates.length > 0 ? "ready" : "no_candidates",
        candidatesEvaluated: result.candidatesEvaluated,
        candidateCount: result.candidates.length,
        topCandidates: result.candidates.map((candidate) => ({
          userId: candidate.userId,
          displayName: candidate.email,
          publicSlug: null,
          score: candidate.score,
          verificationStatus: candidate.verificationStatus,
          completedJobs: candidate.completedJobs,
          trustScore: candidate.trustScore,
        })),
        preferredCandidateStatus: result.preferredCandidateStatus?.state ?? null,
        algorithmVersion: result.algorithmVersion,
        computedAt: result.computedAt,
      };
    } catch {
      return {
        status: "not_available",
        candidatesEvaluated: 0,
        candidateCount: 0,
        topCandidates: [],
        preferredCandidateStatus: null,
        algorithmVersion: null,
        computedAt: null,
      };
    }
  }

  private derivePaymentStatus(ready: boolean, hasQuote: boolean): BridgePaymentReadinessStatus {
    if (ready) {
      return "ready";
    }
    return hasQuote ? "draft" : "not_ready";
  }
}
