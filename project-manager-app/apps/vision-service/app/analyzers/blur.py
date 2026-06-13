import cv2
import numpy as np

def detect_blur(image: np.ndarray) -> float:
    """
    Computes the Laplacian variance of the image.
    Lower values indicate more blurriness.
    A threshold of < 100 is typically considered blurry.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    return float(variance)
