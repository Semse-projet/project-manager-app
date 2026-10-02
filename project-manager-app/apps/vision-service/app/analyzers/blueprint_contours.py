import cv2
import numpy as np
from typing import List, Dict, Any

def extract_blueprint_lines(image: np.ndarray) -> Dict[str, Any]:
    """
    Finds structural lines in architectural blueprints using Hough Lines transform.
    Returns:
        - line_count: total lines detected
        - density: density score of features
        - lines: list of coordinates [x1, y1, x2, y2]
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Gaussian blur to reduce high frequency noise
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    
    # Canny edge detector
    edges = cv2.Canny(blurred, 50, 150, apertureSize=3)
    
    # Hough Lines Transform (Probabilistic)
    # rho=1, theta=pi/180, threshold=50, minLineLength=50, maxLineGap=10
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 50, minLineLength=50, maxLineGap=10)
    
    lines_list = []
    if lines is not None:
        for line in lines:
            # OpenCV 4 commonly returns (N, 1, 4), while OpenCV 5 may return
            # (N, 4). Flattening each entry keeps the analyzer compatible with
            # both shapes declared by our open-ended dependency range.
            coordinates = np.asarray(line).reshape(-1)
            if coordinates.size < 4:
                continue
            x1, y1, x2, y2 = coordinates[:4]
            lines_list.append([int(x1), int(y1), int(x2), int(y2)])
            
    # Calculate density score: percentage of white pixels in edge image
    total_pixels = edges.shape[0] * edges.shape[1]
    edge_pixels = np.sum(edges > 0)
    density = float(edge_pixels / total_pixels) if total_pixels > 0 else 0.0
    
    return {
        "line_count": len(lines_list),
        "density": density,
        "lines": lines_list[:100]  # Cap at 100 for payload optimization
    }
