import cv2
import numpy as np

def analyze_lighting(image: np.ndarray) -> float:
    """
    Analyzes the brightness of the image.
    Converts image to grayscale and calculates the mean pixel value.
    Values closer to 0 are very dark/under-exposed.
    Values closer to 255 are very bright/over-exposed.
    Normal range is typically 40 to 220.
    Returns the mean brightness as a float (0 to 255).
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    mean_brightness = np.mean(gray)
    return float(mean_brightness)
