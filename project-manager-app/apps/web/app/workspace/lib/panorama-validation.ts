export const MAX_LOCAL_PANORAMA_BYTES = 30 * 1024 * 1024;
export const MAX_LOCAL_TOUR_BYTES = 60 * 1024 * 1024;
export const MAX_LOCAL_TOUR_STATIONS = 6;
export const MAX_PANORAMA_PIXELS = 36_000_000;

const MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateLocalPanoramaFile(file: { type: string; size: number }): string | null {
  if (!MIMES.has(file.type)) return "Selecciona panoramas JPG, PNG o WebP.";
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_LOCAL_PANORAMA_BYTES) {
    return "Cada archivo debe medir entre 1 byte y 30 MB.";
  }
  return null;
}

export function isLikelyEquirectangular(width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return false;
  const ratio = width / height;
  return ratio >= 1.75 && ratio <= 2.25;
}

export function validatePanoramaDimensions(width: number, height: number): string | null {
  if (!isLikelyEquirectangular(width, height)) return "Esta imagen no parece un panorama 360° equirectangular 2:1.";
  if (width * height > MAX_PANORAMA_PIXELS) return "Resolución demasiado grande para esta vista previa (máximo 36 megapíxeles).";
  return null;
}

export function validateLocalTourBatch(existing: number[], incoming: number[]): string | null {
  if (incoming.length === 0) return "Selecciona al menos una imagen.";
  if (existing.length + incoming.length > MAX_LOCAL_TOUR_STATIONS) return "Máximo seis panoramas por recorrido.";
  const total = existing.concat(incoming).reduce((sum, size) => sum + size, 0);
  if (!Number.isSafeInteger(total) || total > MAX_LOCAL_TOUR_BYTES) return "Máximo 60 MB por recorrido.";
  return null;
}
