export type BilingualString = {
  es: string;
  en: string;
};

export type AccuracyLevel = "low" | "medium" | "good" | "high";

export type IntakeStatus =
  | "draft"
  | "needs_more_info"
  | "ready_for_estimate"
  | "estimate_generated"
  | "published";

export type PricingMode = "per_area" | "hourly" | "fixed" | "not_sure" | "other";

export type EstimateConfidence = "low" | "medium" | "high";

export type WarningSeverity = "info" | "caution" | "critical";

export type AnswerType =
  | "single_choice"
  | "multi_choice"
  | "number"
  | "text"
  | "image"
  | "area_selector";

export type ShowWhenOperator = "equals" | "includes" | "exists" | "not_exists";

export type SmartIntakeCategory =
  | "interior_painting"
  | "exterior_painting"
  | "drywall_repair"
  | "bathroom_remodel"
  | "kitchen_remodel"
  | "cleaning"
  | "general_carpentry";

export type ConfidenceLevel = "exact" | "estimated" | "unknown";

export type IntakeOption = {
  label: BilingualString;
  value: string;
  opensTextField?: boolean;
  hint?: BilingualString;
};

export type IntakeQuestion = {
  id: string;
  category: SmartIntakeCategory;
  step: number;
  label: BilingualString;
  description?: BilingualString;
  required: boolean;
  affectsEstimate: boolean;
  estimateImpact?: "low" | "medium" | "high";
  answerType: AnswerType;
  options?: IntakeOption[];
  allowOther: boolean;
  allowNotSure: boolean;
  tip?: BilingualString;
  warningIfSelected?: {
    optionValue: string;
    warningId: string;
  };
  showWhen?: {
    field: string;
    operator: ShowWhenOperator;
    value?: string;
  };
};

export type IntakeAnswer = {
  questionId: string;
  selectedValues: string[];
  customText?: string;
  isNotSure: boolean;
  answeredAt: string;
};

export type IntakeImageType = "before" | "damage" | "reference" | "material" | "other";

export type IntakeImage = {
  id: string;
  key: string;
  url: string;
  thumbnailUrl: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  imageType: IntakeImageType;
  evidenceStatus: "draft" | "attached_to_job";
};

export type EstimatePreference = {
  includeMaterials: boolean;
  includeLabor: boolean;
  pricingMode: PricingMode;
  customPricingText?: string;
  cleanupRequested?: boolean;
};

export type PaintingScope = {
  area?: {
    value?: number;
    unit?: "sqft" | "sqm";
    range?: string;
    confidence: ConfidenceLevel;
    customText?: string;
  };
  condition?: {
    value:
      | "good"
      | "minor_repairs"
      | "extensive_prep"
      | "peeling_paint"
      | "mold_or_moisture"
      | "not_sure"
      | "other";
    customText?: string;
  };
  paintCoats?: {
    value?: number;
    notSure?: boolean;
    customText?: string;
  };
  durationPreference?: {
    value:
      | "1_2_days"
      | "3_5_days"
      | "1_2_weeks"
      | "more_than_2_weeks"
      | "not_sure"
      | "other";
    customText?: string;
  };
};

export type CostRange = {
  min: number;
  max: number;
  currency: "USD";
};

export type ProjectEstimate = {
  id: string;
  intakeId: string;
  totalRange: CostRange;
  breakdown: {
    materials?: CostRange;
    labor?: CostRange;
    preparation?: CostRange;
    contingency?: CostRange;
  };
  includes: string[];
  excludes: string[];
  assumptions: string[];
  confidence: EstimateConfidence;
  confidenceReasons: string[];
  accuracyScoreAtGeneration: number;
  generatedAt: string;
  generatedBy: "smart_intake_formula";
};

export type ProjectMilestone = {
  id: string;
  intakeId: string;
  order: number;
  title: BilingualString;
  description?: BilingualString;
  estimatedDurationHours?: number;
  dependencies?: string[];
  paymentPercentage?: number;
  requiresEvidence: boolean;
  status: "pending" | "in_progress" | "completed" | "skipped";
};

export type IntakeWarning = {
  id: string;
  severity: WarningSeverity;
  triggeredBy: string;
  message: BilingualString;
  recommendation?: BilingualString;
};

export type LiveSummary = {
  category: string;
  area?: string;
  condition?: string;
  coats?: string;
  materials?: string;
  duration?: string;
  imageCount: number;
  pendingFields: string[];
};

export type ProjectIntakeRecord = {
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
  detectedCategory: SmartIntakeCategory;
  detectedSubcategory: string | null;
  modality: "on_site" | "remote" | "hybrid" | null;
  city: string | null;
  urgency: "low" | "medium" | "high" | "urgent" | null;
  detectedLanguage: "es" | "en";
  channel: string;
  categoryConfidence: number;
  accuracyScore: number;
  accuracyLevel: AccuracyLevel;
  missingFields: string[];
  recommendedFields: string[];
  answers: IntakeAnswer[];
  uploadedImages: IntakeImage[];
  estimatePreference: EstimatePreference;
  projectScope: PaintingScope;
  generatedEstimate: ProjectEstimate | null;
  generatedMilestones: ProjectMilestone[];
  activeWarnings: IntakeWarning[];
  status: IntakeStatus;
  createdAt: string;
  updatedAt: string;
  claimedAt?: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
};

