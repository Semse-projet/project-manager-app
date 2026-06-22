import cv2
import numpy as np

def compare_before_after(before_image: np.ndarray, after_image: np.ndarray) -> float:
    """
    Compares a "before" image and an "after" image.
    Resizes both to 512x512, converts to grayscale, and computes
    the normalized mean absolute pixel difference.
    Returns a changeScore between 0.0 (no change) and 1.0 (complete change).
    """
    # Resize to standard size for comparison
    size = (512, 512)
    before_resized = cv2.resize(before_image, size, interpolation=cv2.INTER_AREA)
    after_resized = cv2.resize(after_image, size, interpolation=cv2.INTER_AREA)
    
    # Convert to grayscale
    before_gray = cv2.cvtColor(before_resized, cv2.COLOR_BGR2GRAY)
    after_gray = cv2.cvtColor(after_resized, cv2.COLOR_BGR2GRAY)
    
    # Apply light Gaussian blur to reduce alignment noise
    before_blur = cv2.GaussianBlur(before_gray, (5, 5), 0)
    after_blur = cv2.GaussianBlur(after_gray, (5, 5), 0)
    
    # Compute absolute difference
    diff = cv2.absdiff(before_blur, after_blur)
    
    # Mean difference (0 to 255)
    mean_diff = np.mean(diff)
    
    # Normalize to 0.0 - 1.0 range
    change_score = mean_diff / 255.0
    
    return float(change_score)
