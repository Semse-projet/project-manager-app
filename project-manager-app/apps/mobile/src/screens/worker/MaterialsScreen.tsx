import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { MaterialRequestRecordView } from "@semse/schemas";
import { createMaterialRequest, fetchMyMaterialRequests } from "../../api/materials";
import { useTheme } from "../../theme/theme";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { formatCurrency } from "../../utils/format";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  delivered: "Entregado",
  rejected: "Rechazado",
};

const STATUS_COLOR_KEY: Record<string, "warn" | "ok" | "brand" | "error"> = {
  pending: "warn",
  approved: "brand",
  delivered: "ok",
  rejected: "error",
};

type FormState = { jobId: string; item: string; quantity: string; unit: string; estimatedCost: string; notes: string };
const EMPTY_FORM: FormState = { jobId: "", item: "", quantity: "", unit: "", estimatedCost: "", notes: "" };

export default function MaterialsScreen() {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [requests, setRequests] = useState<MaterialRequestRecordView[]>([]);
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
      setRequests(await fetchMyMaterialRequests());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los materiales.");
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

  const canSubmit = form.jobId.trim() && form.item.trim() && form.quantity.trim() && form.unit.trim();

  async function handleSubmit() {
    const quantity = Number(form.quantity);
    if (saving || !canSubmit || !Number.isFinite(quantity) || quantity <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const estimatedCost = form.estimatedCost.trim() ? Number(form.estimatedCost) : undefined;
      await createMaterialRequest({
        jobId: form.jobId.trim(),
        item: form.item.trim(),
        quantity,
        unit: form.unit.trim(),
        estimatedCost: Number.isFinite(estimatedCost) ? estimatedCost : undefined,
        notes: form.notes.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo enviar la solicitud.");
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
        {error ? <ErrorState message={error} /> : null}

        <Text style={styles.label}>ID del job</Text>
        <TextInput style={styles.input} value={form.jobId} onChangeText={(jobId) => setForm((c) => ({ ...c, jobId }))} placeholder="job_..." placeholderTextColor={theme.colors.faint} />

        <Text style={styles.label}>Material</Text>
        <TextInput style={styles.input} value={form.item} onChangeText={(item) => setForm((c) => ({ ...c, item }))} placeholder="Ej. Cemento" placeholderTextColor={theme.colors.faint} />

        <View style={styles.rowGap}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Cantidad</Text>
            <TextInput style={styles.input} value={form.quantity} onChangeText={(quantity) => setForm((c) => ({ ...c, quantity }))} placeholder="0" placeholderTextColor={theme.colors.faint} keyboardType="decimal-pad" />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Unidad</Text>
            <TextInput style={styles.input} value={form.unit} onChangeText={(unit) => setForm((c) => ({ ...c, unit }))} placeholder="bultos, m2..." placeholderTextColor={theme.colors.faint} />
          </View>
        </View>

        <Text style={styles.label}>Costo estimado (opcional)</Text>
        <TextInput style={styles.input} value={form.estimatedCost} onChangeText={(estimatedCost) => setForm((c) => ({ ...c, estimatedCost }))} placeholder="0" placeholderTextColor={theme.colors.faint} keyboardType="decimal-pad" />

        <Text style={styles.label}>Notas (opcional)</Text>
        <TextInput style={styles.input} value={form.notes} onChangeText={(notes) => setForm((c) => ({ ...c, notes }))} placeholder="Detalles..." placeholderTextColor={theme.colors.faint} multiline />

        <View style={styles.rowGap}>
          <Pressable style={[styles.button, (saving || !canSubmit) && styles.buttonDisabled]} onPress={() => void handleSubmit()} disabled={saving || !canSubmit}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Enviar solicitud</Text>}
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
      {error ? <ErrorState message={error} /> : null}

      <Pressable style={styles.button} onPress={() => setShowForm(true)}>
        <Text style={styles.buttonText}>+ Solicitar material</Text>
      </Pressable>

      {requests.length === 0 ? (
        <EmptyState title="No has solicitado materiales." />
      ) : (
        requests.map((req) => {
          const colorKey = STATUS_COLOR_KEY[req.status] ?? "brand";
          return (
            <View key={req.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle} numberOfLines={1}>{req.item}</Text>
                <View style={[styles.badge, { backgroundColor: theme.colors[colorKey] + "22" }]}>
                  <Text style={[styles.badgeText, { color: theme.colors[colorKey] }]}>{STATUS_LABEL[req.status] ?? req.status}</Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>
                {req.quantity} {req.unit}
                {req.estimatedCost != null ? ` · ${formatCurrency(req.estimatedCost)}` : ""}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: theme.spacing.lg, gap: theme.spacing.md },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    label: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase" },
    input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12, fontSize: 14, color: theme.colors.ink, backgroundColor: theme.colors.surface },
    hint: { fontSize: 13, color: theme.colors.muted, textAlign: "center", marginTop: theme.spacing.xl },
    error: { color: theme.colors.error, fontSize: 13 },
    rowGap: { flexDirection: "row", gap: 10, alignItems: "center" },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
    flex1: { flex: 1 },
    button: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, padding: 12, alignItems: "center" },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: "#fff", fontWeight: "700" },
    secondaryButton: { padding: 12, alignItems: "center" },
    secondaryButtonText: { color: theme.colors.muted, fontWeight: "700" },
    card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border, gap: 6 },
    cardTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.ink, flexShrink: 1 },
    cardMeta: { fontSize: 12, color: theme.colors.muted },
    badge: { borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: "700" },
  });
}
