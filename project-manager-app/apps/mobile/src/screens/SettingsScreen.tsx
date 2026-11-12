import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fetchProfile, updateProximityCheckInMode, type ProximityCheckInMode } from "../api/profile";
import { useAuth } from "../context/AuthContext";
import { saveProximityMode } from "../geo/siteCache";
import {
  fetchLocationPreference,
  saveLocationPreference,
  type LocationMode,
  type LocationPreference,
} from "../api/locationPreference";
import { proximityModeFromLocationPreference } from "../geo/locationMode";
import { useTheme } from "../theme/theme";

const OPTIONS: { value: ProximityCheckInMode; label: string; hint: string }[] = [
  { value: "ask", label: "Preguntar siempre", hint: "Te avisa cuando llegas a un sitio y confirmas antes de iniciar el reloj." },
  { value: "auto", label: "Iniciar automático", hint: "Inicia el reloj solo al detectar que llegaste, sin pedirte confirmación." },
  { value: "off", label: "Desactivado", hint: "SEMSE no solicita tu ubicación ni sugiere iniciar el reloj por proximidad." },
];

// BO-09 options (docs/specs/core/geofence-policy.spec.md v0.3, OPEN-17).
const BO09_OPTIONS: { value: LocationMode; label: string; hint: string }[] = [
  { value: "ASK", label: "Preguntar", hint: "Al llegar te preguntamos si quieres iniciar el reloj. Es la opción por defecto." },
  { value: "AUTO", label: "Iniciar automático", hint: "El reloj puede iniciarse solo al llegar. Requiere tu consentimiento específico." },
  { value: "OFF", label: "Desactivado", hint: "SEMSE no usa tu ubicación para el reloj." },
];

function confirm(title: string, message: string, accept: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      { text: accept, onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export default function SettingsScreen() {
  const { logout } = useAuth();
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [mode, setMode] = useState<ProximityCheckInMode>("ask");
  // null = BO-09 disabled (404) → legacy profile mode, as before.
  const [pref, setPref] = useState<LocationPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      Promise.all([fetchProfile(), fetchLocationPreference().catch(() => null)])
        .then(([profile, locationPreference]) => {
          if (cancelled) return;
          setMode(profile.proximityCheckInMode);
          setPref(locationPreference);
        })
        .catch((caught: unknown) => {
          if (!cancelled) setError(caught instanceof Error ? caught.message : "No se pudo cargar tu perfil.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function handleSelect(next: ProximityCheckInMode) {
    if (saving || next === mode) return;
    setSaving(true);
    setError(null);
    try {
      await updateProximityCheckInMode(next);
      await saveProximityMode(next);
      setMode(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectBo09(next: LocationMode) {
    if (saving || !pref || next === pref.mode) return;
    let consent: boolean | undefined;
    if (next === "AUTO" && !pref.autoStartConsent) {
      const ok = await confirm(
        "Consentimiento para inicio automático",
        "Con este modo, cuando la app detecte que llegaste a un lugar de trabajo podrá iniciar tu reloj sin preguntarte. " +
          "Si se inició por error, puedes detenerlo desde el reloj. Puedes revocarlo en cualquier momento cambiando de modo.",
        "Doy mi consentimiento",
      );
      if (!ok) return;
      consent = true;
    } else if (pref.mode === "AUTO" && pref.autoStartConsent) {
      const ok = await confirm(
        "Salir del inicio automático",
        "Al salir se revoca tu consentimiento. Si quieres volver, te lo pediremos de nuevo.",
        "Cambiar modo",
      );
      if (!ok) return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await saveLocationPreference({ mode: next, ...(consent ? { autoStartConsent: true } : {}) });
      setPref(saved);
      await saveProximityMode(proximityModeFromLocationPreference(saved));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Check-in automático por ubicación</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {pref
        ? BO09_OPTIONS.map((option) => {
            const selected = pref.mode === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: saving }}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => void handleSelectBo09(option.value)}
                disabled={saving}
              >
                <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
                <Text style={styles.optionHint}>
                  {option.hint}
                  {selected && option.value === "AUTO" && pref.autoStartConsent ? " · Consentimiento vigente." : ""}
                </Text>
              </Pressable>
            );
          })
        : OPTIONS.map((option) => {
            const selected = mode === option.value;
            return (
              <Pressable
                key={option.value}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => void handleSelect(option.value)}
                disabled={saving}
              >
                <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
                <Text style={styles.optionHint}>{option.hint}</Text>
              </Pressable>
            );
          })}
      {pref && pref.mode === "AUTO" && !pref.autoStartConsent ? (
        <Text style={styles.optionHint}>AUTO sin consentimiento vigente se comporta como «Preguntar».</Text>
      ) : null}
      {pref ? (
        <Text style={styles.optionHint}>
          SEMSE no guarda tus coordenadas en estas decisiones, solo el resultado y un rango de precisión.
        </Text>
      ) : null}

      <Pressable style={styles.logoutButton} onPress={() => void logout()}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, padding: 20, gap: 12, backgroundColor: theme.colors.base },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    title: { fontSize: 13, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase", marginBottom: 4 },
    option: { borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: theme.radius.lg, padding: 14 },
    optionSelected: { borderColor: theme.colors.brand, backgroundColor: theme.colors.brandDim },
    optionLabel: { fontSize: 15, fontWeight: "700", color: theme.colors.ink },
    optionLabelSelected: { color: theme.colors.brand },
    optionHint: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
    logoutButton: { marginTop: "auto", padding: 14, alignItems: "center" },
    logoutText: { color: theme.colors.error, fontWeight: "700" },
    error: { color: theme.colors.error, fontSize: 13 },
  });
}
