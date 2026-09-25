import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { createManualEntry, fetchActiveTimer, pauseTimer, resumeTimer, startTimer, stopTimer, type ActiveTimer } from "../api/labor";
import { PermissionPrimerModal } from "../components/PermissionPrimerModal";
import {
  isProximityTrackingActive,
  requestProximityPermissions,
  startProximityTracking,
  stopProximityTracking,
} from "../geo/backgroundLocation";
import { hasSeenProximityPrimer, markProximityPrimerSeen } from "../geo/permissionPrimer";
import { refreshProximitySites } from "../geo/refreshSites";
import { loadProximityMode } from "../geo/siteCache";
import { registerProximityNotificationCategory, requestNotificationPermissions } from "../notifications/notifications";
import { useTheme } from "../theme/theme";
import { isReasonableActiveTimer, loadLocalHistory, loadLocalTimer, pauseLocalTimer, replaceLocalHistoryEntry, resumeLocalTimer, startLocalTimer, stopLocalTimer, saveLocalTimer } from "../timer/localTimer";

export default function TimerScreen() {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof loadLocalHistory>>>([]);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [togglingTracking, setTogglingTracking] = useState(false);
  const [showPermissionPrimer, setShowPermissionPrimer] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const loadRequestRef = useRef(0);

  useEffect(() => {
    if (activeTimer?.status !== "running") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeTimer?.status]);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setError(null);
    const localTimer = await loadLocalTimer().catch(() => null);
    setHistory(await loadLocalHistory().catch(() => []));
    try {
      const timer = await fetchActiveTimer();
      if (requestId !== loadRequestRef.current) return;
      const remoteIsUsable = isReasonableActiveTimer(timer);
      const usableRemote = remoteIsUsable ? timer : null;
      const sameSession = Boolean(localTimer && usableRemote && localTimer.id === usableRemote.id);
      const nextTimer = localTimer && (!usableRemote || !sameSession) ? localTimer : (usableRemote || null);
      setActiveTimer(nextTimer);
      if (usableRemote && sameSession) await saveLocalTimer(usableRemote).catch(() => undefined);
      setOfflineMode(Boolean(timer && !remoteIsUsable) || Boolean(localTimer && usableRemote && !sameSession));
      setTrackingEnabled(await isProximityTrackingActive().catch(() => false));
      // Proximity synchronization is optional and must not block the timer.
      void refreshProximitySites().catch(() => undefined);
      void syncLocalHistory();
    } catch (caught) {
      if (requestId !== loadRequestRef.current) return;
      setActiveTimer(localTimer);
      setOfflineMode(true);
      setTrackingEnabled(await isProximityTrackingActive().catch(() => false));
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, []);

  async function syncLocalHistory() {
    const pending = await loadLocalHistory().catch(() => []);
    for (const entry of pending.filter((item) => item.id.startsWith("local-timer-") && item.endedAt)) {
      const started = new Date(entry.startedAt);
      const ended = new Date(entry.endedAt as string);
      if (!Number.isFinite(started.getTime()) || !Number.isFinite(ended.getTime()) || started.toDateString() !== ended.toDateString()) continue;
      try {
        const remote = await createManualEntry({
          purpose: entry.purpose,
          date: formatManualDate(started),
          startTime: formatManualTime(started),
          endTime: formatManualTime(ended),
          breakMinutes: entry.breakMinutes,
          notes: entry.notes ?? undefined,
          clientEventId: entry.clientEventId ?? entry.id,
        });
        await replaceLocalHistoryEntry(entry.id, remote);
      } catch {
        // Keep the local entry. It will be retried on the next successful load.
      }
    }
    setHistory(await loadLocalHistory().catch(() => []));
  }

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleStart() {
    setSaving(true);
    setError(null);
    const local = await startLocalTimer();
    setActiveTimer(local);
    try {
      const entry = await startTimer({ purpose: "personal", clientEventId: `manual-${Date.now()}` });
      if (isReasonableActiveTimer(entry)) {
        await saveLocalTimer(entry);
        setActiveTimer(entry);
        setOfflineMode(false);
      } else {
        setOfflineMode(true);
      }
    } catch (caught) {
      setOfflineMode(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleStop() {
    if (!activeTimer) return;
    setSaving(true);
    setError(null);
    const wasLocal = activeTimer.id.startsWith("local-timer-");
    await stopLocalTimer(activeTimer);
    setHistory(await loadLocalHistory().catch(() => []));
    setActiveTimer(null);
    try {
      if (!wasLocal) await stopTimer(activeTimer.id);
      await saveLocalTimer(null);
      setActiveTimer(null);
      setOfflineMode(false);
    } catch (caught) {
      setOfflineMode(true);
      setActiveTimer(null);
    } finally {
      setSaving(false);
    }
  }

  async function handlePauseResume() {
    if (!activeTimer || saving) return;
    setSaving(true);
    setError(null);
    const isLocal = activeTimer.id.startsWith("local-timer-");
    const local = activeTimer.status === "paused" ? await resumeLocalTimer(activeTimer) : await pauseLocalTimer(activeTimer);
    setActiveTimer(local);
    try {
      if (isLocal) throw new Error("offline");
      const updated = activeTimer.status === "paused" ? await resumeTimer(activeTimer.id) : await pauseTimer(activeTimer.id);
      await saveLocalTimer(updated);
      setActiveTimer(updated);
      setOfflineMode(false);
      setNow(Date.now());
    } catch (caught) {
      setOfflineMode(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleTracking(next: boolean) {
    if (!next) {
      setTogglingTracking(true);
      setError(null);
      try {
        await stopProximityTracking();
        setTrackingEnabled(false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudo actualizar el rastreo de ubicación.");
      } finally {
        setTogglingTracking(false);
      }
      return;
    }

    setError(null);
    const mode = await loadProximityMode();
    if (mode === "off") {
      setError('El check-in por proximidad está "Desactivado" en Ajustes — cámbialo ahí primero.');
      return;
    }

    // First time enabling this on the device: explain why before the OS
    // permission dialogs show up, rather than letting them be the only
    // explanation the worker ever sees.
    if (!(await hasSeenProximityPrimer())) {
      setShowPermissionPrimer(true);
      return;
    }

    await enableProximityTracking();
  }

  async function enableProximityTracking() {
    setTogglingTracking(true);
    setError(null);
    try {
      const [locationPermission, notificationsGranted] = await Promise.all([
        requestProximityPermissions(),
        requestNotificationPermissions(),
      ]);
      if (!locationPermission.granted) {
        setError(
          locationPermission.reason === "background"
            ? 'Necesitamos permiso de ubicación "Siempre" para avisarte con la app cerrada.'
            : "Necesitamos permiso de ubicación para esta función.",
        );
        return;
      }
      if (!notificationsGranted) {
        setError("Necesitamos permiso de notificaciones para avisarte cuando estés cerca de un sitio.");
        return;
      }
      await registerProximityNotificationCategory();
      await startProximityTracking();
      setTrackingEnabled(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar el rastreo de ubicación.");
    } finally {
      setTogglingTracking(false);
    }
  }

  function handlePrimerConfirm() {
    setShowPermissionPrimer(false);
    void markProximityPrimerSeen();
    void enableProximityTracking();
  }

  function handlePrimerCancel() {
    setShowPermissionPrimer(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {offlineMode ? <Text style={styles.offline}>Modo local activo: el reloj funciona sin conexión.</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Estado</Text>
        <Text style={styles.cardValue}>{activeTimer ? (activeTimer.status === "paused" ? "En pausa" : "Corriendo") : "Sin sesión activa"}</Text>
        {activeTimer ? (
          <>
            <Text style={styles.elapsed}>{formatElapsedSeconds(getElapsedSeconds(activeTimer, now))}</Text>
            <View style={styles.actions}>
              <Pressable style={[styles.button, styles.buttonSecondary]} onPress={() => void handlePauseResume()} disabled={saving}>
                {saving ? <ActivityIndicator color={theme.colors.ink} /> : <Text style={styles.secondaryButtonText}>{activeTimer.status === "paused" ? "Reanudar" : "Pausar"}</Text>}
              </Pressable>
              <Pressable style={[styles.button, styles.buttonDanger]} onPress={() => void handleStop()} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Detener</Text>}
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable style={styles.button} onPress={() => void handleStart()} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Iniciar reloj personal</Text>}
          </Pressable>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Memoria del reloj</Text>
        {history.length === 0 ? (
          <Text style={styles.cardHint}>Tus sesiones terminadas aparecerán aquí.</Text>
        ) : (
          history.slice(0, 5).map((entry) => (
            <View key={entry.id} style={styles.historyRow}>
              <Text style={styles.historyDate}>{formatHistoryDate(entry.endedAt ?? entry.updatedAt)}</Text>
              <Text style={styles.historyDuration}>{formatElapsedSeconds((entry.durationMinutes ?? 0) * 60)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.flexShrink}>
            <Text style={styles.cardLabel}>Aviso por proximidad</Text>
            <Text style={styles.cardHint}>
              Avísame cuando esté cerca de un job o proyecto, incluso con la app cerrada.
            </Text>
          </View>
          <Switch value={trackingEnabled} onValueChange={(next) => void handleToggleTracking(next)} disabled={togglingTracking} />
        </View>
      </View>

      <PermissionPrimerModal
        visible={showPermissionPrimer}
        onConfirm={handlePrimerConfirm}
        onCancel={handlePrimerCancel}
      />
    </ScrollView>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: 20, gap: 16 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 10,
    },
    cardLabel: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase" },
    cardValue: { fontSize: 20, fontWeight: "800", color: theme.colors.ink },
    elapsed: { fontSize: 42, fontVariant: ["tabular-nums"], fontWeight: "800", color: theme.colors.brand, letterSpacing: 1 },
    cardHint: { fontSize: 12, color: theme.colors.muted, marginTop: 4 },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    flexShrink: { flex: 1 },
    actions: { flexDirection: "row", gap: 10 },
    button: { flex: 1, backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, padding: 12, alignItems: "center", marginTop: 4 },
    buttonSecondary: { backgroundColor: theme.colors.raised },
    buttonDanger: { backgroundColor: theme.colors.error },
    buttonText: { color: "#fff", fontWeight: "700" },
    secondaryButtonText: { color: theme.colors.ink, fontWeight: "700" },
    offline: { color: theme.colors.brand, fontSize: 13, fontWeight: "700" },
    historyRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    historyDate: { color: theme.colors.ink, fontSize: 13 },
    historyDuration: { color: theme.colors.brand, fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
    error: { color: theme.colors.error, fontSize: 13 },
  });
}

export function getElapsedSeconds(
  timer: Pick<NonNullable<ActiveTimer>, "status" | "startedAt" | "resumedAt" | "accumulatedSeconds" | "durationMinutes">,
  now = Date.now(),
): number {
  if (timer.status === "completed") return Math.min(Math.max(0, timer.durationMinutes ?? 0) * 60, 7 * 24 * 60 * 60);
  const accumulated = Math.min(Math.max(0, Number(timer.accumulatedSeconds ?? 0)), 7 * 24 * 60 * 60);
  if (timer.status !== "running") return accumulated;
  const started = Date.parse(timer.resumedAt ?? timer.startedAt);
  const elapsed = accumulated + (Number.isFinite(started) ? Math.max(0, Math.floor((now - started) / 1000)) : 0);
  return Math.min(elapsed, 7 * 24 * 60 * 60);
}

export function formatElapsedSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((safe % 3600) / 60).toString().padStart(2, "0");
  const seconds = (safe % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatHistoryDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Sesión";
  return date.toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatManualDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatManualTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
