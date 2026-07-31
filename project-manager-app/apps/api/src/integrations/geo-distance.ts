export function isValidCoordinate(latitude: number, longitude: number): boolean {
  if (Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
    return false;
  }
  if (Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
    return false;
  }
  return true;
}

export type GeoPoint = { latitude: number; longitude: number };

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Haversine great-circle distance between two points, in meters. */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}
