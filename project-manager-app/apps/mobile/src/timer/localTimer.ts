import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ActiveTimer } from "../api/labor";

const LOCAL_TIMER_KEY = "semse.local.timer.v1";
const LOCAL_HISTORY_KEY = "semse.local.timer.history.v1";
const MAX_HISTORY_ITEMS = 20;
export const MAX_REASONABLE_ACTIVE_SECONDS = 7 * 24 * 60 * 60;
type TimerRecord = NonNullable<ActiveTimer>;

function createTimer(startedAt = new Date().toISOString()): TimerRecord {
  return { id: `local-timer-${Date.now()}`, tenantId: "local", orgId: "local", createdBy: "local", mode: "realtime", purpose: "personal", jobId: null, freeProjectId: null, status: "running", startedAt, endedAt: null, resumedAt: null, pausedAt: null, breakMinutes: 0, durationMinutes: null, accumulatedSeconds: 0, hourlyRate: null, currency: "USD", location: null, checkInLatitude: null, checkInLongitude: null, checkInDistanceMeters: null, checkInMethod: null, notes: null, editedBy: null, editReason: null, contextEntityType: null, contextEntityId: null, clientEventId: `local-${Date.now()}`, createdAt: startedAt, updatedAt: startedAt };
}
function elapsedSince(timer: TimerRecord, now = Date.now()): number { const accumulated = Math.max(0, Number(timer.accumulatedSeconds ?? 0)); if (timer.status !== "running") return accumulated; const started = Date.parse(timer.resumedAt ?? timer.startedAt); return accumulated + (Number.isFinite(started) ? Math.max(0, Math.floor((now - started) / 1000)) : 0); }
export function isReasonableActiveTimer(timer: ActiveTimer, now = Date.now()): timer is TimerRecord { if (!timer || timer.status === "completed") return false; const started = Date.parse(timer.resumedAt ?? timer.startedAt); return Number.isFinite(started) && started <= now + 60_000 && elapsedSince(timer, now) <= MAX_REASONABLE_ACTIVE_SECONDS; }
export async function loadLocalTimer(): Promise<ActiveTimer> { const raw = await AsyncStorage.getItem(LOCAL_TIMER_KEY); if (!raw) return null; try { const timer = JSON.parse(raw) as TimerRecord; if (!isReasonableActiveTimer(timer)) { await AsyncStorage.removeItem(LOCAL_TIMER_KEY); return null; } return timer; } catch { await AsyncStorage.removeItem(LOCAL_TIMER_KEY); return null; } }
export async function saveLocalTimer(timer: ActiveTimer): Promise<void> { if (!timer) return AsyncStorage.removeItem(LOCAL_TIMER_KEY); await AsyncStorage.setItem(LOCAL_TIMER_KEY, JSON.stringify(timer)); }
export async function startLocalTimer(): Promise<TimerRecord> { const current = await loadLocalTimer(); if (current) return current; const timer = createTimer(); await saveLocalTimer(timer); return timer; }
export async function pauseLocalTimer(timer: TimerRecord): Promise<TimerRecord> { const pausedAt = new Date().toISOString(); const paused = { ...timer, status: "paused" as const, pausedAt, resumedAt: null, accumulatedSeconds: elapsedSince(timer), updatedAt: pausedAt }; await saveLocalTimer(paused); return paused; }
export async function resumeLocalTimer(timer: TimerRecord): Promise<TimerRecord> { const resumedAt = new Date().toISOString(); const resumed = { ...timer, status: "running" as const, resumedAt, pausedAt: null, updatedAt: resumedAt }; await saveLocalTimer(resumed); return resumed; }
export async function stopLocalTimer(timer: TimerRecord): Promise<TimerRecord> { const endedAt = new Date().toISOString(); const stopped = { ...timer, status: "completed" as const, endedAt, resumedAt: null, accumulatedSeconds: elapsedSince(timer), durationMinutes: Math.floor(elapsedSince(timer) / 60), updatedAt: endedAt }; const history = await loadLocalHistory(); await AsyncStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify([stopped, ...history].slice(0, MAX_HISTORY_ITEMS))); await AsyncStorage.removeItem(LOCAL_TIMER_KEY); return stopped; }
export async function loadLocalHistory(): Promise<TimerRecord[]> { const raw = await AsyncStorage.getItem(LOCAL_HISTORY_KEY); if (!raw) return []; try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed as TimerRecord[] : []; } catch { await AsyncStorage.removeItem(LOCAL_HISTORY_KEY); return []; } }
export async function replaceLocalHistoryEntry(localId: string, replacement: TimerRecord): Promise<void> { const history = await loadLocalHistory(); await AsyncStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history.map((entry) => entry.id === localId ? replacement : entry).slice(0, MAX_HISTORY_ITEMS))); }
