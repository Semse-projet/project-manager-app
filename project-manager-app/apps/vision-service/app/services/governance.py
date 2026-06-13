from typing import List, Tuple, Optional

def map_governance_rules(
    usable: bool,
    blur: float,
    lighting: float,
    duplicate_risk: float,
    change_score: Optional[float] = None
) -> Tuple[str, bool, bool, str]:
    """
    Decides the recommended action, requiresHumanReview, and canAutoApprove flags.
    Returns:
        - recommendedAction: str
        - requiresHumanReview: bool
        - canAutoApprove: bool
        - reason: str
    """
    reasons = []
    
    # 1. Check duplicate fraud
    if duplicate_risk >= 0.85:
        return (
            "flag_duplicate_evidence",
            True,
            False,
            "High risk of image duplication. Similarity exceeds fraud threshold."
        )
        
    # 2. Check quality/usability
    if not usable:
        if blur < 80.0:
            reasons.append("Image is too blurry.")
        if lighting < 40.0:
            reasons.append("Image is too dark.")
        if lighting > 230.0:
            reasons.append("Image is overexposed.")
            
        reason_msg = " ".join(reasons)
        return (
            "request_better_evidence",
            True,
            False,
            f"Evidence rejected. {reason_msg}"
        )
        
    # 3. Check before/after change if provided
    if change_score is not None:
        if change_score < 0.15:
            return (
                "send_to_human_review",
                True,
                False,
                "Insufficient visual change detected between before and after images."
            )
            
    # 4. Standard path: usable, no duplicates, satisfactory progress
    return (
        "approve_for_review",
        False,
        True,
        "Evidence passes all automated visual quality checks."
    )
