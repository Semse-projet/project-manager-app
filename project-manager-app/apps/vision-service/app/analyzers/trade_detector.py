import cv2
import numpy as np
from typing import Optional

TRADE_PROFILES = {
    "electrical": {
        "edge_density_min": 0.06,
        "hsv_ranges": [
            ([100, 80, 80], [130, 255, 255]),   # blue (conduit)
            ([10, 100, 100], [25, 255, 255]),    # orange (wire)
            ([35, 60, 60], [85, 255, 255]),      # green (ground)
        ],
        "circular_contours_min": 0,
    },
    "painting": {
        "edge_density_max": 0.04,
        "color_uniformity_min": 0.65,
        "hsv_ranges": [],
    },
    "plumbing": {
        "circular_contours_min": 1,
        "hsv_ranges": [
            ([0, 0, 160], [180, 30, 255]),       # white (PVC)
            ([15, 60, 100], [25, 200, 200]),      # copper tone
            ([0, 0, 100], [180, 30, 180]),        # gray (galvanized)
        ],
    },
    "drywall": {
        "edge_density_max": 0.05,
        "texture_variance_max": 900,
        "gray_dominant": True,
    },
    "concrete": {
        "texture_variance_min": 800,
        "gray_dominant": True,
        "edge_density_min": 0.03,
    },
    "roofing": {
        "texture_variance_min": 600,
        "edge_density_min": 0.04,
        "dark_dominant": True,
    },
    "flooring": {
        "edge_density_min": 0.02,
        "line_regularity": True,
    },
    "carpentry": {
        "texture_variance_min": 400,
        "brown_dominant": True,
    },
}

def _edge_density(gray: np.ndarray) -> float:
    edges = cv2.Canny(gray, 50, 150)
    total = edges.shape[0] * edges.shape[1]
    return float(np.sum(edges > 0) / total) if total > 0 else 0.0

def _color_uniformity(hsv: np.ndarray) -> float:
    h_channel = hsv[:, :, 0].flatten()
    hist, _ = np.histogram(h_channel, bins=18, range=(0, 180))
    hist = hist / (hist.sum() + 1e-9)
    dominant = float(hist.max())
    return dominant

def _texture_variance(gray: np.ndarray) -> float:
    return float(np.var(gray))

def _count_circular_contours(gray: np.ndarray) -> int:
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    circles = cv2.HoughCircles(
        blurred, cv2.HOUGH_GRADIENT, dp=1.2, minDist=30,
        param1=50, param2=30, minRadius=5, maxRadius=80
    )
    return len(circles[0]) if circles is not None else 0

def _dominant_hue(hsv: np.ndarray) -> str:
    h = hsv[:, :, 0]
    s = hsv[:, :, 1]
    v = hsv[:, :, 2]
    gray_mask = s < 40
    gray_ratio = float(np.sum(gray_mask) / gray_mask.size)
    dark_ratio = float(np.sum(v < 60) / v.size)
    brown_mask = (h >= 5) & (h <= 20) & (s >= 60)
    brown_ratio = float(np.sum(brown_mask) / brown_mask.size)
    if gray_ratio > 0.5:
        return "gray"
    if dark_ratio > 0.4:
        return "dark"
    if brown_ratio > 0.15:
        return "brown"
    return "mixed"

def _hsv_color_score(hsv: np.ndarray, ranges: list) -> float:
    if not ranges:
        return 0.0
    total_pixels = hsv.shape[0] * hsv.shape[1]
    matched = 0
    for (lo, hi) in ranges:
        mask = cv2.inRange(hsv, np.array(lo, dtype=np.uint8), np.array(hi, dtype=np.uint8))
        matched += int(np.sum(mask > 0))
    return min(1.0, float(matched) / (total_pixels * len(ranges) * 0.5 + 1))

def _score_trade(features: dict, trade: str) -> float:
    profile = TRADE_PROFILES.get(trade)
    if not profile:
        return 0.0

    scores = []

    if "edge_density_min" in profile:
        ed = features["edge_density"]
        scores.append(min(1.0, ed / profile["edge_density_min"]) if ed >= profile["edge_density_min"] * 0.5 else 0.3)

    if "edge_density_max" in profile:
        ed = features["edge_density"]
        scores.append(1.0 if ed <= profile["edge_density_max"] else max(0.0, 1.0 - (ed - profile["edge_density_max"]) * 10))

    if "color_uniformity_min" in profile:
        cu = features["color_uniformity"]
        scores.append(min(1.0, cu / profile["color_uniformity_min"]))

    if "texture_variance_min" in profile:
        tv = features["texture_variance"]
        scores.append(min(1.0, tv / profile["texture_variance_min"]))

    if "texture_variance_max" in profile:
        tv = features["texture_variance"]
        scores.append(1.0 if tv <= profile["texture_variance_max"] else max(0.0, 1.0 - (tv - profile["texture_variance_max"]) / profile["texture_variance_max"]))

    if "circular_contours_min" in profile:
        cc = features["circular_contours"]
        needed = profile["circular_contours_min"]
        scores.append(1.0 if cc >= needed else (0.5 if cc > 0 else 0.2))

    if "hsv_ranges" in profile and profile["hsv_ranges"]:
        scores.append(features["hsv_color_score_" + trade])

    if profile.get("gray_dominant"):
        scores.append(1.0 if features["dominant_hue"] == "gray" else 0.3)

    if profile.get("dark_dominant"):
        scores.append(1.0 if features["dominant_hue"] == "dark" else 0.3)

    if profile.get("brown_dominant"):
        scores.append(1.0 if features["dominant_hue"] == "brown" else 0.3)

    return float(np.mean(scores)) if scores else 0.0

def detect_trade(image: np.ndarray, expected_trade: Optional[str] = None) -> dict:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    features = {
        "edge_density": _edge_density(gray),
        "color_uniformity": _color_uniformity(hsv),
        "texture_variance": _texture_variance(gray),
        "circular_contours": _count_circular_contours(gray),
        "dominant_hue": _dominant_hue(hsv),
    }
    for trade, profile in TRADE_PROFILES.items():
        if profile.get("hsv_ranges"):
            features[f"hsv_color_score_{trade}"] = _hsv_color_score(hsv, profile["hsv_ranges"])

    trade_scores = {t: _score_trade(features, t) for t in TRADE_PROFILES}
    detected = max(trade_scores, key=lambda t: trade_scores[t])
    confidence = round(trade_scores[detected], 3)

    result = {
        "detectedTrade": detected,
        "confidence": confidence,
        "tradeScores": {t: round(s, 3) for t, s in trade_scores.items()},
    }

    if expected_trade:
        result["expectedTrade"] = expected_trade
        result["match"] = detected == expected_trade or trade_scores.get(expected_trade, 0) >= 0.55

    return result
