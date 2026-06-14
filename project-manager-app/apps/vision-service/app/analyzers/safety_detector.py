import cv2
import numpy as np
from typing import List

# HSV ranges for PPE colors
HELMET_RANGES = [
    ([20, 100, 100], [35, 255, 255]),   # yellow
    ([10, 150, 150], [20, 255, 255]),   # orange
    ([0, 0, 170],   [180, 25, 255]),    # white
    ([0, 150, 100], [10, 255, 255]),    # red
    ([170, 150, 100], [180, 255, 255]), # red (wrap)
]

VEST_RANGES = [
    ([10, 180, 180], [25, 255, 255]),   # hi-vis orange
    ([35, 180, 180], [80, 255, 255]),   # hi-vis yellow-green
]

def _color_region_present(hsv: np.ndarray, ranges: list, min_pixel_ratio: float = 0.005) -> bool:
    h, w = hsv.shape[:2]
    total = h * w
    for (lo, hi) in ranges:
        mask = cv2.inRange(hsv, np.array(lo, dtype=np.uint8), np.array(hi, dtype=np.uint8))
        if np.sum(mask > 0) / total >= min_pixel_ratio:
            return True
    return False

def _detect_helmet(hsv: np.ndarray) -> bool:
    # Helmets appear in upper 40% of frame with convex circular region
    h, w = hsv.shape[:2]
    upper = hsv[: int(h * 0.40), :]
    return _color_region_present(upper, HELMET_RANGES, min_pixel_ratio=0.008)

def _detect_vest(hsv: np.ndarray) -> bool:
    # Vests appear in middle 40-80% of frame (torso area)
    h, w = hsv.shape[:2]
    torso = hsv[int(h * 0.20): int(h * 0.80), :]
    return _color_region_present(torso, VEST_RANGES, min_pixel_ratio=0.015)

def _detect_harness(gray: np.ndarray) -> bool:
    # Harnesses produce diagonal straps — look for strong diagonal line pairs in torso area
    h, w = gray.shape[:2]
    torso = gray[int(h * 0.15): int(h * 0.75), :]
    blurred = cv2.GaussianBlur(torso, (3, 3), 0)
    edges = cv2.Canny(blurred, 30, 100)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=30, minLineLength=30, maxLineGap=10)
    if lines is None:
        return False
    diagonal_count = 0
    for line in lines:
        x1, y1, x2, y2 = line[0]
        if x2 == x1:
            continue
        angle = abs(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
        if 25 < angle < 65 or 115 < angle < 155:
            diagonal_count += 1
    return diagonal_count >= 3

def detect_safety_equipment(image: np.ndarray) -> dict:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    helmet = _detect_helmet(hsv)
    vest = _detect_vest(hsv)
    harness = _detect_harness(gray)

    ppe_count = sum([helmet, vest, harness])
    compliance_score = round(ppe_count / 3, 3)

    violations: List[str] = []
    if not helmet:
        violations.append("NO_HELMET_DETECTED")
    if not vest:
        violations.append("NO_SAFETY_VEST_DETECTED")

    return {
        "helmetDetected": helmet,
        "vestDetected": vest,
        "harnessDetected": harness,
        "complianceScore": compliance_score,
        "violations": violations,
    }
