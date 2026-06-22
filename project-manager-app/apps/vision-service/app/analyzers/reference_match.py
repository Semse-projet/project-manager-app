import cv2
import numpy as np
from typing import Tuple

def _orb_match_score(img1_gray: np.ndarray, img2_gray: np.ndarray) -> Tuple[float, int]:
    orb = cv2.ORB_create(500)
    kp1, des1 = orb.detectAndCompute(img1_gray, None)
    kp2, des2 = orb.detectAndCompute(img2_gray, None)
    if des1 is None or des2 is None or len(kp1) < 2 or len(kp2) < 2:
        return 0.0, 0
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = bf.match(des1, des2)
    if not matches:
        return 0.0, 0
    matches = sorted(matches, key=lambda m: m.distance)
    good = [m for m in matches if m.distance < 64]
    score = min(1.0, len(good) / max(min(len(kp1), len(kp2)), 1))
    return float(score), len(good)

def _histogram_correlation(img1: np.ndarray, img2: np.ndarray) -> float:
    size = (256, 256)
    i1 = cv2.resize(img1, size)
    i2 = cv2.resize(img2, size)
    scores = []
    for ch in range(3):
        h1 = cv2.calcHist([i1], [ch], None, [64], [0, 256])
        h2 = cv2.calcHist([i2], [ch], None, [64], [0, 256])
        cv2.normalize(h1, h1)
        cv2.normalize(h2, h2)
        corr = cv2.compareHist(h1, h2, cv2.HISTCMP_CORREL)
        scores.append(max(0.0, float(corr)))
    return float(np.mean(scores))

def _ssim_score(img1_gray: np.ndarray, img2_gray: np.ndarray) -> float:
    size = (256, 256)
    g1 = cv2.resize(img1_gray, size).astype(np.float64)
    g2 = cv2.resize(img2_gray, size).astype(np.float64)
    C1 = (0.01 * 255) ** 2
    C2 = (0.03 * 255) ** 2
    mu1 = cv2.GaussianBlur(g1, (11, 11), 1.5)
    mu2 = cv2.GaussianBlur(g2, (11, 11), 1.5)
    mu1_sq = mu1 * mu1
    mu2_sq = mu2 * mu2
    mu1_mu2 = mu1 * mu2
    sigma1_sq = cv2.GaussianBlur(g1 * g1, (11, 11), 1.5) - mu1_sq
    sigma2_sq = cv2.GaussianBlur(g2 * g2, (11, 11), 1.5) - mu2_sq
    sigma12 = cv2.GaussianBlur(g1 * g2, (11, 11), 1.5) - mu1_mu2
    num = (2 * mu1_mu2 + C1) * (2 * sigma12 + C2)
    den = (mu1_sq + mu2_sq + C1) * (sigma1_sq + sigma2_sq + C2)
    ssim_map = num / (den + 1e-10)
    return float(np.mean(ssim_map))

def match_reference(delivered: np.ndarray, reference: np.ndarray) -> dict:
    delivered_gray = cv2.cvtColor(delivered, cv2.COLOR_BGR2GRAY)
    reference_gray = cv2.cvtColor(reference, cv2.COLOR_BGR2GRAY)

    orb_score, orb_match_count = _orb_match_score(delivered_gray, reference_gray)
    hist_score = _histogram_correlation(delivered, reference)
    ssim = _ssim_score(delivered_gray, reference_gray)

    # Weighted combined score: ORB captures structural similarity,
    # histogram captures color/style match, SSIM captures pixel-level similarity
    similarity_score = round(orb_score * 0.4 + hist_score * 0.3 + max(0.0, ssim) * 0.3, 3)
    meets_standard = similarity_score >= 0.40

    return {
        "similarityScore": similarity_score,
        "orbMatchCount": orb_match_count,
        "orbScore": round(orb_score, 3),
        "ssimScore": round(max(0.0, ssim), 3),
        "histogramScore": round(hist_score, 3),
        "meetsStandard": meets_standard,
    }
