// Unlike TimerScreen.test.tsx (which fully replaces this module with jest.mock),
// these tests exercise the REAL backgroundLocation.ts — so the permission-order
// guard, idempotency checks and the exact startLocationUpdatesAsync options
// are actually under test. `jest.spyOn(Location, "x")` doesn't work here
// (expo-location's transpiled exports are non-configurable, so Jest can't
// redefine them for a spy) — mocking the module with a factory that spreads
// jest.requireActual and overrides only the functions we drive per-test
// sidesteps that, while `Location.Accuracy` etc. stay the real values.
jest.mock("expo-location", () => ({
  ...jest.requireActual("expo-location"),
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
}));

import * as Location from "expo-location";
import {
  requestProximityPermissions,
  startProximityTracking,
  stopProximityTracking,
  isProximityTrackingActive,
} from "./backgroundLocation";
import { PROXIMITY_LOCATION_TASK } from "./backgroundLocationTask";

const requestForeground = Location.requestForegroundPermissionsAsync as jest.Mock;
const requestBackground = Location.requestBackgroundPermissionsAsync as jest.Mock;
const hasStarted = Location.hasStartedLocationUpdatesAsync as jest.Mock;
const startUpdates = Location.startLocationUpdatesAsync as jest.Mock;
const stopUpdates = Location.stopLocationUpdatesAsync as jest.Mock;

beforeEach(() => {
  requestForeground.mockReset();
  requestBackground.mockReset();
  hasStarted.mockReset();
  startUpdates.mockReset().mockResolvedValue(undefined);
  stopUpdates.mockReset().mockResolvedValue(undefined);
});

describe("requestProximityPermissions", () => {
  it("requests foreground before background, and reports granted when both succeed", async () => {
    requestForeground.mockResolvedValue({ status: "granted" });
    requestBackground.mockResolvedValue({ status: "granted" });

    const result = await requestProximityPermissions();

    expect(result).toEqual({ granted: true });
    expect(requestForeground).toHaveBeenCalledTimes(1);
    expect(requestBackground).toHaveBeenCalledTimes(1);
    expect(requestForeground.mock.invocationCallOrder[0]).toBeLessThan(requestBackground.mock.invocationCallOrder[0]);
  });

  it("never requests background permission when foreground is denied", async () => {
    requestForeground.mockResolvedValue({ status: "denied" });
    requestBackground.mockResolvedValue({ status: "granted" });

    const result = await requestProximityPermissions();

    expect(result).toEqual({ granted: false, reason: "foreground" });
    expect(requestBackground).not.toHaveBeenCalled();
  });

  it("reports reason:background when foreground succeeds but background is denied", async () => {
    requestForeground.mockResolvedValue({ status: "granted" });
    requestBackground.mockResolvedValue({ status: "denied" });

    const result = await requestProximityPermissions();

    expect(result).toEqual({ granted: false, reason: "background" });
  });
});

describe("startProximityTracking", () => {
  it("starts location updates under PROXIMITY_LOCATION_TASK with the expected options", async () => {
    hasStarted.mockResolvedValue(false);

    await startProximityTracking();

    expect(startUpdates).toHaveBeenCalledTimes(1);
    const [taskName, options] = startUpdates.mock.calls[0] as [string, Record<string, unknown>];
    expect(taskName).toBe(PROXIMITY_LOCATION_TASK);
    expect(options).toMatchObject({
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 75,
      deferredUpdatesInterval: 60_000,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
    });
    expect(options.foregroundService).toMatchObject({
      notificationTitle: expect.any(String),
      notificationBody: expect.any(String),
    });
  });

  it("is idempotent — does not start tracking again if already started", async () => {
    hasStarted.mockResolvedValue(true);

    await startProximityTracking();

    expect(startUpdates).not.toHaveBeenCalled();
  });

  it("treats a hasStartedLocationUpdatesAsync rejection as not-started and starts tracking anyway", async () => {
    hasStarted.mockRejectedValue(new Error("native error"));

    await startProximityTracking();

    expect(startUpdates).toHaveBeenCalledTimes(1);
  });
});

describe("stopProximityTracking", () => {
  it("stops tracking when active", async () => {
    hasStarted.mockResolvedValue(true);

    await stopProximityTracking();

    expect(stopUpdates).toHaveBeenCalledWith(PROXIMITY_LOCATION_TASK);
  });

  it("does nothing when not active", async () => {
    hasStarted.mockResolvedValue(false);

    await stopProximityTracking();

    expect(stopUpdates).not.toHaveBeenCalled();
  });
});

describe("isProximityTrackingActive", () => {
  it("reflects hasStartedLocationUpdatesAsync", async () => {
    hasStarted.mockResolvedValue(true);
    await expect(isProximityTrackingActive()).resolves.toBe(true);
  });

  it("treats a rejection as false", async () => {
    hasStarted.mockRejectedValue(new Error("boom"));
    await expect(isProximityTrackingActive()).resolves.toBe(false);
  });
});
