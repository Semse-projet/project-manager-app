import cv2
import numpy as np
from typing import List, Tuple, Optional

def calculate_dhash(image: np.ndarray) -> str:
    """
    Computes the 64-bit Difference Hash (dHash) of an image.
    Resizes to 9x8, converts to grayscale, and compares adjacent pixels.
    Returns the hash as a 16-character hexadecimal string.
    """
    # Resize to 9x8, convert to gray
    resized = cv2.resize(image, (9, 8), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    
    # Compare adjacent pixels in each row
    difference = gray[:, 1:] > gray[:, :-1]
    
    # Convert binary array to hex string
    decimal_val = 0
    hex_str = []
    for index, value in enumerate(difference.flatten()):
        if value:
            decimal_val += 2 ** (index % 8)
        if index % 8 == 7:
            hex_str.append(f"{decimal_val:02x}")
            decimal_val = 0
            
    return "".join(hex_str)

def hamming_distance(hash1: str, hash2: str) -> int:
    """
    Calculates the Hamming distance between two hex string hashes.
    A distance of 0 means identical. A distance <= 10 indicates high similarity.
    """
    try:
        # Convert hex strings back to integers
        val1 = int(hash1, 16)
        val2 = int(hash2, 16)
        # XOR to find differing bits, then count them
        return bin(val1 ^ val2).count('1')
    except ValueError:
        # Return max distance if invalid hashes are compared
        return 64

def check_duplicate(image_hash: str, existing_hashes: List[str], threshold: int = 10) -> Tuple[float, Optional[int]]:
    """
    Checks if a hash matches any existing hashes within the given threshold.
    Returns:
        - duplicate_risk: float (0.0 to 1.0)
        - matched_index: int (or None if no match)
    """
    if not existing_hashes:
        return 0.0, None
        
    min_distance = 64
    matched_idx = None
    
    for idx, ext_hash in enumerate(existing_hashes):
        dist = hamming_distance(image_hash, ext_hash)
        if dist < min_distance:
            min_distance = dist
            matched_idx = idx
            
    # Calculate risk: 0 distance = 1.0 risk, distance >= 20 = 0.0 risk
    if min_distance <= threshold:
        # Scale risk: distance 0 -> 1.0, distance threshold -> 0.7
        risk = 1.0 - (min_distance / threshold) * 0.3
    else:
        # Low risk
        risk = max(0.0, 0.7 - ((min_distance - threshold) / (64 - threshold)) * 0.7)
        matched_idx = None  # Clear index if below threshold
        
    return float(risk), matched_idx
