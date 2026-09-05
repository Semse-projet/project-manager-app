import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { IncidentRecordView, IncidentSeverity, IncidentType } from "@semse/schemas";
import { createIncident, fetchMyIncidents } from "../../api/incidents";
import { useTheme } from "../../theme/theme";

const TYPE_LABEL: Record<IncidentType, string> = {
  safety: "Seguridad",
  damage: "Daño material",
  delay: "Retraso",
  material: "Falta de material",
  other: "Otro",
};

const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

const SEVERITY_COLOR_KEY: Record<IncidentSeverity, "muted" | "warn" | "error"> = {
  low: "muted",
  medium: "warn",
  high: "error",
  critical: "error",
};

type FormState = { jobId: string; type: IncidentType; severity: IncidentSeverity; title: string; description: string };
const EMPTY_FORM: FormState = { jobId: "", type: "other", severity: "medium", title: "", description: "" };

export default function IncidentsScreen() {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [incidents, setIncidents] = useState<IncidentRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setIncidents(await fetchMyIncidents());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los incidentes.");
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleSubmit() {
    if (saving || !form.jobId.trim() || !form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createIncident({
        jobId: form.jobId.trim(),
        type: form.type,
        severity: form.severity,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo reportar el incidente.");
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

  if (showForm) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>ID del job</Text>
        <TextInput
          style={styles.input}
          value={form.jobId}
          onChangeText={(jobId) => setForm((current) => ({ ...current, jobId }))}
          placeholder="job_..."
          placeholderTextColor={theme.colors.faint}
        />

        <Text style={styles.label}>Tipo</Text>
        <View style={styles.chipRow}>
          {(Object.keys(TYPE_LABEL) as IncidentType[]).map((type) => (
            <Pressable
              key={type}
              onPress={() => setForm((current) => ({ ...current, type }))}
              style={[styles.chip, form.type === type && styles.chipSelected]}
            >
              <Text style={[styles.chipText, form.type === type && styles.chipTextSelected]}>{TYPE_LABEL[type]}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Severidad</Text>
        <View style={styles.chipRow}>
          {(Object.keys(SEVERITY_LABEL) as IncidentSeverity[]).map((severity) => (
            <Pressable
              key={severity}
              onPress={() => setForm((current) => ({ ...current, severity }))}
              style={[styles.chip, form.severity === severity && styles.chipSelected]}
            >
              <Text style={[styles.chipText, form.severity === severity && styles.chipTextSelected]}>
                {SEVERITY_LABEL[severity]}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Título</Text>
        <TextInput
          style={styles.input}
          value={form.title}
          onChangeText={(title) => setForm((current) => ({ ...current, title }))}
          placeholder="Resumen breve del incidente"
          placeholderTextColor={theme.colors.faint}
        />

        <Text style={styles.label}>Descripción (opcional)</Text>
        <TextInput
          style={styles.input}
          value={form.description}
          onChangeText={(description) => setForm((current) => ({ ...current, description }))}
          placeholder="Detalles..."
          placeholderTextColor={theme.colors.faint}
          multiline
        />

        <View style={styles.rowGap}>
          <Pressable
            style={[styles.button, (saving || !form.jobId.trim() || !form.title.trim()) && styles.buttonDisabled]}
            onPress={() => void handleSubmit()}
            disabled={saving || !form.jobId.trim() || !form.title.trim()}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Reportar incidente</Text>}
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => setShowForm(false)}>
            <Text style={styles.secondaryButtonText}>Cancelar</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={() => setShowForm(true)}>
        <Text style={styles.buttonText}>+ Reportar incidente</Text>
      </Pressable>

      {incidents.length === 0 ? (
        <Text style={styles.hint}>No has reportado incidentes.</Text>
      ) : (
        incidents.map((incident) => (
          <View key={incident.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle} numberOfLines={1}>{incident.title}</Text>
              <View style={[styles.badge, { backgroundColor: theme.colors[SEVERITY_COLOR_KEY[incident.severity as IncidentSeverity] ?? "muted"] + "22" }]}>
                <Text style={[styles.badgeText, { color: theme.colors[SEVERITY_COLOR_KEY[incident.severity as IncidentSeverity] ?? "muted"] }]}>
                  {SEVERITY_LABEL[incident.severity as IncidentSeverity] ?? incident.severity}
                </Text>
              </View>
            </View>
            <Text style={styles.cardMeta}>
              {TYPE_LABEL[incident.type as IncidentType] ?? incident.type} · {incident.status === "resolved" ? "Resuelto" : "Abierto"}
            </Text>
            {incident.description ? <Text style={styles.cardMeta}>{incident.description}</Text> : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: theme.spacing.lg, gap: theme.spacing.md },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    label: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase" },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: 12,
      fontSize: 14,
      color: theme.colors.ink,
      backgroundColor: theme.colors.surface,
    },
    hint: { fontSize: 12, color: theme.colors.muted, textAlign: "center", marginTop: theme.spacing.xl },
    error: { color: theme.colors.error, fontSize: 13 },
    rowGap: { flexDirection: "row", gap: 10, alignItems: "center" },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.border },
    chipSelected: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
    chipText: { fontSize: 12, fontWeight: "600", color: theme.colors.ink },
    chipTextSelected: { color: "#fff" },
    button: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, padding: 12, alignItems: "center" },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: "#fff", fontWeight: "700" },
    secondaryButton: { padding: 12, alignItems: "center" },
    secondaryButtonText: { color: theme.colors.muted, fontWeight: "700" },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 6,
    },
    cardTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.ink, flexShrink: 1 },
    cardMeta: { fontSize: 12, color: theme.colors.muted },
    badge: { borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: "700" },
  });
}
