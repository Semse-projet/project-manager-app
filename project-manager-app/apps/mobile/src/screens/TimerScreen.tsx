import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fetchActiveTimer, startTimer, stopTimer, type ActiveTimer } from "../api/labor";
import {
  isProximityTrackingActive,
  requestProximityPermissions,
  startProximityTracking,
  stopProximityTracking,
} from "../geo/backgroundLocation";
import { refreshProximitySites } from "../geo/refreshSites";
import { loadProximityMode } from "../geo/siteCache";
import { registerProximityNotificationCategory, requestNotificationPermissions } from "../notifications/notifications";

export default function TimerScreen() {
  const [activeTimer, setActiveTimer] = useState<ActiveTimer>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [togglingTracking, setTogglingTracking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [timer, active] = await Promise.all([
        fetchActiveTimer(),
        isProximityTrackingActive(),
        refreshProximitySites(),
      ]);
      setActiveTimer(timer);
      setTrackingEnabled(active);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el estado del timer.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleStart() {
    setSaving(true);
    setError(null);
    try {
      const entry = await startTimer({ purpose: "personal", clientEventId: `manual-${Date.now()}` });
      setActiveTimer(entry);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo iniciar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStop() {
    if (!activeTimer) return;
    setSaving(true);
    setError(null);
    try {
      await stopTimer(activeTimer.id);
      setActiveTimer(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo detener.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleTracking(next: boolean) {
    setTogglingTracking(true);
    setError(null);
    try {
      if (next) {
        const mode = await loadProximityMode();
        if (mode === "off") {
          setError('El check-in por proximidad está "Desactivado" en Ajustes — cámbialo ahí primero.');
          return;
        }
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
      } else {
        await stopProximityTracking();
        setTrackingEnabled(false);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar el rastreo de ubicación.");
    } finally {
      setTogglingTracking(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Estado</Text>
        <Text style={styles.cardValue}>{activeTimer ? "Corriendo" : "Sin sesión activa"}</Text>
        {activeTimer ? (
          <Pressable style={[styles.button, styles.buttonDanger]} onPress={() => void handleStop()} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Detener</Text>}
          </Pressable>
        ) : (
          <Pressable style={styles.button} onPress={() => void handleStart()} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Iniciar (solo calcular)</Text>}
          </Pressable>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: "#f9fafb", borderRadius: 14, padding: 18, borderWidth: 1, borderColor: "#e5e7eb", gap: 10 },
  cardLabel: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase" },
  cardValue: { fontSize: 20, fontWeight: "800", color: "#111827" },
  cardHint: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  flexShrink: { flex: 1 },
  button: { backgroundColor: "#2563eb", borderRadius: 10, padding: 12, alignItems: "center", marginTop: 4 },
  buttonDanger: { backgroundColor: "#dc2626" },
  buttonText: { color: "#fff", fontWeight: "700" },
  error: { color: "#dc2626", fontSize: 13 },
});
