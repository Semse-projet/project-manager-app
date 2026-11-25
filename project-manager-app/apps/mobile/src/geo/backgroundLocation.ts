import AsyncStorage from "@react-native-async-storage/async-storage";
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

/**
 * Version of the options below. The OS keeps a registered task (and its options) across app
 * updates, so a task started by an older build would keep its old distanceInterval (75 m).
 * When the stored version differs, the task is restarted once with the current options.
 */
export const TRACKING_OPTIONS_VERSION = 2; // 2: distanceInterval 40 m (OPEN-18 AC-14)
const TRACKING_OPTIONS_VERSION_KEY = "semse.proximity.trackingOptionsVersion";

export async function startProximityTracking(): Promise<void> {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(PROXIMITY_LOCATION_TASK).catch(() => false);
  if (alreadyStarted) {
    const stored = await AsyncStorage.getItem(TRACKING_OPTIONS_VERSION_KEY).catch(() => null);
    if (stored === String(TRACKING_OPTIONS_VERSION)) return;
    await Location.stopLocationUpdatesAsync(PROXIMITY_LOCATION_TASK);
  }

  await Location.startLocationUpdatesAsync(PROXIMITY_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 40,
    deferredUpdatesInterval: 60_000,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: "SEMSE está observando tu ubicación",
      notificationBody: "Para avisarte cuando llegues a un job o proyecto libre.",
    },
  });
  await AsyncStorage.setItem(TRACKING_OPTIONS_VERSION_KEY, String(TRACKING_OPTIONS_VERSION)).catch(() => undefined);
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
