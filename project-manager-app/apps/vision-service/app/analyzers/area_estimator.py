import cv2
import numpy as np
from typing import Optional

# Standard door dimensions used as reference object (meters)
DOOR_WIDTH_M = 0.90
DOOR_HEIGHT_M = 2.10

def _find_dominant_rectangle(gray: np.ndarray):
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 50, 150)
    contours, _ = cv2.findContours(edged, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:10]
    for c in contours:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            return approx
    return None

def _aspect_ratio_area_estimate(image: np.ndarray) -> tuple[float, str]:
    h_img, w_img = image.shape[:2]
    pixel_area = h_img * w_img
    # Heuristic: typical construction photo at 1-2m distance covers ~4-8 m²
    # Use a conservative default scale factor
    m2_per_megapixel = 2.5
    megapixels = pixel_area / 1_000_000
    estimated = round(megapixels * m2_per_megapixel, 2)
    return estimated, "heuristic"

def estimate_area(image: np.ndarray) -> dict:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    h_img, w_img = image.shape[:2]
    rect = _find_dominant_rectangle(gray)
    method = "heuristic"
    estimated_m2 = 0.0
    confidence = 0.3
    reference_used = False

    if rect is not None:
        rect_pts = rect.reshape(4, 2)
        widths = [np.linalg.norm(rect_pts[i] - rect_pts[(i + 1) % 4]) for i in range(4)]
        rect_w_px = max(widths[0], widths[2])
        rect_h_px = max(widths[1], widths[3])
        rect_aspect = rect_w_px / (rect_h_px + 1e-9)
        door_aspect = DOOR_WIDTH_M / DOOR_HEIGHT_M  # ~0.43

        if abs(rect_aspect - door_aspect) < 0.15 and rect_w_px > w_img * 0.05:
            # Likely a door — use as calibration reference
            px_per_m_w = rect_w_px / DOOR_WIDTH_M
            px_per_m_h = rect_h_px / DOOR_HEIGHT_M
            px_per_m = (px_per_m_w + px_per_m_h) / 2
            area_px = w_img * h_img
            estimated_m2 = round(area_px / (px_per_m ** 2), 2)
            method = "door_reference"
            confidence = 0.70
            reference_used = True
        else:
            # Non-door quad found — use as relative scale
            rect_area_px = rect_w_px * rect_h_px
            total_px = w_img * h_img
            coverage = rect_area_px / total_px
            estimated_m2 = round(2.5 + coverage * 15, 2)
            method = "quad_relative"
            confidence = 0.45
    else:
        estimated_m2, method = _aspect_ratio_area_estimate(image)
        confidence = 0.25

    return {
        "estimatedAreaM2": estimated_m2,
        "confidence": round(confidence, 2),
        "referenceObjectUsed": reference_used,
        "method": method,
    }
