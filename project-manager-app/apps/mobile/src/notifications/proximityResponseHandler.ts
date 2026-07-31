import * as Notifications from "expo-notifications";
import { startTimer } from "../api/labor";
import type { ProximityNotificationData } from "./notifications";
import { PROXIMITY_ACTION_START } from "./notifications";

/**
 * Registers the listener that reacts to the "Iniciar" button on the proximity
 * "ask" notification. Call once at app startup (not per-screen) — this must
 * keep working even if the screen that originally showed the prompt is gone.
 */
export function registerProximityResponseListener(): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    if (response.actionIdentifier !== PROXIMITY_ACTION_START) return;

    const data = response.notification.request.content.data as ProximityNotificationData | undefined;
    if (!data || data.kind !== "ask") return;

    void startTimer({
      purpose: data.siteKind === "job" ? "job_linked" : "payable",
      jobId: data.siteKind === "job" ? data.siteId : undefined,
      freeProjectId: data.siteKind === "free" ? data.siteId : undefined,
      checkIn: { latitude: data.latitude, longitude: data.longitude, method: "proximity_confirmed" },
      clientEventId: `proximity-confirmed-${data.siteKind}-${data.siteId}-${Date.now()}`,
    }).catch((error: unknown) => {
      console.warn("[proximity] failed to start timer from notification action", error);
    });
  });

  return () => subscription.remove();
}
