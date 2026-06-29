"""
Safety Detection Analyzer for BuildOps
Detects PPE (helmet, vest, harness) in construction site images
"""

import cv2
import numpy as np
from typing import TypedDict, Optional


class SafetyAnalysis(TypedDict):
    helmet_detected: bool
    vest_detected: bool
    harness_detected: bool
    compliance_score: float  # 0-1, higher = more PPE present
    violations: list[str]
    worker_safety_level: str  # "safe", "partial", "unsafe"


# PPE color ranges in HSV
PPE_COLOR_RANGES = {
    "helmet": [
        # Yellow helmet
        ([18, 100, 100], [25, 255, 255]),
        # Orange helmet
        ([8, 120, 120], [20, 255, 255]),
        # White/light helmet
        ([0, 0, 150], [180, 50, 255]),
        # Red helmet
        ([0, 100, 100], [10, 255, 200]),
    ],
    "vest": [
        # Fluorescent orange/orange-red
        ([0, 150, 150], [15, 255, 255]),
        ([8, 150, 150], [20, 255, 255]),
        # Fluorescent green/lime
        ([30, 150, 150], [50, 255, 255]),
        # Reflective materials
        ([0, 0, 180], [180, 30, 255]),
    ],
    "harness": [
        # Black straps
        ([0, 0, 30], [180, 255, 100]),
        # Dark gray straps
        ([0, 0, 50], [180, 50, 150]),
        # Orange/yellow straps (common)
        ([8, 100, 100], [25, 255, 255]),
    ],
}


def detect_safety_equipment(image_array: np.ndarray) -> SafetyAnalysis:
    """
    Detect PPE and safety equipment in construction site image

    Args:
        image_array: OpenCV image (BGR)

    Returns:
        SafetyAnalysis with PPE detection results and compliance score
    """
    hsv = cv2.cvtColor(image_array, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(image_array, cv2.COLOR_BGR2GRAY)
    height, width = image_array.shape[:2]

    # Detect each PPE type
    helmet = detect_helmet(hsv, height, width)
    vest = detect_safety_vest(hsv, height, width)
    harness = detect_harness(hsv, gray, height, width)

    # Calculate compliance score
    ppe_count = sum([helmet, vest, harness])
    compliance_score = ppe_count / 3.0  # 0-1

    # Determine safety level
    if helmet and vest:
        safety_level = "safe"
        violations = []
    elif helmet or vest:
        safety_level = "partial"
        violations = []
        if not helmet:
            violations.append("No helmet detected - head protection required")
        if not vest:
            violations.append("No safety vest detected - high-visibility protection required")
    else:
        safety_level = "unsafe"
        violations = [
            "No helmet detected - head protection required",
            "No safety vest detected - high-visibility protection required",
        ]

    # Additional violations
    if not harness:
        # Only critical if person is at height (inferred from image composition)
        pass

    return SafetyAnalysis(
        helmet_detected=helmet,
        vest_detected=vest,
        harness_detected=harness,
        compliance_score=min(1.0, compliance_score),
        violations=violations,
        worker_safety_level=safety_level,
    )


def detect_helmet(hsv: np.ndarray, height: int, width: int) -> bool:
    """
    Detect hard hat/helmet in upper portion of image
    Helmets typically appear in upper 50% and have circular/dome shape
    """
    upper_roi = hsv[: height // 2, :]  # Top half of image where heads typically are

    helmet_pixels = 0
    total_pixels = upper_roi.shape[0] * upper_roi.shape[1]

    for color_range in PPE_COLOR_RANGES["helmet"]:
        lower_hsv, upper_hsv = np.array(color_range[0]), np.array(color_range[1])
        mask = cv2.inRange(upper_roi, lower_hsv, upper_hsv)
        helmet_pixels += np.count_nonzero(mask)

    helmet_ratio = helmet_pixels / total_pixels
    return helmet_ratio > 0.01  # >1% of upper region


def detect_safety_vest(hsv: np.ndarray, height: int, width: int) -> bool:
    """
    Detect high-visibility safety vest
    Vests have fluorescent colors and appear in torso area (30%-70% of image height)
    """
    torso_start = int(height * 0.25)
    torso_end = int(height * 0.75)
    torso_roi = hsv[torso_start:torso_end, :]

    vest_pixels = 0
    total_pixels = torso_roi.shape[0] * torso_roi.shape[1]

    for color_range in PPE_COLOR_RANGES["vest"]:
        lower_hsv, upper_hsv = np.array(color_range[0]), np.array(color_range[1])
        mask = cv2.inRange(torso_roi, lower_hsv, upper_hsv)
        vest_pixels += np.count_nonzero(mask)

    vest_ratio = vest_pixels / total_pixels
    return vest_ratio > 0.02  # >2% of torso region


def detect_harness(hsv: np.ndarray, gray: np.ndarray, height: int, width: int) -> bool:
    """
    Detect safety harness using contour patterns
    Harnesses create distinctive X or strapped patterns across torso
    """
    # Look for diagonal/crossing lines (straps) in torso area
    torso_gray = gray[int(height * 0.25) : int(height * 0.75), :]

    # Edge detection to find strap lines
    edges = cv2.Canny(torso_gray, 50, 150)

    # Find contours (straps create distinct contours)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Harnesses create 4-6 distinct straps/contours in characteristic pattern
    if len(contours) >= 3:
        # Check if contours form strap-like patterns
        strap_like = 0
        for contour in contours:
            area = cv2.contourArea(contour)
            # Straps are long, thin contours (high aspect ratio)
            if area > 50:  # Minimum size to be relevant
                x, y, w, h = cv2.boundingRect(contour)
                if h > w * 2:  # Tall and thin = strap-like
                    strap_like += 1

        return strap_like >= 2  # At least 2 strap-like contours

    return False


def estimate_height_risk(image_array: np.ndarray) -> float:
    """
    Estimate if worker is at height (risk multiplier)
    Based on image composition: empty sky, architectural elements suggesting elevation
    Returns 0-1 where 1 = high risk of fall
    """
    hsv = cv2.cvtColor(image_array, cv2.COLOR_BGR2HSV)

    # Look for sky (light blue/cyan in upper portion)
    upper_roi = hsv[: image_array.shape[0] // 3, :]
    sky_mask = cv2.inRange(upper_roi, np.array([80, 50, 100]), np.array([130, 150, 255]))
    sky_ratio = np.count_nonzero(sky_mask) / (upper_roi.shape[0] * upper_roi.shape[1])

    # High sky visibility + clear horizon = likely at height
    return min(1.0, sky_ratio * 2)  # Scale up to 0-1 range


def generate_safety_notes(analysis: SafetyAnalysis, height_risk: float) -> list[str]:
    """Generate human-readable safety observations"""
    notes = []

    if analysis["helmet_detected"]:
        notes.append("✓ Hard hat/helmet detected")
    else:
        notes.append("⚠ No head protection (helmet/hard hat) visible")

    if analysis["vest_detected"]:
        notes.append("✓ High-visibility vest detected")
    else:
        notes.append("⚠ No high-visibility vest detected")

    if analysis["harness_detected"]:
        notes.append("✓ Safety harness/straps detected")
    elif height_risk > 0.5:
        notes.append("⚠ No harness detected (critical if at height)")

    if analysis["worker_safety_level"] == "unsafe":
        notes.append("🚨 Multiple PPE violations - work should not proceed")
    elif analysis["worker_safety_level"] == "partial":
        notes.append("⚠ Partial PPE compliance - some required equipment missing")
    else:
        notes.append("✓ Full PPE compliance detected")

    return notes


def calculate_compliance_score(analysis: SafetyAnalysis, height_risk: float) -> float:
    """
    Calculate adjusted compliance score based on height risk
    At-height work requires stricter PPE compliance
    """
    base_score = analysis["compliance_score"]

    if height_risk > 0.6:
        # At height: must have helmet + vest + harness
        if analysis["helmet_detected"] and analysis["vest_detected"] and analysis["harness_detected"]:
            return 1.0
        elif analysis["helmet_detected"] and analysis["vest_detected"]:
            return 0.7  # Missing harness is major issue at height
        elif analysis["helmet_detected"] or analysis["vest_detected"]:
            return 0.4
        else:
            return 0.0  # Critical failure at height

    # Ground-level work: helmet + vest sufficient
    if analysis["helmet_detected"] and analysis["vest_detected"]:
        return 1.0
    elif analysis["helmet_detected"] or analysis["vest_detected"]:
        return 0.6
    else:
        return 0.0
