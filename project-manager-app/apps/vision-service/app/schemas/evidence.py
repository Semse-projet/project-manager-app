from pydantic import BaseModel, HttpUrl
from typing import Optional, List, Dict, Any

class EvidenceAnalyzeRequest(BaseModel):
    evidenceId: str
    jobId: Optional[str] = None
    milestoneId: Optional[str] = None
    trade: Optional[str] = None
    imageUrl: str
    expectedWork: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

# --- Blueprint ---
class BlueprintRequest(BaseModel):
    imageUrl: str
    trade: Optional[str] = None

class BlueprintResult(BaseModel):
    lineCount: int
    density: float
    lines: List[List[int]]
    isBlueprint: bool

# --- Perspective ---
class PerspectiveCorrectionRequest(BaseModel):
    imageUrl: str
    returnBase64: bool = False

class PerspectiveCorrectionResult(BaseModel):
    corrected: bool
    base64Image: Optional[str] = None
    widthPx: int
    heightPx: int

# --- Document Binarize ---
class BinarizeRequest(BaseModel):
    imageUrl: str

class BinarizeResult(BaseModel):
    base64Image: str
    widthPx: int
    heightPx: int

class BeforeAfterRequest(BaseModel):
    beforeImageUrl: str
    afterImageUrl: str
    trade: Optional[str] = None

class DuplicateCheckRequest(BaseModel):
    imageUrl: str
    existingHashes: List[str]  # Hashes to compare against

class QualityResult(BaseModel):
    qualityScore: float
    blurScore: float
    brightnessScore: float
    contrastScore: float
    usable: bool

class DuplicateResult(BaseModel):
    duplicateRisk: float
    matchedHashIndex: Optional[int] = None
    hashValue: str

class BeforeAfterResult(BaseModel):
    changeScore: float
    visualProgressDetected: bool
    requiresHumanReview: bool

class GovernanceResult(BaseModel):
    recommendedAction: str
    requiresHumanReview: bool
    canAutoApprove: bool
    reason: Optional[str] = None

class EvidenceAnalyzeResponse(BaseModel):
    evidenceId: str
    status: str
    quality: QualityResult
    duplicate: Optional[DuplicateResult] = None
    progress: Optional[BeforeAfterResult] = None
    governance: GovernanceResult
    rawResult: Dict[str, Any]

# --- Area Estimator ---
class AreaEstimateRequest(BaseModel):
    imageUrl: str
    expectedAreaM2: Optional[float] = None

class AreaEstimateResult(BaseModel):
    estimatedAreaM2: float
    confidence: float
    referenceObjectUsed: bool
    method: str
    withinExpectedRange: Optional[bool] = None

# --- Location Consistency ---
class ConsistencyCheckRequest(BaseModel):
    imageUrls: List[str]

class ConsistencyCheckResult(BaseModel):
    consistencyScore: float
    outlierIndices: List[int]
    allSameLocation: bool
    pairwiseScores: List[float]

# --- Progress Timeline ---
class TimelineRequest(BaseModel):
    imageUrls: List[str]
    labels: Optional[List[str]] = None
    outputWidth: int = 640
    outputHeight: int = 480
    fps: int = 2

class TimelineResult(BaseModel):
    base64Gif: str
    frameCount: int
    durationMs: int

# --- Safety Detection ---
class SafetyCheckRequest(BaseModel):
    imageUrl: str
    trade: Optional[str] = None

class SafetyCheckResult(BaseModel):
    helmetDetected: bool
    vestDetected: bool
    harnessDetected: bool
    complianceScore: float
    violations: List[str]

# --- Reference Match ---
class ReferenceMatchRequest(BaseModel):
    deliveredImageUrl: str
    referenceImageUrl: str

class ReferenceMatchResult(BaseModel):
    similarityScore: float
    orbMatchCount: int
    orbScore: float
    ssimScore: float
    histogramScore: float
    meetsStandard: bool

# --- Trade Detector ---
class TradeDetectionRequest(BaseModel):
    imageUrl: str
    expectedTrade: Optional[str] = None

class TradeDetectionResult(BaseModel):
    detectedTrade: str
    confidence: float
    tradeScores: Dict[str, float]
    expectedTrade: Optional[str] = None
    match: Optional[bool] = None

# --- Batch Analyze (depends on EvidenceAnalyzeResponse) ---
class BatchAnalyzeRequest(BaseModel):
    items: List[EvidenceAnalyzeRequest]
    jobId: Optional[str] = None
    milestoneId: Optional[str] = None

class BatchItemResult(BaseModel):
    evidenceId: str
    status: str
    result: Optional[EvidenceAnalyzeResponse] = None
    error: Optional[str] = None

class BatchAnalyzeResponse(BaseModel):
    total: int
    completed: int
    failed: int
    batchDurationMs: float
    results: List[BatchItemResult]

# --- Material Detection ---
class DetectMaterialRequest(BaseModel):
    imageUrl: str
    expectedMaterial: Optional[str] = None

class DetectMaterialResult(BaseModel):
    material: str
    condition: str
    confidence: float
    estimated_stock: Optional[str] = None
    notes: List[str] = []
