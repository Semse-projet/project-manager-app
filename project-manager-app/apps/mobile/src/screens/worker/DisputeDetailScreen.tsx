import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { DisputeRecordView } from "@semse/schemas";
import { fetchDisputes, submitDisputeEvidence } from "../../api/disputes";
import { EvidenceCapture } from "../../components/EvidenceCapture";
import { useTheme } from "../../theme/theme";
import type { WorkerMoreStackParamList } from "../../navigation/types";
import { DISPUTE_STATUS_COLOR_KEY, DISPUTE_STATUS_LABEL } from "./jobStatus";

type Props = NativeStackScreenProps<WorkerMoreStackParamList, "DisputeDetail">;

const ACTIONABLE_STATUSES = ["OPEN", "ASSIGNED", "UNDER_REVIEW"];

export default function DisputeDetailScreen({ route }: Props) {
  const { disputeId } = route.params;
  const theme = useTheme();
  const styles = buildStyles(theme);

  const [dispute, setDispute] = useState<DisputeRecordView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingEvidenceIds, setPendingEvidenceIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await fetchDisputes();
      const found = all.find((d) => d.id === disputeId) ?? null;
      setDispute(found);
      if (!found) setError("No se encontró la disputa.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar la disputa.");
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleSendEvidence() {
    if (sending || pendingEvidenceIds.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const updated = await submitDisputeEvidence(disputeId, pendingEvidenceIds);
      setDispute(updated);
      setPendingEvidenceIds([]);
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo enviar la evidencia.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  if (!dispute) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? "Disputa no encontrada."}</Text>
      </View>
    );
  }

  const colorKey = DISPUTE_STATUS_COLOR_KEY[dispute.status] ?? "muted";
  const canSubmitEvidence = ACTIONABLE_STATUSES.includes(dispute.status);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.badge}>
        <Text style={[styles.badgeText, { color: theme.colors[colorKey] }]}>
          {DISPUTE_STATUS_LABEL[dispute.status] ?? dispute.status}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Motivo</Text>
      <Text style={styles.body}>{dispute.reason}</Text>

      {dispute.resolution ? (
        <>
          <Text style={styles.sectionLabel}>Resolución</Text>
          <Text style={styles.body}>{dispute.resolution}</Text>
        </>
      ) : null}

      {canSubmitEvidence ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Enviar evidencia</Text>
          <EvidenceCapture
            target={{ projectId: dispute.projectId }}
            onUploaded={(evidence) => setPendingEvidenceIds((current) => [...current, evidence.id])}
          />
          {pendingEvidenceIds.length > 0 ? (
            <Pressable
              style={[styles.button, sending && styles.buttonDisabled]}
              onPress={() => void handleSendEvidence()}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Adjuntar {pendingEvidenceIds.length} a la disputa</Text>
              )}
            </Pressable>
          ) : null}
          {sent ? <Text style={styles.hint}>✅ Evidencia adjuntada.</Text> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: theme.spacing.lg, gap: theme.spacing.sm },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: theme.spacing.lg },
    error: { color: theme.colors.error, fontSize: 13 },
    hint: { fontSize: 13, color: theme.colors.muted },
    badge: { alignSelf: "flex-start", backgroundColor: theme.colors.raised, borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: "700" },
    sectionLabel: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase", marginTop: theme.spacing.sm },
    body: { fontSize: 14, color: theme.colors.ink, lineHeight: 20 },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    cardTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.ink },
    button: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, padding: 12, alignItems: "center" },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: "#fff", fontWeight: "700" },
  });
}
