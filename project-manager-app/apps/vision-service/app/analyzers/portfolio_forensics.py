"""
Portfolio Forensics Analyzer for Marketplace
Detects duplicate images, deepfakes, and portfolio quality issues
"""

import cv2
import numpy as np
from typing import TypedDict, Optional


class PortfolioAnalysis(TypedDict):
    fraud_risk: float  # 0-1, higher = more likely fraudulent
    duplicate_risk: float  # 0-1, likelihood of reused image
    deepfake_risk: float  # 0-1, likelihood of AI-generated
    portfolio_quality_score: float  # 0-1, portfolio quality
    red_flags: list[str]
    recommendation: str  # "approve", "review", "reject"


def analyze_portfolio_image(image_array: np.ndarray, image_hash: Optional[str] = None) -> PortfolioAnalysis:
    """
    Analyze portfolio image for fraud indicators, duplicates, and deepfakes

    Args:
        image_array: OpenCV image (BGR)
        image_hash: Optional perceptual hash for duplicate detection

    Returns:
        PortfolioAnalysis with fraud risk and recommendations
    """
    # Run multiple detection methods
    duplicate_score = detect_duplicate_indicators(image_array)
    deepfake_score = detect_deepfake_indicators(image_array)
    quality_score = assess_portfolio_quality(image_array)

    # Calculate composite fraud risk
    fraud_risk = (duplicate_score * 0.4 + deepfake_score * 0.6)
    
    # Generate red flags
    red_flags = generate_red_flags(duplicate_score, deepfake_score, quality_score)

    # Make recommendation
    recommendation = make_recommendation(fraud_risk, deepfake_score, quality_score)

    return PortfolioAnalysis(
        fraud_risk=min(1.0, fraud_risk),
        duplicate_risk=min(1.0, duplicate_score),
        deepfake_risk=min(1.0, deepfake_score),
        portfolio_quality_score=quality_score,
        red_flags=red_flags,
        recommendation=recommendation,
    )


def detect_duplicate_indicators(image_array: np.ndarray) -> float:
    """
    Detect if image is likely duplicate/stock photo
    Heuristics: over-edited, generic background, perfect lighting
    """
    gray = cv2.cvtColor(image_array, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image_array, cv2.COLOR_BGR2HSV)

    # Indicator 1: Too-perfect lighting (uniform brightness)
    brightness_variance = gray.var()
    if brightness_variance < 300:  # Very uniform = edited/generic
        lighting_score = 0.7
    elif brightness_variance > 5000:  # Natural variance
        lighting_score = 0.1
    else:
        lighting_score = max(0, (brightness_variance - 300) / 4700 * 0.5)

    # Indicator 2: Color saturation (stock photos often oversaturated)
    saturation = hsv[:, :, 1].mean()
    if saturation > 200:  # Very high = likely edited/stock
        saturation_score = 0.6
    elif saturation < 100:  # Low = desaturated/aged
        saturation_score = 0.1
    else:
        saturation_score = (saturation - 100) / 100 * 0.3

    # Indicator 3: Edge distribution (stock photos have symmetrical edges)
    edges = cv2.Canny(gray, 50, 150)
    edge_density = np.count_nonzero(edges) / (gray.shape[0] * gray.shape[1])
    
    if edge_density < 0.03:  # Very clean = edited/generic
        edge_score = 0.5
    elif edge_density > 0.25:  # Natural complexity
        edge_score = 0.1
    else:
        edge_score = (0.25 - edge_density) / 0.22 * 0.3

    # Combine indicators
    duplicate_score = (lighting_score * 0.4 + saturation_score * 0.3 + edge_score * 0.3)
    return min(1.0, duplicate_score)


def detect_deepfake_indicators(image_array: np.ndarray) -> float:
    """
    Detect AI-generated/deepfake images
    Heuristics: inconsistent textures, unnatural color transitions, artifacts
    """
    gray = cv2.cvtColor(image_array, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image_array, cv2.COLOR_BGR2HSV)

    # Indicator 1: Texture inconsistency
    # Divide image into quadrants and analyze texture variance
    h, w = gray.shape
    quadrants = [
        gray[:h//2, :w//2],
        gray[:h//2, w//2:],
        gray[h//2:, :w//2],
        gray[h//2:, w//2:],
    ]
    variances = [q.var() for q in quadrants]
    variance_consistency = np.std(variances) / np.mean(variances) if np.mean(variances) > 0 else 0
    
    if variance_consistency > 0.8:  # Very inconsistent = likely AI
        texture_score = 0.7
    elif variance_consistency < 0.3:  # Very consistent = uniform/natural
        texture_score = 0.1
    else:
        texture_score = variance_consistency * 0.5

    # Indicator 2: Color artifacts
    # AI images often have unnatural color transitions
    color_edges = detect_color_edges(hsv)
    if color_edges > 0.15:  # Excessive color edges = artifacts
        color_score = 0.5
    elif color_edges < 0.05:  # Smooth = natural
        color_score = 0.1
    else:
        color_score = (color_edges - 0.05) / 0.10 * 0.4

    # Indicator 3: Frequency domain analysis (AI images have specific patterns)
    freq_score = analyze_frequency_patterns(gray)

    # Combine indicators
    deepfake_score = (texture_score * 0.35 + color_score * 0.35 + freq_score * 0.3)
    return min(1.0, deepfake_score)


def detect_color_edges(hsv: np.ndarray) -> float:
    """Detect rapid color transitions (artifacts)"""
    h_channel = hsv[:, :, 0]
    
    # Calculate gradient
    gx = cv2.Sobel(h_channel, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(h_channel, cv2.CV_32F, 0, 1, ksize=3)
    gradient = np.sqrt(gx**2 + gy**2)
    
    # Count sharp transitions
    sharp_pixels = np.count_nonzero(gradient > 30)
    return sharp_pixels / (hsv.shape[0] * hsv.shape[1])


def analyze_frequency_patterns(gray: np.ndarray) -> float:
    """Analyze FFT patterns for AI generation artifacts"""
    # Compute FFT
    f_transform = np.fft.fft2(gray)
    f_shift = np.fft.fftshift(f_transform)
    magnitude = np.abs(f_shift)
    
    # AI images often have patterns in specific frequency bands
    # Natural images have more random distribution
    
    # Normalize
    magnitude_norm = magnitude / (magnitude.max() + 1e-8)
    
    # Check for periodic patterns
    center_region = magnitude_norm[magnitude_norm.shape[0]//4:3*magnitude_norm.shape[0]//4,
                                   magnitude_norm.shape[1]//4:3*magnitude_norm.shape[1]//4]
    
    if center_region.std() > center_region.mean() * 2:  # High variance = patterns
        return 0.6
    else:
        return 0.1  # Natural distribution


def assess_portfolio_quality(image_array: np.ndarray) -> float:
    """Assess overall portfolio image quality"""
    gray = cv2.cvtColor(image_array, cv2.COLOR_BGR2GRAY)
    
    # Sharpness: Laplacian variance
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    sharpness = laplacian.var()
    
    if sharpness < 100:  # Blurry
        sharpness_score = 0.2
    elif sharpness > 1000:  # Sharp
        sharpness_score = 1.0
    else:
        sharpness_score = (sharpness - 100) / 900

    # Contrast: std dev of pixel values
    contrast = gray.std()
    if contrast < 30:  # Low contrast
        contrast_score = 0.2
    elif contrast > 80:  # Good contrast
        contrast_score = 1.0
    else:
        contrast_score = (contrast - 30) / 50

    # Composition: rule of thirds check, good framing
    h, w = gray.shape
    composition_score = 0.7  # Default: assume decent composition
    
    # Check if important content is in center or thirds
    center_region = gray[h//4:3*h//4, w//4:3*w//4]
    if center_region.std() > gray.std() * 1.2:  # High variance in center
        composition_score = 0.9

    # Combine
    quality_score = (sharpness_score * 0.4 + contrast_score * 0.3 + composition_score * 0.3)
    return min(1.0, quality_score)


def generate_red_flags(duplicate_score: float, deepfake_score: float, quality_score: float) -> list[str]:
    """Generate human-readable red flags"""
    flags = []

    if duplicate_score > 0.6:
        flags.append("Image appears to be stock photo or heavily edited")
        flags.append("May be reused/duplicate in portfolio")

    if deepfake_score > 0.6:
        flags.append("Potential AI-generated content detected")
        flags.append("Requires manual verification of authenticity")

    if deepfake_score > 0.75:
        flags.append("High likelihood of synthetic/deepfake image")

    if quality_score < 0.4:
        flags.append("Low portfolio image quality (blurry/low contrast)")
        flags.append("Professional images should meet quality standards")

    return flags


def make_recommendation(fraud_risk: float, deepfake_score: float, quality_score: float) -> str:
    """Make recommendation on portfolio image"""
    if deepfake_score > 0.75:
        return "reject"
    
    if fraud_risk > 0.65 or quality_score < 0.3:
        return "review"
    
    if fraud_risk > 0.40 or quality_score < 0.50:
        return "review"
    
    return "approve"
