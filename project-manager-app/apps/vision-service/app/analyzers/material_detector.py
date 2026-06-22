"""
Material Detection Analyzer for ProTools
Identifies construction materials and condition using OpenCV
"""

import cv2
import numpy as np
from typing import TypedDict, Optional


class MaterialAnalysis(TypedDict):
    material: str  # "drywall", "wood", "brick", "tile", "concrete", "metal"
    condition: str  # "new", "good", "fair", "damaged"
    confidence: float  # 0-1
    estimated_stock: Optional[str]  # "abundant", "moderate", "low"
    notes: list[str]


# Color-based material fingerprints (HSV ranges for detection)
MATERIAL_PROFILES = {
    "drywall": {
        "primary_hsv": [(0, 0, 180), (180, 30, 255)],  # Light gray/white
        "edge_density": (0.02, 0.12),
        "texture_variance": (50, 400),
    },
    "wood": {
        "primary_hsv": [(10, 40, 100), (25, 100, 200)],  # Brown/tan
        "edge_density": (0.05, 0.25),
        "texture_variance": (200, 1500),
    },
    "brick": {
        "primary_hsv": [(0, 50, 100), (15, 255, 200)],  # Red/orange
        "edge_density": (0.15, 0.40),
        "texture_variance": (400, 2000),
    },
    "tile": {
        "primary_hsv": [(0, 0, 150), (180, 50, 255)],  # Light/glossy
        "edge_density": (0.08, 0.20),
        "texture_variance": (50, 300),
        "reflectance": True,
    },
    "concrete": {
        "primary_hsv": [(0, 0, 120), (180, 20, 180)],  # Dark gray
        "edge_density": (0.10, 0.30),
        "texture_variance": (800, 2500),
    },
    "metal": {
        "primary_hsv": [(0, 0, 100), (180, 30, 200)],  # Gray/silver
        "edge_density": (0.05, 0.15),
        "reflectance": True,
    },
}


def detect_material(image_array: np.ndarray, expected_material: Optional[str] = None) -> MaterialAnalysis:
    """
    Detect material type and condition from construction site image

    Args:
        image_array: OpenCV image (BGR)
        expected_material: Optional hint for material type

    Returns:
        MaterialAnalysis with detected material, condition, confidence
    """
    # Convert to HSV for color analysis
    hsv = cv2.cvtColor(image_array, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(image_array, cv2.COLOR_BGR2GRAY)

    # Compute texture metrics
    edge_density = compute_edge_density(gray)
    texture_variance = gray.var()
    dominant_hue = compute_dominant_hue(hsv)

    # Score each material
    scores = {}
    for mat_name, profile in MATERIAL_PROFILES.items():
        score = score_material(
            hsv, gray,
            profile,
            edge_density,
            texture_variance,
            dominant_hue,
            expected_material == mat_name
        )
        scores[mat_name] = score

    # Select best match
    best_material = max(scores, key=scores.get)
    confidence = scores[best_material]

    # Analyze condition
    condition = analyze_condition(gray, edge_density, texture_variance, best_material)
    stock = estimate_stock(image_array, best_material)

    return MaterialAnalysis(
        material=best_material,
        condition=condition,
        confidence=min(confidence, 1.0),
        estimated_stock=stock,
        notes=generate_notes(best_material, condition, edge_density, texture_variance)
    )


def compute_edge_density(gray: np.ndarray) -> float:
    """Compute ratio of edge pixels to total pixels"""
    edges = cv2.Canny(gray, 50, 150)
    total_pixels = gray.shape[0] * gray.shape[1]
    edge_pixels = np.count_nonzero(edges)
    return edge_pixels / total_pixels


def compute_dominant_hue(hsv: np.ndarray) -> int:
    """Find dominant hue value in image"""
    h_channel = hsv[:, :, 0]
    hist = cv2.calcHist([h_channel], [0], None, [180], [0, 180])
    return int(np.argmax(hist))


def score_material(
    hsv: np.ndarray,
    gray: np.ndarray,
    profile: dict,
    edge_density: float,
    texture_variance: float,
    dominant_hue: int,
    is_expected: bool = False
) -> float:
    """Score likelihood of material based on visual features"""
    score = 0.0

    # Color match scoring
    color_score = check_color_match(hsv, profile)
    score += color_score * 0.4

    # Texture scoring (edge density)
    edge_min, edge_max = profile["edge_density"]
    edge_score = 1.0 if edge_min <= edge_density <= edge_max else max(0, 1.0 - abs(edge_density - (edge_min + edge_max) / 2) * 3)
    score += edge_score * 0.3

    # Variance scoring
    var_min, var_max = profile["texture_variance"]
    var_score = 1.0 if var_min <= texture_variance <= var_max else max(0, 1.0 - abs(texture_variance - (var_min + var_max) / 2) / 500)
    score += var_score * 0.2

    # Expectation bonus
    if is_expected:
        score *= 1.15

    return score


def check_color_match(hsv: np.ndarray, profile: dict) -> float:
    """Check if image colors match material profile"""
    h = hsv[:, :, 0]
    s = hsv[:, :, 1]
    v = hsv[:, :, 2]

    match_pixels = 0
    for hue_range in profile.get("primary_hsv", []):
        mask = cv2.inRange(hsv, np.array(hue_range[:3]), np.array([hue_range[0], 255, 255]))
        match_pixels += np.count_nonzero(mask)

    total_pixels = h.shape[0] * h.shape[1]
    return min(1.0, match_pixels / (total_pixels * 0.3))  # Expect ~30% color match


def analyze_condition(gray: np.ndarray, edge_density: float, texture_variance: float, material: str) -> str:
    """Determine material condition: new, good, fair, damaged"""
    # High variance + high edges = aged/damaged
    # Low variance + low edges = new/pristine

    damage_score = (edge_density * 0.5) + (min(texture_variance, 2000) / 2000 * 0.5)

    if damage_score < 0.25:
        return "new"
    elif damage_score < 0.45:
        return "good"
    elif damage_score < 0.70:
        return "fair"
    else:
        return "damaged"


def estimate_stock(image: np.ndarray, material: str) -> Optional[str]:
    """Estimate amount of material visible in image"""
    # Simple heuristic: count contours of material type
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    contours, _ = cv2.findContours(gray, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Large contours = material sections
    large_sections = sum(1 for c in contours if cv2.contourArea(c) > 1000)

    if large_sections >= 8:
        return "abundant"
    elif large_sections >= 4:
        return "moderate"
    else:
        return "low"


def generate_notes(material: str, condition: str, edge_density: float, texture_variance: float) -> list[str]:
    """Generate human-readable notes about material analysis"""
    notes = []

    if material == "drywall" and condition == "damaged":
        notes.append("Drywall shows signs of water damage or impact")

    if condition == "new":
        notes.append("Material appears to be freshly installed or high-quality")

    if edge_density > 0.25:
        notes.append("High surface irregularities detected")

    if texture_variance > 1500:
        notes.append("Rough/textured surface characteristics")

    return notes
