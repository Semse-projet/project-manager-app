from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import io
from typing import Dict, Any, Optional

def get_decimal_from_dms(dms, ref) -> Optional[float]:
    """
    Converts GPS degrees, minutes, seconds representation to decimal degrees.
    """
    if not dms or len(dms) < 3:
        return None
        
    try:
        # Handle float values in EXIF tuple
        degrees = float(dms[0])
        minutes = float(dms[1])
        seconds = float(dms[2])
        
        decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
        if ref in ['S', 'W']:
            decimal = -decimal
        return decimal
    except Exception:
        return None

def extract_exif(image_bytes: bytes) -> Dict[str, Any]:
    """
    Extracts metadata, camera details, timestamps, and GPS coordinates from image raw bytes.
    """
    metadata = {
        "timestamp": None,
        "cameraModel": None,
        "gps": None
    }
    
    try:
        image = Image.open(io.BytesIO(image_bytes))
        exif = image._getexif()
        if not exif:
            return metadata
            
        exif_data = {}
        for tag, value in exif.items():
            decoded = TAGS.get(tag, tag)
            exif_data[decoded] = value
            
        # Extract timestamp
        if "DateTimeOriginal" in exif_data:
            metadata["timestamp"] = str(exif_data["DateTimeOriginal"])
        elif "DateTime" in exif_data:
            metadata["timestamp"] = str(exif_data["DateTime"])
            
        # Extract camera model
        if "Model" in exif_data:
            metadata["cameraModel"] = str(exif_data["Model"])
            
        # Extract GPS coordinates
        if "GPSInfo" in exif_data:
            gps_info = {}
            for gps_tag in exif_data["GPSInfo"]:
                sub_decoded = GPSTAGS.get(gps_tag, gps_tag)
                gps_info[sub_decoded] = exif_data["GPSInfo"][gps_tag]
                
            latitude_dms = gps_info.get("GPSLatitude")
            latitude_ref = gps_info.get("GPSLatitudeRef")
            longitude_dms = gps_info.get("GPSLongitude")
            longitude_ref = gps_info.get("GPSLongitudeRef")
            
            lat = get_decimal_from_dms(latitude_dms, latitude_ref)
            lng = get_decimal_from_dms(longitude_dms, longitude_ref)
            
            if lat is not None and lng is not None:
                metadata["gps"] = {
                    "latitude": lat,
                    "longitude": lng
                }
    except Exception:
        # Silence errors and return empty metadata
        pass
        
    return metadata
