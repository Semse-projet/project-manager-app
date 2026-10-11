export const MAX_LOCAL_PANORAMA_BYTES = 30 * 1024 * 1024;

const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Local-only preview: does not establish evidence authenticity or upload a photo. */
export function validateLocalPanoramaFile(file: { type: string; size: number }): string | null {
  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    return "Usa un panorama JPG, PNG o WebP. Otros formatos no son compatibles con esta vista previa.";
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_LOCAL_PANORAMA_BYTES) {
    return "El archivo debe tener un tamaño mayor que cero y de hasta 30 MB.";
  }
  return null;
}

/** Equirectangular 360° images are normally close to twice as wide as tall. */
export function isLikelyEquirectangular(width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return false;
  }
  const ratio = width / height;
  return ratio >= 1.75 && ratio <= 2.25;
}
