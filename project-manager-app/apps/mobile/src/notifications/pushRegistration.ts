import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { registerPushToken, unregisterPushToken } from "../api/push";
import { requestNotificationPermissions } from "./notifications";

const DEVICE_ID_KEY = "semse.pushDeviceId";

/** A stable per-install identifier — not the OS device ID (accessing that needs extra permissions/is restricted on both platforms), just a UUID generated once and persisted alongside the auth tokens. */
async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const generated = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  return generated;
}

function resolveProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

/**
 * Requests notification permission (if not already granted) and registers
 * this device's Expo push token with the API. Safe to call every time the
 * app opens with an active session — POST /v1/push/register upserts, so a
 * repeat call with the same token/deviceId is a no-op server-side.
 *
 * No-ops (logs and returns) if there's no EAS projectId configured yet —
 * that only exists after `eas init` has been run once for this app.
 */
export async function registerForPushNotificationsAsync(): Promise<void> {
  const projectId = resolveProjectId();
  if (!projectId) {
    console.warn("[push] skipping registration — no EAS projectId in app.json yet (run `eas init`)");
    return;
  }

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const deviceId = await getOrCreateDeviceId();
  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
  const platform = Platform.OS === "ios" ? "ios" : "android";

  await registerPushToken({ deviceId, expoPushToken, platform });
}

/** Call on logout so the server stops sending push to a signed-out device. */
export async function unregisterPushNotificationsAsync(): Promise<void> {
  const deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!deviceId) return;
  await unregisterPushToken(deviceId).catch(() => undefined);
}
