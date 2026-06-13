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
