"""
Space Classification Analyzer for Smart Intake
Classifies construction space type using OpenCV + heuristics
"""

import cv2
import numpy as np
from typing import TypedDict, Optional


class SpaceClassification(TypedDict):
    category: str  # interior_painting, exterior_painting, drywall_repair, etc
    confidence: float  # 0-1
    category_scores: dict  # all categories with scores
    key_features: list[str]  # features detected that led to classification
    skip_questions_allowed: bool  # can user skip questions for this category


# Visual feature profiles for each category
SPACE_PROFILES = {
    "interior_painting": {
        "color_palettes": ["neutral", "warm", "white"],  # Indoor wall colors
        "texture_flags": ["smooth", "drywall_like"],
        "edge_density_range": (0.02, 0.15),
        "lighting_type": "artificial",
        "enclosed": True,
    },
    "exterior_painting": {
        "color_palettes": ["weathered", "muted", "gray", "brown"],
        "texture_flags": ["rough", "weathered", "wood_grain"],
        "edge_density_range": (0.10, 0.40),
        "lighting_type": "natural",
        "enclosed": False,
    },
    "drywall_repair": {
        "color_palettes": ["neutral", "white", "gray"],
        "texture_flags": ["seams", "compound", "patches"],
        "edge_density_range": (0.05, 0.20),
        "surface_uniformity": False,  # Repairs create variation
        "enclosed": True,
    },
    "bathroom_remodel": {
        "fixtures": ["tile", "ceramic", "metal", "white"],
        "color_palettes": ["white", "light", "blue", "gray"],
        "edge_density_range": (0.12, 0.35),
        "high_reflectance": True,  # Tiles, fixtures reflect light
        "enclosed": True,
    },
    "kitchen_remodel": {
        "fixtures": ["tile", "stainless", "wood", "countertop"],
        "color_palettes": ["neutral", "warm", "wood"],
        "edge_density_range": (0.12, 0.38),
        "high_saturation": True,  # Cabinets, appliances
        "enclosed": True,
    },
    "cleaning": {
        "condition_indicator": "dirty",  # High texture variance, stains
        "edge_density_range": (0.15, 0.50),
        "texture_variance_high": True,
        "lighting_type": "any",
        "enclosed": False,  # Can be indoor or outdoor
    },
    "general_carpentry": {
        "materials": ["wood", "lumber", "frame"],
        "texture_flags": ["grain", "saw_marks", "joints"],
        "edge_density_range": (0.10, 0.35),
        "color_palettes": ["brown", "tan", "natural"],
        "enclosed": False,
    },
}


def classify_space(image_array: np.ndarray) -> SpaceClassification:
    """
    Classify construction space into Smart Intake categories

    Args:
        image_array: OpenCV image (BGR)

    Returns:
        SpaceClassification with detected category and confidence
    """
    # Convert to HSV and grayscale for analysis
    hsv = cv2.cvtColor(image_array, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(image_array, cv2.COLOR_BGR2GRAY)
    bgr = image_array

    # Extract visual features
    dominant_hue = compute_dominant_hue(hsv)
    edge_density = compute_edge_density(gray)
    texture_variance = gray.var()
    color_palette = classify_color_palette(hsv, dominant_hue)
    avg_saturation = hsv[:, :, 1].mean()
    avg_brightness = hsv[:, :, 2].mean()
    reflectance_score = estimate_reflectance(gray)

    # Score each category
    scores = {}
    for category, profile in SPACE_PROFILES.items():
        score = score_space(
            category,
            profile,
            edge_density,
            texture_variance,
            color_palette,
            dominant_hue,
            avg_saturation,
            avg_brightness,
            reflectance_score,
        )
        scores[category] = score

    # Select best match
    best_category = max(scores, key=scores.get)
    confidence = scores[best_category]

    # Extract key features
    features = extract_key_features(
        category=best_category,
        profile=SPACE_PROFILES[best_category],
        edge_density=edge_density,
        color_palette=color_palette,
        texture_variance=texture_variance,
    )

    # Determine if questions can be skipped (high confidence)
    skip_allowed = confidence >= 0.75

    return SpaceClassification(
        category=best_category,
        confidence=min(confidence, 1.0),
        category_scores=scores,
        key_features=features,
        skip_questions_allowed=skip_allowed,
    )


def compute_dominant_hue(hsv: np.ndarray) -> int:
    """Find dominant hue value in image"""
    h_channel = hsv[:, :, 0]
    hist = cv2.calcHist([h_channel], [0], None, [180], [0, 180])
    return int(np.argmax(hist))


def compute_edge_density(gray: np.ndarray) -> float:
    """Compute ratio of edge pixels to total pixels"""
    edges = cv2.Canny(gray, 50, 150)
    total_pixels = gray.shape[0] * gray.shape[1]
    edge_pixels = np.count_nonzero(edges)
    return edge_pixels / total_pixels


def classify_color_palette(hsv: np.ndarray, dominant_hue: int) -> str:
    """Classify dominant color palette"""
    # Hue interpretation (OpenCV: 0-180)
    # Red: 0-10, 170-180
    # Orange: 10-25
    # Yellow: 25-35
    # Green: 35-77
    # Cyan: 77-99
    # Blue: 99-130
    # Magenta: 130-170

    s_mean = hsv[:, :, 1].mean()
    v_mean = hsv[:, :, 2].mean()

    # Grayscale/neutral detection: low saturation
    if s_mean < 30:
        if v_mean > 200:
            return "white"
        elif v_mean < 50:
            return "black"
        else:
            return "neutral"

    # Colored detection by dominant hue
    if dominant_hue < 15 or dominant_hue > 170:
        return "red"
    elif 15 <= dominant_hue < 25:
        return "orange"
    elif 25 <= dominant_hue < 35:
        return "yellow"
    elif 35 <= dominant_hue < 77:
        return "green"
    elif 77 <= dominant_hue < 99:
        return "cyan"
    elif 99 <= dominant_hue < 130:
        return "blue"
    elif 130 <= dominant_hue < 170:
        return "magenta"
    else:
        return "neutral"


def estimate_reflectance(gray: np.ndarray) -> float:
    """Estimate how much light is reflected (0-1)"""
    # High brightness + low edge density = high reflectance (tiles, metal)
    brightness = gray.mean() / 255.0
    return brightness


def score_space(
    category: str,
    profile: dict,
    edge_density: float,
    texture_variance: float,
    color_palette: str,
    dominant_hue: int,
    avg_saturation: float,
    avg_brightness: float,
    reflectance_score: float,
) -> float:
    """Score likelihood of category based on visual features"""
    score = 0.0
    max_score = 0.0

    # Edge density scoring
    if "edge_density_range" in profile:
        edge_min, edge_max = profile["edge_density_range"]
        if edge_min <= edge_density <= edge_max:
            score += 0.25
        else:
            # Penalty for out of range
            score += max(0, 0.25 * (1.0 - abs(edge_density - (edge_min + edge_max) / 2) * 2))
        max_score += 0.25

    # Color palette scoring
    if "color_palettes" in profile:
        color_palettes = profile["color_palettes"]
        if color_palette in color_palettes:
            score += 0.25
        elif "neutral" in color_palettes and color_palette in ["neutral", "white", "gray"]:
            score += 0.20
        max_score += 0.25

    # Material/reflectance scoring (for bathroom, kitchen, cleaning)
    if category in ["bathroom_remodel", "kitchen_remodel"] and profile.get("high_reflectance"):
        if reflectance_score > 0.65:  # Bright, reflective (tiles, fixtures)
            score += 0.25
        else:
            score += reflectance_score * 0.25
        max_score += 0.25
    elif category in ["general_carpentry", "exterior_painting", "drywall_repair"]:
        # Lower reflectance for wood, weathered surfaces
        if 0.3 < reflectance_score < 0.7:
            score += 0.25
        max_score += 0.25
    else:
        # Default material scoring based on average saturation
        if category == "cleaning" and avg_saturation > 80:  # Dirty/stained
            score += 0.20
        max_score += 0.25

    # Texture variance scoring
    if category == "cleaning":
        # Dirty spaces have high texture variance
        if texture_variance > 1500:
            score += 0.25
        else:
            score += min(0.25, texture_variance / 1500 * 0.25)
    elif category == "drywall_repair":
        # Drywall repairs show moderate variance (seams, patches)
        if 400 < texture_variance < 1200:
            score += 0.25
        else:
            score += max(0, 0.25 * (1.0 - abs(texture_variance - 800) / 1000))
    elif category in ["interior_painting", "exterior_painting"]:
        # Painted surfaces have lower variance (smooth) or higher (weathered)
        if category == "interior_painting" and texture_variance < 500:
            score += 0.25
        elif category == "exterior_painting" and texture_variance > 800:
            score += 0.25
        else:
            score += 0.10  # Penalty but not total disqualification
    max_score += 0.25

    # Normalize to 0-1
    if max_score > 0:
        score = score / max_score
    else:
        score = 0.0

    return score


def extract_key_features(
    category: str,
    profile: dict,
    edge_density: float,
    color_palette: str,
    texture_variance: float,
) -> list[str]:
    """Extract human-readable features that led to classification"""
    features = []

    # Edge density observations
    if edge_density < 0.05:
        features.append("Smooth, uniform surface")
    elif edge_density > 0.30:
        features.append("High surface complexity/irregularities")

    # Material observations
    if category == "bathroom_remodel":
        features.append("Tile or ceramic visible")
        features.append("Reflective surfaces (fixtures)")
    elif category == "kitchen_remodel":
        features.append("Countertops/cabinetry visible")
        features.append("Mixed materials detected")
    elif category == "general_carpentry":
        features.append("Wood grain or lumber visible")
    elif category == "cleaning":
        features.append("Soiled or stained surfaces")
        features.append("High texture variance")
    elif category == "drywall_repair":
        features.append("Seams or compound visible")
        features.append("Repair patches visible")
    elif category == "exterior_painting":
        features.append("Weathered exterior surface")
        features.append("Natural lighting dominant")
    elif category == "interior_painting":
        features.append("Indoor wall surface")
        features.append("Relatively smooth finish")

    # Color observations
    if color_palette != "neutral":
        features.append(f"{color_palette.capitalize()} tones detected")

    return features


def generate_category_questions(category: str) -> dict:
    """Generate follow-up questions for confirmed category"""
    category_questions = {
        "interior_painting": {
            "skip_message": "We detected interior painting. Skip details and proceed?",
            "questions": [
                "Is this a residential or commercial space?",
                "Approximate square footage to paint?",
                "Current paint condition (fresh/worn/damaged)?",
            ],
        },
        "exterior_painting": {
            "skip_message": "Exterior painting project detected. Confirm and proceed?",
            "questions": [
                "Building material (wood/brick/metal)?",
                "Stories high / area size?",
                "Weather exposure level?",
            ],
        },
        "drywall_repair": {
            "skip_message": "Drywall repair work detected. Continue?",
            "questions": [
                "Repair scope (patching/full board/multiple)?",
                "Damage type (water/impact/cracks)?",
                "Area size estimate?",
            ],
        },
        "bathroom_remodel": {
            "skip_message": "Bathroom project confirmed. Proceed with remodel scope?",
            "questions": [
                "Full remodel or partial fixtures?",
                "Half-bath or full-bath?",
                "Current condition assessment?",
            ],
        },
        "kitchen_remodel": {
            "skip_message": "Kitchen project detected. Confirm scope and proceed?",
            "questions": [
                "Cabinets, counters, or full remodel?",
                "Approximate linear feet?",
                "Style/material preferences?",
            ],
        },
        "cleaning": {
            "skip_message": "Cleaning/restoration project. Confirm and detail scope?",
            "questions": [
                "Cleaning type (deep/post-construction/restoration)?",
                "Square footage to clean?",
                "Special requirements (biohazard/mold)?",
            ],
        },
        "general_carpentry": {
            "skip_message": "Carpentry work detected. Detail scope and proceed?",
            "questions": [
                "Carpentry type (framing/finish/repair)?",
                "Material preference (softwood/hardwood)?",
                "Scope size estimate?",
            ],
        },
    }
    return category_questions.get(category, {})
