import * as Location from "expo-location";
import { PROXIMITY_LOCATION_TASK } from "./backgroundLocationTask";

export type PermissionResult = { granted: true } | { granted: false; reason: "foreground" | "background" };

/**
 * Android requires foreground permission to be granted before background can even be
 * requested; iOS shows one combined "Always Allow" prompt but the two-step request
 * still works there. Never request background before foreground.
 */
export async function requestProximityPermissions(): Promise<PermissionResult> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    return { granted: false, reason: "foreground" };
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") {
    return { granted: false, reason: "background" };
  }

  return { granted: true };
}

export async function startProximityTracking(): Promise<void> {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(PROXIMITY_LOCATION_TASK).catch(() => false);
  if (alreadyStarted) return;

  await Location.startLocationUpdatesAsync(PROXIMITY_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 75,
    deferredUpdatesInterval: 60_000,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: "SEMSE está observando tu ubicación",
      notificationBody: "Para avisarte cuando llegues a un job o proyecto libre.",
    },
  });
}

export async function stopProximityTracking(): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(PROXIMITY_LOCATION_TASK).catch(() => false);
  if (started) {
    await Location.stopLocationUpdatesAsync(PROXIMITY_LOCATION_TASK);
  }
}

export async function isProximityTrackingActive(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(PROXIMITY_LOCATION_TASK).catch(() => false);
}
