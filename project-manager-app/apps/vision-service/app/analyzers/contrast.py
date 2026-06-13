import cv2
import numpy as np

def analyze_contrast(image: np.ndarray) -> float:
    """
    Analyzes the contrast of the image.
    Calculates the standard deviation of the grayscale pixel intensities.
    Lower standard deviation indicates low contrast (e.g. flat colors, low detail).
    Typically, std dev < 20 indicates low contrast.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    std_dev = np.std(gray)
    return float(std_dev)
