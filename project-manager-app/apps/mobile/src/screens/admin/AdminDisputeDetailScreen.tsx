import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { DisputeRecordView } from "@semse/schemas";
import { fetchDisputes } from "../../api/disputes";
import { useTheme } from "../../theme/theme";
import type { AdminDisputesStackParamList } from "../../navigation/types";
import { DISPUTE_STATUS_COLOR_KEY, DISPUTE_STATUS_LABEL } from "../worker/jobStatus";

type Props = NativeStackScreenProps<AdminDisputesStackParamList, "DisputeDetail">;

/** Read-only -- no assign/resolve/evidence actions, see mobile-admin-disputes.spec.md §2. */
export default function AdminDisputeDetailScreen({ route }: Props) {
  const { disputeId } = route.params;
  const theme = useTheme();
  const styles = buildStyles(theme);

  const [dispute, setDispute] = useState<DisputeRecordView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={[styles.badge, { backgroundColor: theme.colors[colorKey] + "22" }]}>
        <Text style={[styles.badgeText, { color: theme.colors[colorKey] }]}>
          {DISPUTE_STATUS_LABEL[dispute.status] ?? dispute.status}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Motivo</Text>
      <Text style={styles.body}>{dispute.reason}</Text>

      {dispute.assigneeUserId ? (
        <>
          <Text style={styles.sectionLabel}>Asignada a</Text>
          <Text style={styles.body}>{dispute.assigneeUserId}</Text>
        </>
      ) : null}

      {dispute.resolution ? (
        <>
          <Text style={styles.sectionLabel}>Resolución</Text>
          <Text style={styles.body}>{dispute.resolution}</Text>
          {dispute.resolutionType ? (
            <Text style={styles.hint}>Tipo: {dispute.resolutionType}</Text>
          ) : null}
        </>
      ) : null}

      {dispute.evidenceBundleIds.length > 0 ? (
        <Text style={styles.hint}>
          {dispute.evidenceBundleIds.length} bundle(s) de evidencia adjuntos (ver desde web para revisar archivos).
        </Text>
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
    badge: { alignSelf: "flex-start", borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: "700" },
    sectionLabel: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase", marginTop: theme.spacing.sm },
    body: { fontSize: 14, color: theme.colors.ink, lineHeight: 20 },
  });
}
