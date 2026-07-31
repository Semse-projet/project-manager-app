import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fetchProfile, updateProximityCheckInMode, type ProximityCheckInMode } from "../api/profile";
import { useAuth } from "../context/AuthContext";
import { saveProximityMode } from "../geo/siteCache";

const OPTIONS: { value: ProximityCheckInMode; label: string; hint: string }[] = [
  { value: "ask", label: "Preguntar siempre", hint: "Te avisa cuando llegas a un sitio y confirmas antes de iniciar el reloj." },
  { value: "auto", label: "Iniciar automático", hint: "Inicia el reloj solo al detectar que llegaste, sin pedirte confirmación." },
  { value: "off", label: "Desactivado", hint: "SEMSE no solicita tu ubicación ni sugiere iniciar el reloj por proximidad." },
];

export default function SettingsScreen() {
  const { logout } = useAuth();
  const [mode, setMode] = useState<ProximityCheckInMode>("ask");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      fetchProfile()
        .then((profile) => {
          if (!cancelled) setMode(profile.proximityCheckInMode);
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Check-in automático por ubicación</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {OPTIONS.map((option) => {
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

      <Pressable style={styles.logoutButton} onPress={() => void logout()}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 13, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 4 },
  option: { borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, padding: 14 },
  optionSelected: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  optionLabel: { fontSize: 15, fontWeight: "700", color: "#111827" },
  optionLabelSelected: { color: "#2563eb" },
  optionHint: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  logoutButton: { marginTop: "auto", padding: 14, alignItems: "center" },
  logoutText: { color: "#dc2626", fontWeight: "700" },
  error: { color: "#dc2626", fontSize: 13 },
});
