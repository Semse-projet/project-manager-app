import * as TaskManager from "expo-task-manager";
import type { LocationObject } from "expo-location";
import { evaluateLocation } from "./proximityService";

export const PROXIMITY_LOCATION_TASK = "semse-proximity-location-task";

// `defineTask` must run at module scope (imported once, early — see index.ts),
// not inside a component: Expo re-runs this module in a headless JS context
// when the OS wakes the app for a background location update, and the task
// needs to already be registered by the time that happens.
TaskManager.defineTask<{ locations: LocationObject[] }>(PROXIMITY_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn("[proximity-task] location error", error.message);
    return;
  }
  const locations = data?.locations;
  if (!locations || locations.length === 0) return;

  const latest = locations[locations.length - 1];
  await evaluateLocation({ latitude: latest.coords.latitude, longitude: latest.coords.longitude });
});
