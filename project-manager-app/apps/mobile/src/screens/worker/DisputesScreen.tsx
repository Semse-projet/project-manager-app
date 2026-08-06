import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { DisputeRecordView } from "@semse/schemas";
import { createDispute, fetchDisputes } from "../../api/disputes";
import { useTheme } from "../../theme/theme";
import type { WorkerMoreStackParamList } from "../../navigation/types";
import { DISPUTE_STATUS_COLOR_KEY, DISPUTE_STATUS_LABEL } from "./jobStatus";

type Props = NativeStackScreenProps<WorkerMoreStackParamList, "Disputes">;

export default function DisputesScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [disputes, setDisputes] = useState<DisputeRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [jobId, setJobId] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setDisputes(await fetchDisputes());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar las disputas.");
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
    if (saving || !jobId.trim() || reason.trim().length < 5) return;
    setSaving(true);
    setError(null);
    try {
      await createDispute({ jobId: jobId.trim(), reason: reason.trim() });
      setJobId("");
      setReason("");
      setShowForm(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear la disputa.");
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
          value={jobId}
          onChangeText={setJobId}
          placeholder="job_..."
          placeholderTextColor={theme.colors.faint}
        />

        <Text style={styles.label}>Motivo</Text>
        <TextInput
          style={styles.input}
          value={reason}
          onChangeText={setReason}
          placeholder="Describe el problema (mínimo 5 caracteres)"
          placeholderTextColor={theme.colors.faint}
          multiline
        />

        <View style={styles.rowGap}>
          <Pressable
            style={[styles.button, (saving || !jobId.trim() || reason.trim().length < 5) && styles.buttonDisabled]}
            onPress={() => void handleSubmit()}
            disabled={saving || !jobId.trim() || reason.trim().length < 5}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Abrir disputa</Text>}
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
        <Text style={styles.buttonText}>+ Abrir disputa</Text>
      </Pressable>

      {disputes.length === 0 ? (
        <Text style={styles.hint}>No tienes disputas.</Text>
      ) : (
        disputes.map((dispute) => {
          const colorKey = DISPUTE_STATUS_COLOR_KEY[dispute.status] ?? "muted";
          return (
            <Pressable
              key={dispute.id}
              style={styles.card}
              onPress={() => navigation.navigate("DisputeDetail", { disputeId: dispute.id })}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle} numberOfLines={2}>{dispute.reason}</Text>
                <View style={[styles.badge, { backgroundColor: theme.colors[colorKey] + "22" }]}>
                  <Text style={[styles.badgeText, { color: theme.colors[colorKey] }]}>
                    {DISPUTE_STATUS_LABEL[dispute.status] ?? dispute.status}
                  </Text>
                </View>
              </View>
            </Pressable>
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
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: 12,
      fontSize: 14,
      color: theme.colors.ink,
      backgroundColor: theme.colors.surface,
    },
    hint: { fontSize: 13, color: theme.colors.muted, textAlign: "center", marginTop: theme.spacing.xl },
    error: { color: theme.colors.error, fontSize: 13 },
    rowGap: { flexDirection: "row", gap: 10, alignItems: "center" },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
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
    cardTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.ink, flex: 1 },
    badge: { borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: "700" },
  });
}
