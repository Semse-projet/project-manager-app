import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { LaborRatesResponseView } from "@semse/schemas";
import { fetchLaborRates, resetLaborRates, saveLaborRates } from "../../api/pricing";
import { useTheme } from "../../theme/theme";
import { formatCurrency } from "../../utils/format";
import { ErrorState } from "../../components/ErrorState";

export default function RatesScreen() {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [data, setData] = useState<LaborRatesResponseView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [laborRate, setLaborRate] = useState("");
  const [markup, setMarkup] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchLaborRates();
      setData(result);
      setLaborRate(result.override ? String(result.override.laborRatePerHr) : "");
      setMarkup(result.override ? String(Math.round(result.override.materialMarkup * 100)) : "");
      setNotes(result.override?.notes ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar tus tarifas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleSave() {
    const laborRatePerHr = Number(laborRate);
    const materialMarkup = Number(markup) / 100;
    if (saving || !Number.isFinite(laborRatePerHr) || laborRatePerHr < 10 || laborRatePerHr > 250 || !Number.isFinite(materialMarkup) || materialMarkup < 0 || materialMarkup > 1) {
      setError("Tarifa entre $10–250/hr y margen entre 0–100% requeridos.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveLaborRates({ laborRatePerHr, materialMarkup, notes: notes.trim() || undefined });
      await load();
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await resetLaborRates();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo revertir.");
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
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <ErrorState message={error} /> : null}
      {saved ? <Text style={styles.saved}>✅ Tarifas guardadas.</Text> : null}

      {data ? (
        <Text style={styles.hint}>
          Referencia nacional (BLS): {formatCurrency(data.nationalBaselineHourlyRate)}/hr
          {data.hasCustomRates ? " — tienes tarifa personalizada activa." : " — usando la referencia nacional."}
        </Text>
      ) : null}

      <Text style={styles.label}>Tu tarifa por hora ($10–250)</Text>
      <TextInput style={styles.input} value={laborRate} onChangeText={setLaborRate} placeholder="0" placeholderTextColor={theme.colors.faint} keyboardType="decimal-pad" />

      <Text style={styles.label}>Margen de materiales (%)</Text>
      <TextInput style={styles.input} value={markup} onChangeText={setMarkup} placeholder="0" placeholderTextColor={theme.colors.faint} keyboardType="decimal-pad" />

      <Text style={styles.label}>Notas (opcional)</Text>
      <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder="Detalles..." placeholderTextColor={theme.colors.faint} multiline />

      <View style={styles.rowGap}>
        <Pressable style={[styles.button, saving && styles.buttonDisabled]} onPress={() => void handleSave()} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Guardar</Text>}
        </Pressable>
        {data?.hasCustomRates ? (
          <Pressable style={styles.secondaryButton} onPress={() => void handleReset()} disabled={saving}>
            <Text style={styles.secondaryButtonText}>Volver a la referencia BLS</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: theme.spacing.lg, gap: theme.spacing.sm },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    label: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase", marginTop: theme.spacing.sm },
    input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12, fontSize: 14, color: theme.colors.ink, backgroundColor: theme.colors.surface },
    hint: { fontSize: 12, color: theme.colors.muted },
    saved: { fontSize: 13, color: theme.colors.ok },
    error: { color: theme.colors.error, fontSize: 13 },
    rowGap: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: theme.spacing.md },
    button: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, padding: 12, alignItems: "center" },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: "#fff", fontWeight: "700" },
    secondaryButton: { padding: 12, alignItems: "center" },
    secondaryButtonText: { color: theme.colors.muted, fontWeight: "700" },
  });
}
