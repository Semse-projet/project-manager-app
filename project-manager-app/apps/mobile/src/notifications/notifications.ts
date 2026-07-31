import * as Notifications from "expo-notifications";

export const PROXIMITY_CATEGORY = "proximity-checkin";
export const PROXIMITY_ACTION_START = "start";
export const PROXIMITY_ACTION_DISMISS = "dismiss";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Registers the "Iniciar"/"Descartar" action buttons shown on the "ask" proximity notification. */
export async function registerProximityNotificationCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(PROXIMITY_CATEGORY, [
    { identifier: PROXIMITY_ACTION_START, buttonTitle: "Iniciar", options: { opensAppToForeground: false } },
    { identifier: PROXIMITY_ACTION_DISMISS, buttonTitle: "Descartar", options: { opensAppToForeground: false, isDestructive: true } },
  ]);
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const request = await Notifications.requestPermissionsAsync();
  return request.granted;
}

export type ProximityNotificationData =
  | { kind: "auto-started" }
  | { kind: "ask"; siteKind: "job" | "free"; siteId: string; siteName: string; latitude: number; longitude: number };

export async function presentProximityNotification(input: {
  title: string;
  body: string;
  data: ProximityNotificationData;
  categoryIdentifier?: string;
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      data: input.data,
      categoryIdentifier: input.categoryIdentifier,
    },
    trigger: null,
  });
}
