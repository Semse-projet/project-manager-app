from fastapi import APIRouter, HTTPException, Depends
import base64
import cv2
import requests
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.schemas.evidence import (
    EvidenceAnalyzeRequest,
    EvidenceAnalyzeResponse,
    BeforeAfterRequest,
    BeforeAfterResult,
    DuplicateCheckRequest,
    DuplicateResult,
    QualityResult,
    GovernanceResult,
    BlueprintRequest,
    BlueprintResult,
    PerspectiveCorrectionRequest,
    PerspectiveCorrectionResult,
    BinarizeRequest,
    BinarizeResult,
    AreaEstimateRequest,
    AreaEstimateResult,
    ConsistencyCheckRequest,
    ConsistencyCheckResult,
    TimelineRequest,
    TimelineResult,
    SafetyCheckRequest,
    SafetyCheckResult,
    ReferenceMatchRequest,
    ReferenceMatchResult,
    TradeDetectionRequest,
    TradeDetectionResult,
    BatchAnalyzeRequest,
    BatchAnalyzeResponse,
    BatchItemResult,
    DetectMaterialRequest,
    DetectMaterialResult,
    ClassifySpaceRequest,
    ClassifySpaceResult,
    AnalyzePortfolioRequest,
    PortfolioForensicsResult,
)
from app.services.image_loader import load_image_from_url, is_mock_or_local_url
from app.analyzers.blur import detect_blur
from app.analyzers.lighting import analyze_lighting
from app.analyzers.contrast import analyze_contrast
from app.analyzers.duplicate import calculate_dhash, check_duplicate
from app.analyzers.before_after import compare_before_after
from app.analyzers.perspective import correct_perspective
from app.analyzers.binarization import binarize_document
from app.analyzers.blueprint_contours import extract_blueprint_lines
from app.analyzers.trade_detector import detect_trade
from app.analyzers.reference_match import match_reference
from app.analyzers.safety_detector import detect_safety_equipment, estimate_height_risk, calculate_compliance_score
from app.analyzers.timeline_builder import build_progress_timeline
from app.analyzers.area_estimator import estimate_area
from app.analyzers.location_consistency import check_location_consistency
from app.analyzers.material_detector import detect_material
from app.analyzers.space_classifier import classify_space
from app.analyzers.portfolio_forensics import analyze_portfolio
from app.services.scoring import evaluate_quality
from app.services.governance import map_governance_rules
from app.utils.exif import extract_exif
from app.services.ollama_enricher import enrich

router = APIRouter()

@router.post("/analyze", response_model=EvidenceAnalyzeResponse, tags=["evidence"])
def analyze_evidence_endpoint(request: EvidenceAnalyzeRequest):
    # 1. Load image and download raw bytes for EXIF extraction
    image = load_image_from_url(request.imageUrl)

    # Optional perspective correction before quality analysis
    if request.metadata and request.metadata.get("correctPerspective"):
        image = correct_perspective(image)
    
    exif_metadata = {
        "timestamp": None,
        "cameraModel": None,
        "gps": None
    }
    
    # Only fetch remote bytes if it's not a local or mock URL
    url = request.imageUrl
    if not is_mock_or_local_url(url):
        try:
            res = requests.get(url, timeout=10)  # lgtm[py/full-ssrf]
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

    # 4. Optional trade detection — run before quality scoring so a subject
    # mismatch (audit 0.26) can feed into the numeric quality score below,
    # not just into rawResult/metadata as before.
    trade_match_result = None
    if request.trade:
        trade_match_result = detect_trade(image, request.trade)

    # 5. Evaluate quality (blends in the trade-match penalty, if any — see
    # scoring.evaluate_quality for the weighting rationale)
    quality_score, usable = evaluate_quality(
        blur_score, brightness_score, contrast_score, trade_match=trade_match_result
    )

    # 6. Handle duplicate checks if existing hashes are provided in metadata
    duplicate_risk = 0.0
    matched_idx = None
    existing_hashes = []

    if request.metadata and "existingHashes" in request.metadata:
        existing_hashes = request.metadata["existingHashes"]
        duplicate_risk, matched_idx = check_duplicate(img_hash, existing_hashes)

    # 7. Map to governance recommendation
    action, requires_review, auto_approve, reason = map_governance_rules(
        usable=usable,
        blur=blur_score,
        lighting=brightness_score,
        duplicate_risk=duplicate_risk
    )

    # 8. Collect reasons for risk
    reasons = []
    if duplicate_risk >= 0.85:
        reasons.append("DUPLICATE_SUSPECTED")
    if not usable:
        reasons.append("LOW_QUALITY")
    if trade_match_result and trade_match_result.get("match") is False:
        reasons.append("TRADE_MISMATCH")

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
            "metadata": exif_metadata,
            "tradeMatch": trade_match_result,
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

@router.post("/blueprint", response_model=BlueprintResult, tags=["evidence"])
def blueprint_endpoint(request: BlueprintRequest):
    image = load_image_from_url(request.imageUrl)
    result = extract_blueprint_lines(image)
    return BlueprintResult(
        lineCount=result["line_count"],
        density=result["density"],
        lines=result["lines"],
        isBlueprint=result["line_count"] > 10 and result["density"] > 0.05,
    )

@router.post("/perspective-correct", response_model=PerspectiveCorrectionResult, tags=["evidence"])
def perspective_correct_endpoint(request: PerspectiveCorrectionRequest):
    image = load_image_from_url(request.imageUrl)
    corrected = correct_perspective(image)
    corrected_flag = corrected.shape != image.shape or not (corrected == image).all()
    h, w = corrected.shape[:2]
    b64 = None
    if request.returnBase64:
        _, buf = cv2.imencode(".jpg", corrected)
        b64 = base64.b64encode(buf.tobytes()).decode("utf-8")
    return PerspectiveCorrectionResult(
        corrected=corrected_flag,
        base64Image=b64,
        widthPx=w,
        heightPx=h,
    )

@router.post("/document-binarize", response_model=BinarizeResult, tags=["evidence"])
def document_binarize_endpoint(request: BinarizeRequest):
    image = load_image_from_url(request.imageUrl)
    binarized = binarize_document(image)
    h, w = binarized.shape[:2]
    _, buf = cv2.imencode(".png", binarized)
    b64 = base64.b64encode(buf.tobytes()).decode("utf-8")
    return BinarizeResult(base64Image=b64, widthPx=w, heightPx=h)

@router.post("/estimate-area", response_model=AreaEstimateResult, tags=["evidence"])
def estimate_area_endpoint(request: AreaEstimateRequest):
    image = load_image_from_url(request.imageUrl)
    result = estimate_area(image)
    within_range = None
    if request.expectedAreaM2 is not None:
        ratio = result["estimatedAreaM2"] / (request.expectedAreaM2 + 1e-9)
        within_range = 0.70 <= ratio <= 1.30
    return AreaEstimateResult(**result, withinExpectedRange=within_range)

@router.post("/check-consistency", response_model=ConsistencyCheckResult, tags=["evidence"])
def check_consistency_endpoint(request: ConsistencyCheckRequest):
    if len(request.imageUrls) < 2:
        raise HTTPException(status_code=422, detail="At least 2 images required for consistency check")
    if len(request.imageUrls) > 20:
        raise HTTPException(status_code=422, detail="Maximum 20 images per consistency check")
    images = [load_image_from_url(url) for url in request.imageUrls]
    result = check_location_consistency(images)
    return ConsistencyCheckResult(**result)

@router.post("/progress-timeline", response_model=TimelineResult, tags=["evidence"])
def progress_timeline_endpoint(request: TimelineRequest):
    if len(request.imageUrls) < 2:
        raise HTTPException(status_code=422, detail="At least 2 images are required to build a timeline")
    if len(request.imageUrls) > 30:
        raise HTTPException(status_code=422, detail="Maximum 30 images per timeline")
    b64_gif = build_progress_timeline(
        image_urls=request.imageUrls,
        labels=request.labels,
        output_size=(request.outputWidth, request.outputHeight),
        fps=request.fps,
    )
    duration_ms = max(100, int(1000 / request.fps)) * len(request.imageUrls)
    return TimelineResult(
        base64Gif=b64_gif,
        frameCount=len(request.imageUrls),
        durationMs=duration_ms,
    )

@router.post("/safety-check", response_model=SafetyCheckResult, tags=["evidence"])
def safety_check_endpoint(request: SafetyCheckRequest):
    image = load_image_from_url(request.imageUrl)
    result = detect_safety_equipment(image)
    return SafetyCheckResult(**result)

@router.post("/match-reference", response_model=ReferenceMatchResult, tags=["evidence"])
def match_reference_endpoint(request: ReferenceMatchRequest):
    delivered = load_image_from_url(request.deliveredImageUrl)
    reference = load_image_from_url(request.referenceImageUrl)
    result = match_reference(delivered, reference)
    return ReferenceMatchResult(**result)

@router.post("/detect-trade", response_model=TradeDetectionResult, tags=["evidence"])
def detect_trade_endpoint(request: TradeDetectionRequest):
    image = load_image_from_url(request.imageUrl)
    result = detect_trade(image, request.expectedTrade)
    return TradeDetectionResult(**result)

@router.post("/detect-material", response_model=DetectMaterialResult, tags=["vision"])
def detect_material_endpoint(request: DetectMaterialRequest):
    image = load_image_from_url(request.imageUrl)
    cv_result = detect_material(image, request.expectedMaterial)
    insight = enrich("material", dict(cv_result)) if request.enrich else None
    return DetectMaterialResult(**cv_result, insight=insight)


@router.post("/classify-space", response_model=ClassifySpaceResult, tags=["vision"])
def classify_space_endpoint(request: ClassifySpaceRequest):
    image = load_image_from_url(request.imageUrl)
    cv_result = classify_space(image)
    insight = enrich("space", dict(cv_result)) if request.enrich else None
    return ClassifySpaceResult(**cv_result, insight=insight)


@router.post("/safety-check-enriched", response_model=SafetyCheckResult, tags=["vision"])
def safety_check_enriched_endpoint(request: SafetyCheckRequest):
    image = load_image_from_url(request.imageUrl)
    cv_result = detect_safety_equipment(image)
    insight = enrich("safety", cv_result)
    return SafetyCheckResult(
        helmetDetected=cv_result["helmet_detected"],
        vestDetected=cv_result["vest_detected"],
        harnessDetected=cv_result["harness_detected"],
        complianceScore=cv_result["compliance_score"],
        violations=cv_result["violations"],
        insight=insight,
    )


@router.post("/analyze-portfolio", response_model=PortfolioForensicsResult, tags=["vision"])
def analyze_portfolio_endpoint(request: AnalyzePortfolioRequest):
    image = load_image_from_url(request.imageUrl)
    cv_result = analyze_portfolio(image, request.imageHash)
    insight = enrich("portfolio", dict(cv_result)) if request.enrich else None
    return PortfolioForensicsResult(**cv_result, insight=insight)


def _analyze_single(item: EvidenceAnalyzeRequest) -> BatchItemResult:
    try:
        from fastapi.testclient import TestClient
        from app.main import app as vision_app
        import json
        client = TestClient(vision_app)
        resp = client.post("/v1/evidence/analyze", json=item.model_dump())
        if resp.status_code == 200:
            result = EvidenceAnalyzeResponse(**resp.json())
            return BatchItemResult(evidenceId=item.evidenceId, status="completed", result=result)
        return BatchItemResult(evidenceId=item.evidenceId, status="failed", error=resp.text)
    except Exception as e:
        return BatchItemResult(evidenceId=item.evidenceId, status="failed", error=str(e))

@router.post("/batch-analyze", response_model=BatchAnalyzeResponse, tags=["evidence"])
def batch_analyze_endpoint(request: BatchAnalyzeRequest):
    if len(request.items) > 20:
        raise HTTPException(status_code=422, detail="Batch size cannot exceed 20 items")
    t0 = time.monotonic()
    results: list[BatchItemResult] = []
    with ThreadPoolExecutor(max_workers=min(len(request.items), 8)) as executor:
        futures = {executor.submit(_analyze_single, item): item for item in request.items}
        for future in as_completed(futures):
            results.append(future.result())
    elapsed_ms = (time.monotonic() - t0) * 1000
    completed = sum(1 for r in results if r.status == "completed")
    failed = len(results) - completed
    return BatchAnalyzeResponse(
        total=len(results),
        completed=completed,
        failed=failed,
        batchDurationMs=round(elapsed_ms, 2),
        results=results,
    )


