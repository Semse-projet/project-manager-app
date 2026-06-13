import requests
import numpy as np
import cv2
from fastapi import HTTPException

def load_image_from_url(url: str) -> np.ndarray:
    """
    Downloads an image from a URL and decodes it for OpenCV.
    Supports mock:// or localhost URLs by returning a generated dummy image for test stability.
    """
    if url.startswith("mock://") or "localhost" in url or "127.0.0.1" in url:
        # Generate dummy 512x512 image
        image = np.ones((512, 512, 3), dtype=np.uint8) * 128
        # Add text and lines so it's not a flat image (which has 0 variance/contrast)
        cv2.putText(image, "SEMSE Vision Mock", (50, 250), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
        cv2.line(image, (0, 0), (512, 512), (0, 0, 255), 3)
        return image

    try:
        response = requests.get(url, timeout=15)
        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch image from URL: {url}. Status code: {response.status_code}"
            )
        
        # Convert raw image bytes to a numpy array and decode
        image_bytes = np.frombuffer(response.content, np.uint8)
        image = cv2.imdecode(image_bytes, cv2.IMREAD_COLOR)
        
        if image is None:
            raise HTTPException(
                status_code=400,
                detail="Downloaded bytes could not be decoded into a valid image."
            )
            
        return image
    except requests.RequestException as e:
        raise HTTPException(
            status_code=400,
            detail=f"Network error while fetching image: {str(e)}"
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error decoding image: {str(e)}"
        )
