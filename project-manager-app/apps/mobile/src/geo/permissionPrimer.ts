import AsyncStorage from "@react-native-async-storage/async-storage";

const PRIMER_SEEN_KEY = "semse.proximity.permission-primer-seen";

/** Whether the worker has already been shown PermissionPrimerModal — the OS
 * permission dialog only explains itself in one line, so we show our own
 * "why" once before ever triggering it. */
export async function hasSeenProximityPrimer(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PRIMER_SEEN_KEY);
  return raw === "1";
}

export async function markProximityPrimerSeen(): Promise<void> {
  await AsyncStorage.setItem(PRIMER_SEEN_KEY, "1");
}
