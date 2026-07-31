import { distanceMeters, isValidCoordinate } from "./distance";

describe("isValidCoordinate", () => {
  it("accepts valid lat/lng", () => {
    expect(isValidCoordinate(19.4326, -99.1332)).toBe(true);
    expect(isValidCoordinate(-90, -180)).toBe(true);
    expect(isValidCoordinate(90, 180)).toBe(true);
    expect(isValidCoordinate(0, 0)).toBe(true);
  });

  it("rejects out-of-range lat/lng", () => {
    expect(isValidCoordinate(95, 0)).toBe(false);
    expect(isValidCoordinate(-95, 0)).toBe(false);
    expect(isValidCoordinate(0, 185)).toBe(false);
    expect(isValidCoordinate(0, -185)).toBe(false);
  });

  it("rejects NaN", () => {
    expect(isValidCoordinate(Number.NaN, 0)).toBe(false);
    expect(isValidCoordinate(0, Number.NaN)).toBe(false);
  });
});

describe("distanceMeters", () => {
  it("returns 0 for identical points", () => {
    const point = { latitude: 19.4326, longitude: -99.1332 };
    expect(distanceMeters(point, point)).toBe(0);
  });

  it("computes a known real-world distance within tolerance", () => {
    // CDMX zócalo to CDMX airport (~6-9km great-circle)
    const zocalo = { latitude: 19.4326, longitude: -99.1332 };
    const airport = { latitude: 19.4363, longitude: -99.0721 };
    const meters = distanceMeters(zocalo, airport);
    expect(meters).toBeGreaterThan(5000);
    expect(meters).toBeLessThan(10000);
  });

  it("is symmetric", () => {
    const a = { latitude: 40.7128, longitude: -74.006 };
    const b = { latitude: 34.0522, longitude: -118.2437 };
    expect(Math.round(distanceMeters(a, b))).toBe(Math.round(distanceMeters(b, a)));
  });
});
