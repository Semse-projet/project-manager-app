import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fetchActiveTimer, startTimer, stopTimer, type ActiveTimer } from "../api/labor";
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

export default function TimerScreen() {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [togglingTracking, setTogglingTracking] = useState(false);
  const [showPermissionPrimer, setShowPermissionPrimer] = useState(false);

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
    cardHint: { fontSize: 12, color: theme.colors.muted, marginTop: 4 },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    flexShrink: { flex: 1 },
    button: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, padding: 12, alignItems: "center", marginTop: 4 },
    buttonDanger: { backgroundColor: theme.colors.error },
    buttonText: { color: "#fff", fontWeight: "700" },
    error: { color: theme.colors.error, fontSize: 13 },
  });
}
