import test from "node:test";
import assert from "node:assert/strict";
import { distanceMeters, isValidCoordinate } from "../dist/integrations/geo-distance.js";

void test("isValidCoordinate accepts valid lat/lng", () => {
  assert.equal(isValidCoordinate(19.4326, -99.1332), true);
  assert.equal(isValidCoordinate(-90, -180), true);
  assert.equal(isValidCoordinate(90, 180), true);
  assert.equal(isValidCoordinate(0, 0), true);
});

void test("isValidCoordinate rejects out-of-range lat/lng", () => {
  assert.equal(isValidCoordinate(95, 0), false);
  assert.equal(isValidCoordinate(-95, 0), false);
  assert.equal(isValidCoordinate(0, 185), false);
  assert.equal(isValidCoordinate(0, -185), false);
});

void test("isValidCoordinate rejects NaN", () => {
  assert.equal(isValidCoordinate(Number.NaN, 0), false);
  assert.equal(isValidCoordinate(0, Number.NaN), false);
});

void test("distanceMeters returns 0 for identical points", () => {
  const point = { latitude: 19.4326, longitude: -99.1332 };
  assert.equal(distanceMeters(point, point), 0);
});

void test("distanceMeters computes a known real-world distance within tolerance", () => {
  // CDMX zócalo to CDMX airport (~9.4km great-circle)
  const zocalo = { latitude: 19.4326, longitude: -99.1332 };
  const airport = { latitude: 19.4363, longitude: -99.0721 };
  const meters = distanceMeters(zocalo, airport);
  assert.ok(meters > 5000 && meters < 10000, `expected ~6-9km, got ${meters}m`);
});

void test("distanceMeters is symmetric", () => {
  const a = { latitude: 40.7128, longitude: -74.006 };
  const b = { latitude: 34.0522, longitude: -118.2437 };
  assert.equal(Math.round(distanceMeters(a, b)), Math.round(distanceMeters(b, a)));
});
