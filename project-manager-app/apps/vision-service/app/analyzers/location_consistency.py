import cv2
import numpy as np
from typing import List

def _color_palette(image: np.ndarray, bins: int = 32) -> np.ndarray:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1], None, [bins, bins], [0, 180, 0, 256])
    cv2.normalize(hist, hist)
    return hist.flatten()

def _palette_similarity(h1: np.ndarray, h2: np.ndarray) -> float:
    return float(cv2.compareHist(
        h1.reshape(-1, 1).astype(np.float32),
        h2.reshape(-1, 1).astype(np.float32),
        cv2.HISTCMP_CORREL
    ))

def _orb_overlap(img1_gray: np.ndarray, img2_gray: np.ndarray) -> float:
    orb = cv2.ORB_create(300)
    kp1, des1 = orb.detectAndCompute(img1_gray, None)
    kp2, des2 = orb.detectAndCompute(img2_gray, None)
    if des1 is None or des2 is None or len(kp1) < 2 or len(kp2) < 2:
        return 0.0
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = bf.match(des1, des2)
    good = [m for m in matches if m.distance < 64]
    return min(1.0, len(good) / max(min(len(kp1), len(kp2)), 1))

def check_location_consistency(images: List[np.ndarray]) -> dict:
    if len(images) < 2:
        return {
            "consistencyScore": 1.0,
            "outlierIndices": [],
            "allSameLocation": True,
            "pairwiseScores": [],
        }

    size = (320, 240)
    resized = [cv2.resize(img, size) for img in images]
    grays = [cv2.cvtColor(r, cv2.COLOR_BGR2GRAY) for r in resized]
    palettes = [_color_palette(r) for r in resized]

    n = len(images)
    pairwise: list[float] = []
    per_image_scores = [0.0] * n
    pair_count = [0] * n

    for i in range(n):
        for j in range(i + 1, n):
            palette_sim = max(0.0, _palette_similarity(palettes[i], palettes[j]))
            orb_sim = _orb_overlap(grays[i], grays[j])
            combined = palette_sim * 0.6 + orb_sim * 0.4
            pairwise.append(round(combined, 3))
            per_image_scores[i] += combined
            per_image_scores[j] += combined
            pair_count[i] += 1
            pair_count[j] += 1

    avg_scores = [per_image_scores[i] / max(pair_count[i], 1) for i in range(n)]
    overall_consistency = float(np.mean(pairwise)) if pairwise else 1.0

    # Outliers: images with avg similarity below 60% of overall
    threshold = overall_consistency * 0.60
    outlier_indices = [i for i, s in enumerate(avg_scores) if s < threshold and overall_consistency > 0.2]

    return {
        "consistencyScore": round(overall_consistency, 3),
        "outlierIndices": outlier_indices,
        "allSameLocation": overall_consistency >= 0.30 and len(outlier_indices) == 0,
        "pairwiseScores": pairwise,
    }
