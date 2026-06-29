import cv2
import numpy as np
from typing import TypedDict, Optional

MATERIAL_PROFILES = {
    "drywall": {
        "primary_hsv": [(0, 0, 180), (30, 30, 255)],
        "edge_density_range": (0.02, 0.12),
        "texture_variance": (100, 800),
    },
    "wood": {
        "primary_hsv": [(10, 40, 80), (30, 200, 220)],
        "edge_density_range": (0.05, 0.25),
        "texture_variance": (500, 4000),
    },
    "brick": {
        "primary_hsv": [(0, 60, 80), (20, 200, 200)],
        "edge_density_range": (0.15, 0.45),
        "texture_variance": (1000, 6000),
    },
    "tile": {
        "primary_hsv": [(0, 0, 140), (180, 60, 255)],
        "edge_density_range": (0.10, 0.40),
        "texture_variance": (200, 2000),
    },
    "concrete": {
        "primary_hsv": [(0, 0, 80), (180, 30, 180)],
        "edge_density_range": (0.04, 0.20),
        "texture_variance": (300, 3000),
    },
    "metal": {
        "primary_hsv": [(0, 0, 150), (180, 20, 255)],
        "edge_density_range": (0.08, 0.35),
        "texture_variance": (50, 1500),
    },
}


class MaterialAnalysis(TypedDict):
    material: str
    condition: str
    stockLevel: str
    confidence: float
    allScores: dict
    notes: list


def compute_edge_density(gray: np.ndarray) -> float:
    edges = cv2.Canny(gray, 50, 150)
    return float(np.sum(edges > 0)) / edges.size


def compute_dominant_hue(hsv: np.ndarray) -> float:
    hues = hsv[:, :, 0].flatten()
    hist = np.bincount(hues, minlength=180)
    return float(np.argmax(hist))


def check_color_match(hsv: np.ndarray, lower: tuple, upper: tuple) -> float:
    mask = cv2.inRange(hsv, np.array(lower), np.array(upper))
    return float(np.sum(mask > 0)) / mask.size


def score_material(name: str, edge_density: float, variance: float, hsv: np.ndarray) -> float:
    profile = MATERIAL_PROFILES[name]
    lower, upper = profile["primary_hsv"]
    color_score = check_color_match(hsv, lower, upper)

    e_min, e_max = profile["edge_density_range"]
    edge_score = 1.0 - min(abs(edge_density - (e_min + e_max) / 2) / ((e_max - e_min) / 2 + 1e-9), 1.0)

    v_min, v_max = profile["texture_variance"]
    var_score = 1.0 if v_min <= variance <= v_max else max(0.0, 1.0 - min(
        abs(variance - v_min) / (v_min + 1e-9),
        abs(variance - v_max) / (v_max + 1e-9),
    ))

    return color_score * 0.40 + edge_score * 0.30 + var_score * 0.20


def analyze_condition(edge_density: float, variance: float) -> str:
    damage_score = edge_density * 0.5 + min(variance / 5000.0, 1.0) * 0.5
    if damage_score < 0.15:
        return "new"
    if damage_score < 0.30:
        return "good"
    if damage_score < 0.55:
        return "fair"
    return "damaged"


def estimate_stock(gray: np.ndarray) -> str:
    _, thresh = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    count = len(contours)
    if count > 40:
        return "abundant"
    if count > 15:
        return "moderate"
    return "low"


def generate_notes(material: str, condition: str, stock: str) -> list:
    notes = [f"Detected material: {material}", f"Condition: {condition}", f"Visible stock: {stock}"]
    if condition == "damaged":
        notes.append("Surface repair recommended before finishing work")
    if stock == "low":
        notes.append("Low visible stock — verify inventory before scheduling")
    return notes


def detect_material(image: np.ndarray, expected_material: Optional[str] = None) -> MaterialAnalysis:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    edge_density = compute_edge_density(gray)
    variance = float(gray.var())

    scores = {name: score_material(name, edge_density, variance, hsv) for name in MATERIAL_PROFILES}

    if expected_material and expected_material in scores:
        scores[expected_material] = min(scores[expected_material] * 1.15, 1.0)

    best = max(scores, key=lambda k: scores[k])
    confidence = scores[best]
    condition = analyze_condition(edge_density, variance)
    stock = estimate_stock(gray)

    return MaterialAnalysis(
        material=best,
        condition=condition,
        stockLevel=stock,
        confidence=round(confidence, 3),
        allScores={k: round(v, 3) for k, v in scores.items()},
        notes=generate_notes(best, condition, stock),
    )
