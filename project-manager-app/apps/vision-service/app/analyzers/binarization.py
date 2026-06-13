import cv2
import numpy as np

def binarize_document(image: np.ndarray) -> np.ndarray:
    """
    Applies Otsu's adaptive thresholding and morphological cleanup
    to convert a grayscale or color document to high-contrast black and white.
    Useful for cleaning shadow noise before OCR.
    """
    # Convert to gray if color
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()
        
    # Apply adaptive thresholding (Gaussian)
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )
    
    # Morphological opening to remove small black speckles
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    cleaned = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
    
    return cleaned
