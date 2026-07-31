import AsyncStorage from "@react-native-async-storage/async-storage";

const COOLDOWN_KEY = "semse.proximity.cooldowns";
/** Don't re-prompt for the same site right after a dismiss/start, or while lingering inside the radius. */
const COOLDOWN_MS = 20 * 60 * 1000;

async function readCooldowns(): Promise<Record<string, number>> {
  const raw = await AsyncStorage.getItem(COOLDOWN_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

export async function isCoolingDown(siteKey: string): Promise<boolean> {
  const cooldowns = await readCooldowns();
  const at = cooldowns[siteKey];
  return typeof at === "number" && Date.now() - at < COOLDOWN_MS;
}

export async function markCooldown(siteKey: string): Promise<void> {
  const cooldowns = await readCooldowns();
  cooldowns[siteKey] = Date.now();
  await AsyncStorage.setItem(COOLDOWN_KEY, JSON.stringify(cooldowns));
}
