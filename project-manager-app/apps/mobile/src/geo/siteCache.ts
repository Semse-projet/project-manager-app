import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ProximityCheckInMode } from "../api/profile";

export type ProximitySite = {
  kind: "job" | "free";
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

const SITES_KEY = "semse.proximity.sites";
const MODE_KEY = "semse.proximity.mode";

/**
 * The background location task has no React tree to read state from, so the
 * foreground app periodically persists the sites/mode here and the task reads
 * them back on each location update.
 */
export async function saveSites(sites: ProximitySite[]): Promise<void> {
  await AsyncStorage.setItem(SITES_KEY, JSON.stringify(sites));
}

export async function loadSites(): Promise<ProximitySite[]> {
  const raw = await AsyncStorage.getItem(SITES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ProximitySite[]) : [];
  } catch {
    return [];
  }
}

export async function saveProximityMode(mode: ProximityCheckInMode): Promise<void> {
  await AsyncStorage.setItem(MODE_KEY, mode);
}

export async function loadProximityMode(): Promise<ProximityCheckInMode> {
  const raw = await AsyncStorage.getItem(MODE_KEY);
  return raw === "ask" || raw === "auto" || raw === "off" ? raw : "ask";
}
