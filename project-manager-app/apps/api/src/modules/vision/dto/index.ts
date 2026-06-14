export class AnalyzeEvidenceDto {
  evidenceId!: string;
  jobId?: string;
  milestoneId?: string;
  trade?: string;
  imageUrl!: string;
  expectedWork?: string;
  metadata?: Record<string, any>;
}

export interface QualityResultDto {
  qualityScore: number;
  blurScore: number;
  brightnessScore: number;
  contrastScore: number;
  usable: boolean;
}

export interface DuplicateResultDto {
  duplicateRisk: number;
  matchedHashIndex?: number;
  hashValue: string;
}

export interface BeforeAfterResultDto {
  changeScore: number;
  visualProgressDetected: boolean;
  requiresHumanReview: boolean;
}

export interface GovernanceResultDto {
  recommendedAction: string;
  requiresHumanReview: boolean;
  canAutoApprove: boolean;
  reason?: string;
}

export interface VisionResultDto {
  evidenceId: string;
  status: string;
  quality: QualityResultDto;
  duplicate?: DuplicateResultDto;
  progress?: BeforeAfterResultDto;
  governance: GovernanceResultDto;
  rawResult: Record<string, any>;
}

// --- Blueprint ---
export class BlueprintDto {
  imageUrl!: string;
  trade?: string;
}

export interface BlueprintResultDto {
  lineCount: number;
  density: number;
  lines: number[][];
  isBlueprint: boolean;
}

// --- Perspective Correction ---
export class PerspectiveCorrectionDto {
  imageUrl!: string;
  returnBase64?: boolean;
}

export interface PerspectiveCorrectionResultDto {
  corrected: boolean;
  base64Image?: string;
  widthPx: number;
  heightPx: number;
}

// --- Document Binarize ---
export class BinarizeDto {
  imageUrl!: string;
}

export interface BinarizeResultDto {
  base64Image: string;
  widthPx: number;
  heightPx: number;
}

// --- Area Estimator ---
export class AreaEstimateDto {
  imageUrl!: string;
  expectedAreaM2?: number;
}

export interface AreaEstimateResultDto {
  estimatedAreaM2: number;
  confidence: number;
  referenceObjectUsed: boolean;
  method: string;
  withinExpectedRange?: boolean;
}

// --- Location Consistency ---
export class ConsistencyCheckDto {
  imageUrls!: string[];
}

export interface ConsistencyCheckResultDto {
  consistencyScore: number;
  outlierIndices: number[];
  allSameLocation: boolean;
  pairwiseScores: number[];
}

// --- Progress Timeline ---
export class TimelineDto {
  imageUrls!: string[];
  labels?: string[];
  outputWidth?: number;
  outputHeight?: number;
  fps?: number;
}

export interface TimelineResultDto {
  base64Gif: string;
  frameCount: number;
  durationMs: number;
}

// --- Safety Check ---
export class SafetyCheckDto {
  imageUrl!: string;
  trade?: string;
}

export interface SafetyCheckResultDto {
  helmetDetected: boolean;
  vestDetected: boolean;
  harnessDetected: boolean;
  complianceScore: number;
  violations: string[];
}

// --- Reference Match ---
export class ReferenceMatchDto {
  deliveredImageUrl!: string;
  referenceImageUrl!: string;
}

export interface ReferenceMatchResultDto {
  similarityScore: number;
  orbMatchCount: number;
  orbScore: number;
  ssimScore: number;
  histogramScore: number;
  meetsStandard: boolean;
}

// --- Trade Detector ---
export class TradeDetectionDto {
  imageUrl!: string;
  expectedTrade?: string;
}

export interface TradeDetectionResultDto {
  detectedTrade: string;
  confidence: number;
  tradeScores: Record<string, number>;
  expectedTrade?: string;
  match?: boolean;
}

// --- Consistency by Evidence IDs ---
export class ConsistencyByIdsDto {
  evidenceIds!: string[];
}

// --- Batch Analyze ---
export class BatchAnalyzeItemDto {
  evidenceId!: string;
  jobId?: string;
  milestoneId?: string;
  trade?: string;
  imageUrl!: string;
  expectedWork?: string;
  metadata?: Record<string, any>;
}

export class BatchAnalyzeDto {
  items!: BatchAnalyzeItemDto[];
  jobId?: string;
  milestoneId?: string;
}

export interface BatchItemResultDto {
  evidenceId: string;
  status: string;
  result?: VisionResultDto;
  error?: string;
}

export interface BatchAnalyzeResultDto {
  total: number;
  completed: number;
  failed: number;
  batchDurationMs: number;
  results: BatchItemResultDto[];
}
