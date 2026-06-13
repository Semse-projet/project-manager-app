from fastapi import APIRouter, HTTPException, Depends
import requests
from app.schemas.evidence import (
    EvidenceAnalyzeRequest, 
    EvidenceAnalyzeResponse,
    BeforeAfterRequest,
    BeforeAfterResult,
    DuplicateCheckRequest,
    DuplicateResult,
    QualityResult,
    RiskResult,
    GovernanceResult
)
from app.services.image_loader import load_image_from_url
from app.analyzers.blur import detect_blur
from app.analyzers.lighting import analyze_lighting
from app.analyzers.contrast import analyze_contrast
from app.analyzers.duplicate import calculate_dhash, check_duplicate
from app.analyzers.before_after import compare_before_after
from app.services.scoring import evaluate_quality
from app.services.governance import map_governance_rules
from app.utils.exif import extract_exif

router = APIRouter()

@router.post("/analyze", response_model=EvidenceAnalyzeResponse, tags=["evidence"])
def analyze_evidence_endpoint(request: EvidenceAnalyzeRequest):
    # 1. Load image and download raw bytes for EXIF extraction
    image = load_image_from_url(request.imageUrl)
    
    exif_metadata = {
        "timestamp": None,
        "cameraModel": None,
        "gps": None
    }
    
    # Only fetch remote bytes if it's not a local or mock URL
    url = request.imageUrl
    if not (url.startswith("mock://") or "localhost" in url or "127.0.0.1" in url):
        try:
            res = requests.get(url, timeout=10)
            if res.status_code == 200:
                exif_metadata = extract_exif(res.content)
        except Exception:
            pass
    
    # 2. Run analysis algorithms
    blur_score = detect_blur(image)
    brightness_score = analyze_lighting(image)
    contrast_score = analyze_contrast(image)
    
    # 3. Calculate perceptual hash
    img_hash = calculate_dhash(image)
    
    # 4. Evaluate quality
    quality_score, usable = evaluate_quality(blur_score, brightness_score, contrast_score)
    
    # 5. Handle duplicate checks if existing hashes are provided in metadata
    duplicate_risk = 0.0
    matched_idx = None
    existing_hashes = []
    
    if request.metadata and "existingHashes" in request.metadata:
        existing_hashes = request.metadata["existingHashes"]
        duplicate_risk, matched_idx = check_duplicate(img_hash, existing_hashes)
        
    # 6. Map to governance recommendation
    action, requires_review, auto_approve, reason = map_governance_rules(
        usable=usable,
        blur=blur_score,
        lighting=brightness_score,
        duplicate_risk=duplicate_risk
    )
    
    # 7. Collect reasons for risk
    reasons = []
    if duplicate_risk >= 0.85:
        reasons.append("DUPLICATE_SUSPECTED")
    if not usable:
        reasons.append("LOW_QUALITY")
        
    risk_level = "low"
    if reasons:
        risk_level = "critical" if "DUPLICATE_SUSPECTED" in reasons else "high"
        
    return EvidenceAnalyzeResponse(
        evidenceId=request.evidenceId,
        status="completed",
        quality=QualityResult(
            qualityScore=quality_score,
            blurScore=blur_score,
            brightnessScore=brightness_score,
            contrastScore=contrast_score,
            usable=usable
        ),
        duplicate=DuplicateResult(
            duplicateRisk=duplicate_risk,
            matchedHashIndex=matched_idx,
            hashValue=img_hash
        ),
        governance=GovernanceResult(
            recommendedAction=action,
            requiresHumanReview=requires_review,
            canAutoApprove=auto_approve,
            reason=reason
        ),
        rawResult={
            "riskLevel": risk_level,
            "reasons": reasons,
            "metadata": exif_metadata
        }
    )

@router.post("/compare-before-after", response_model=BeforeAfterResult, tags=["evidence"])
def compare_before_after_endpoint(request: BeforeAfterRequest):
    before_img = load_image_from_url(request.beforeImageUrl)
    after_img = load_image_from_url(request.afterImageUrl)
    
    change_score = compare_before_after(before_img, after_img)
    visual_progress = change_score >= 0.15
    
    return BeforeAfterResult(
        changeScore=change_score,
        visualProgressDetected=visual_progress,
        requiresHumanReview=not visual_progress
    )

@router.post("/check-duplicate", response_model=DuplicateResult, tags=["evidence"])
def check_duplicate_endpoint(request: DuplicateCheckRequest):
    image = load_image_from_url(request.imageUrl)
    img_hash = calculate_dhash(image)
    
    duplicate_risk, matched_idx = check_duplicate(img_hash, request.existingHashes)
    
    return DuplicateResult(
        duplicateRisk=duplicate_risk,
        matchedHashIndex=matched_idx,
        hashValue=img_hash
    )
