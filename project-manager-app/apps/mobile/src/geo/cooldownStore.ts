import AsyncStorage from "@react-native-async-storage/async-storage";

const COOLDOWN_KEY = "semse.proximity.cooldowns";
/** Fallback used only if the caller doesn't pass the org-configured value. */
const DEFAULT_COOLDOWN_MINUTES = 20;

async function readCooldowns(): Promise<Record<string, number>> {
  const raw = await AsyncStorage.getItem(COOLDOWN_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

/** Don't re-prompt for the same site right after a dismiss/start, or while
 * lingering inside the radius — `cooldownMinutes` comes from the org's
 * configured proximity settings (see siteCache.loadProximityConfig). */
export async function isCoolingDown(siteKey: string, cooldownMinutes: number = DEFAULT_COOLDOWN_MINUTES): Promise<boolean> {
  const cooldowns = await readCooldowns();
  const at = cooldowns[siteKey];
  return typeof at === "number" && Date.now() - at < cooldownMinutes * 60 * 1000;
}

export async function markCooldown(siteKey: string): Promise<void> {
  const cooldowns = await readCooldowns();
  cooldowns[siteKey] = Date.now();
  await AsyncStorage.setItem(COOLDOWN_KEY, JSON.stringify(cooldowns));
}
