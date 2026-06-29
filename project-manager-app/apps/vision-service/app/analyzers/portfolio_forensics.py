import cv2
import numpy as np
from typing import TypedDict, Optional


class PortfolioForensicsResult(TypedDict):
    duplicateScore: float
    deepfakeScore: float
    qualityScore: float
    fraudRisk: float
    recommendation: str
    redFlags: list
    details: dict


def detect_duplicate_indicators(gray: np.ndarray, hsv: np.ndarray) -> float:
    brightness_var = float(gray.var())
    lighting_score = 0.7 if brightness_var < 300 else 0.0

    sat_mean = float(hsv[:, :, 1].mean())
    saturation_score = 0.6 if sat_mean > 200 else 0.0

    edges = cv2.Canny(gray, 50, 150)
    edge_density = float(np.sum(edges > 0)) / edges.size
    edge_score = 0.5 if edge_density < 0.03 else 0.0

    return min(lighting_score * 0.40 + saturation_score * 0.30 + edge_score * 0.30, 1.0)


def detect_color_edges(hsv: np.ndarray) -> float:
    hue = hsv[:, :, 0].astype(np.float32)
    dx = cv2.Sobel(hue, cv2.CV_32F, 1, 0, ksize=3)
    dy = cv2.Sobel(hue, cv2.CV_32F, 0, 1, ksize=3)
    gradient_mag = np.sqrt(dx ** 2 + dy ** 2)
    rapid_transitions = float(np.sum(gradient_mag > 30)) / gradient_mag.size
    return min(rapid_transitions / 0.15, 1.0)


def analyze_frequency_patterns(gray: np.ndarray) -> float:
    f = np.fft.fft2(gray.astype(np.float32))
    fshift = np.fft.fftshift(f)
    magnitude = np.abs(fshift)
    h, w = gray.shape
    cy, cx = h // 2, w // 2
    quadrant = magnitude[cy - 10:cy + 10, cx - 10:cx + 10]
    center_energy = float(quadrant.mean()) if quadrant.size > 0 else 0.0
    total_energy = float(magnitude.mean()) + 1e-9
    ratio = center_energy / total_energy
    return min(max((ratio - 5.0) / 20.0, 0.0), 1.0)


def detect_deepfake_indicators(gray: np.ndarray, hsv: np.ndarray) -> float:
    h, w = gray.shape
    quadrants = [
        gray[: h // 2, : w // 2],
        gray[: h // 2, w // 2 :],
        gray[h // 2 :, : w // 2],
        gray[h // 2 :, w // 2 :],
    ]
    variances = [float(q.var()) for q in quadrants if q.size > 0]
    texture_score = min(float(np.std(variances)) / 0.8, 1.0) if variances else 0.0

    color_score = detect_color_edges(hsv)
    freq_score = analyze_frequency_patterns(gray)

    return min(texture_score * 0.35 + color_score * 0.35 + freq_score * 0.30, 1.0)


def assess_portfolio_quality(gray: np.ndarray) -> float:
    lap = cv2.Laplacian(gray, cv2.CV_64F)
    sharpness = float(lap.var())
    sharpness_score = min(sharpness / 1000.0, 1.0)

    contrast = float(gray.std())
    contrast_score = min(contrast / 80.0, 1.0)

    h, w = gray.shape
    center = gray[h // 4: 3 * h // 4, w // 4: 3 * w // 4]
    composition_score = min(float(center.var()) / 2000.0, 1.0)

    return sharpness_score * 0.40 + contrast_score * 0.30 + composition_score * 0.30


def generate_red_flags(duplicate: float, deepfake: float, quality: float) -> list:
    flags = []
    if duplicate > 0.6:
        flags.append("Possible stock or duplicate photo detected")
    if deepfake > 0.5:
        flags.append("AI-generated or manipulated image indicators found")
    if deepfake > 0.4:
        flags.append("Texture inconsistencies across image quadrants")
    if quality < 0.3:
        flags.append("Low image quality — blurry or low contrast")
    return flags


def make_recommendation(fraud_risk: float, quality: float) -> str:
    if fraud_risk > 0.75:
        return "reject"
    if fraud_risk > 0.40 or quality < 0.50:
        return "review"
    return "approve"


def analyze_portfolio(image: np.ndarray, image_hash: Optional[str] = None) -> PortfolioForensicsResult:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    duplicate_score = detect_duplicate_indicators(gray, hsv)
    deepfake_score = detect_deepfake_indicators(gray, hsv)
    quality_score = assess_portfolio_quality(gray)

    fraud_risk = duplicate_score * 0.40 + deepfake_score * 0.60
    recommendation = make_recommendation(fraud_risk, quality_score)
    red_flags = generate_red_flags(duplicate_score, deepfake_score, quality_score)

    return PortfolioForensicsResult(
        duplicateScore=round(duplicate_score, 3),
        deepfakeScore=round(deepfake_score, 3),
        qualityScore=round(quality_score, 3),
        fraudRisk=round(fraud_risk, 3),
        recommendation=recommendation,
        redFlags=red_flags,
        details={
            "imageHash": image_hash,
            "sharpnessVariance": round(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 1),
            "contrastStd": round(float(gray.std()), 1),
        },
    )
