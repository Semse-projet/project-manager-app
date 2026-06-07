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

export type IntakeWarning = {
  id: string;
  severity: "info" | "caution" | "critical";
  triggeredBy: string;
  message: BilingualString;
  recommendation?: BilingualString;
};

export type IntakeQuestion = {
  id: string;
  step: number;
  required: boolean;
  affectsEstimate: boolean;
  estimateImpact?: "low" | "medium" | "high";
  answerType: "single_choice" | "multi_choice" | "number" | "text" | "image" | "area_selector";
  label: BilingualString;
  description?: BilingualString;
  options?: Array<{
    label: BilingualString;
    value: string;
    hint?: BilingualString;
  }>;
  allowOther: boolean;
  allowNotSure: boolean;
  tip?: BilingualString;
  warningIfSelected?: {
    optionValue: string;
    warningId: string;
  };
};

export type IntakeAnswerInput = {
  questionId: string;
  selectedValues: string[];
  customText?: string;
  isNotSure: boolean;
};

export type IntakeImage = {
  id: string;
  key: string;
  url: string;
  thumbnailUrl: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  imageType: "before" | "damage" | "reference" | "material" | "other";
  evidenceStatus: "draft" | "attached_to_job";
};

export type ProjectEstimate = {
  id: string;
  intakeId: string;
  totalRange: {
    min: number;
    max: number;
    currency: "USD";
  };
  breakdown: {
    materials?: { min: number; max: number; currency: "USD" };
    labor?: { min: number; max: number; currency: "USD" };
    preparation?: { min: number; max: number; currency: "USD" };
    contingency?: { min: number; max: number; currency: "USD" };
  };
  includes: string[];
  excludes: string[];
  assumptions: string[];
  confidence: "low" | "medium" | "high";
  confidenceReasons: string[];
  accuracyScoreAtGeneration: number;
  generatedAt: string;
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

export type ProjectIntake = {
  id: string;
  rawDescription: string;
  providedTitle?: string | null;
  normalizedTitle: string;
  selectedCategoryId?: string | null;
  selectedSubcategoryId?: string | null;
  modality?: "on_site" | "remote" | "hybrid" | null;
  city?: string | null;
  urgency?: "low" | "medium" | "high" | "urgent" | null;
  detectedLanguage: "es" | "en";
  categoryConfidence: number;
  accuracyScore: number;
  accuracyLevel: AccuracyLevel;
  missingFields: string[];
  recommendedFields: string[];
  uploadedImages: IntakeImage[];
  generatedEstimate?: ProjectEstimate | null;
  generatedMilestones?: ProjectMilestone[];
  activeWarnings: IntakeWarning[];
  status: IntakeStatus;
};

export type AnalyzeIntakeResponse = {
  intakeId: string;
  detectedCategory: string;
  categoryConfidence: number;
  accuracyScore: number;
  accuracyLevel: AccuracyLevel;
  missingFields: string[];
  tips: BilingualString[];
  nextQuestion: IntakeQuestion | null;
  estimateUnlocked: boolean;
  status: IntakeStatus;
};

export type AnswerIntakeResponse = {
  accuracyScore: number;
  accuracyLevel: AccuracyLevel;
  missingFields: string[];
  activeWarnings: IntakeWarning[];
  tips: BilingualString[];
  nextQuestion: IntakeQuestion | null;
  estimateUnlocked: boolean;
  liveSummary: LiveSummary;
  status: IntakeStatus;
};

export type EstimateIntakeResponse = {
  estimate: ProjectEstimate;
  milestones: ProjectMilestone[];
  status: IntakeStatus;
};

