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
