def evaluate_quality(
    blur: float,
    lighting: float,
    contrast: float,
    trade_match: dict | None = None,
) -> tuple[float, bool]:
    """
    Evaluates image metrics and returns a quality score (0.0 to 1.0)
    and a boolean indicating if the image is usable.

    `trade_match` is the optional dict returned by `app.analyzers.trade_detector
    .detect_trade()` when an expected trade was supplied for this evidence. It is
    used to apply a conservative penalty when the detector believes the photo's
    subject doesn't match the expected trade (see weighting rationale below) —
    previously this signal only reached `rawResult`/metadata and never touched
    the numeric quality score (audit finding 0.26).
    """
    # 1. Blur evaluation: Laplacian variance.
    # Below 100 is blurry. Above 500 is very sharp.
    # Normalize variance to a score from 0.0 to 1.0.
    if blur < 50:
        blur_score = 0.1
    elif blur < 100:
        blur_score = 0.4
    elif blur < 250:
        blur_score = 0.8
    else:
        blur_score = 1.0
        
    # 2. Lighting evaluation: Mean brightness (0 to 255).
    # Ideal range is 60 to 200. Very dark (< 40) or very bright (> 230) is penalized.
    if lighting < 30 or lighting > 240:
        lighting_score = 0.2
    elif lighting < 60 or lighting > 210:
        lighting_score = 0.6
    else:
        lighting_score = 1.0
        
    # 3. Contrast evaluation: Standard deviation (0 to 128).
    # Ideal is > 30. Low contrast (< 15) is penalized.
    if contrast < 10:
        contrast_score = 0.2
    elif contrast < 20:
        contrast_score = 0.6
    else:
        contrast_score = 1.0
        
    # Weighted quality score
    quality_score = (blur_score * 0.5) + (lighting_score * 0.3) + (contrast_score * 0.2)

    # 4. Subject-match penalty (conservative, mid-term fix for audit 0.26): if the
    # trade detector was run and disagrees with the expected trade for this
    # evidence, nudge the score down instead of leaving a technically-sharp but
    # off-subject photo scored identically to an on-subject one.
    # Weighting chosen: capped at 0.15 (15% of the 0.0-1.0 scale), scaled by the
    # detector's own confidence in what it *did* detect. Rationale — this signal
    # is heuristic (edge density / color / texture profiles, not a trained
    # classifier), so a single mismatch must never be able to fail an otherwise
    # sharp, well-lit photo outright; it should only tip borderline cases. At
    # confidence 1.0 the penalty is 0.15, which is enough to move a 0.70 "passed"
    # photo into "manual_review" band territory upstream, but never enough by
    # itself to drop a good photo straight to "failed".
    if trade_match is not None and trade_match.get("match") is False:
        confidence = float(trade_match.get("confidence") or 0.0)
        penalty = min(0.15, max(0.0, confidence) * 0.15)
        quality_score = max(0.0, quality_score - penalty)

    # Determine usability
    # Usable if blur is not critical AND lighting/contrast is acceptable
    usable = blur >= 80.0 and lighting >= 40.0 and lighting <= 230.0 and contrast >= 15.0
    
    return float(quality_score), bool(usable)
