def evaluate_quality(blur: float, lighting: float, contrast: float) -> tuple[float, bool]:
    """
    Evaluates image metrics and returns a quality score (0.0 to 1.0)
    and a boolean indicating if the image is usable.
    """
    # 1. Blur evaluation: Laplacian variance.
    # Below 100 is blurry. Above 500 is very sharp.
    # Normalize variance to a score from 0.0 to 1.0.
    if blur < 50:
        blur_score = 0.1
    elif blur < 100:
        blur_score = 0.4
    elif blur < 250:
        blur_score = 0.8
    else:
        blur_score = 1.0
        
    # 2. Lighting evaluation: Mean brightness (0 to 255).
    # Ideal range is 60 to 200. Very dark (< 40) or very bright (> 230) is penalized.
    if lighting < 30 or lighting > 240:
        lighting_score = 0.2
    elif lighting < 60 or lighting > 210:
        lighting_score = 0.6
    else:
        lighting_score = 1.0
        
    # 3. Contrast evaluation: Standard deviation (0 to 128).
    # Ideal is > 30. Low contrast (< 15) is penalized.
    if contrast < 10:
        contrast_score = 0.2
    elif contrast < 20:
        contrast_score = 0.6
    else:
        contrast_score = 1.0
        
    # Weighted quality score
    quality_score = (blur_score * 0.5) + (lighting_score * 0.3) + (contrast_score * 0.2)
    
    # Determine usability
    # Usable if blur is not critical AND lighting/contrast is acceptable
    usable = blur >= 80.0 and lighting >= 40.0 and lighting <= 230.0 and contrast >= 15.0
    
    return float(quality_score), bool(usable)
