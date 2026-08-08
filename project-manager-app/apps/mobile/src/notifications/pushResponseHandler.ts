import * as Notifications from "expo-notifications";
import { navigationRef } from "../navigation/navigationRef";
import { resolveWorkerNotificationTarget } from "./pushNotificationTargets";

/**
 * Registers the listener that reacts to tapping a remote push notification
 * (bid accepted, job assigned, dispute updates, payment released, ...) and
 * deep-links into the relevant Worker-tab screen instead of just opening the
 * app to wherever it last was. Only mount this while the Worker tab
 * navigator is active (see RootNavigator.tsx) — a Client/Admin user never
 * has a "Jobs"/"More" tab for these targets to resolve into.
 */
export function registerWorkerPushResponseListener(): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    const target = resolveWorkerNotificationTarget(data);
    if (!target || !navigationRef.isReady()) return;

    const navigate = navigationRef.navigate as (...args: unknown[]) => void;
    if (target.screen === "Payments") {
      navigate(target.tab, { screen: target.screen });
    } else {
      navigate(target.tab, { screen: target.screen, params: target.params });
    }
  });

  return () => subscription.remove();
}
