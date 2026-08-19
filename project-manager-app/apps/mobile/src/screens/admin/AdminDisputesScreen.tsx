import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { DisputeRecordView } from "@semse/schemas";
import { fetchDisputes } from "../../api/disputes";
import { useTheme } from "../../theme/theme";
import type { AdminDisputesStackParamList } from "../../navigation/types";
import { DISPUTE_STATUS_COLOR_KEY, DISPUTE_STATUS_LABEL } from "../worker/jobStatus";

type Props = NativeStackScreenProps<AdminDisputesStackParamList, "DisputesList">;

/**
 * Read-only, tenant-wide: GET /v1/disputes already scopes OPS_ADMIN to every
 * org in the tenant server-side (disputes.repository.ts buildOwnershipWhere),
 * unlike CLIENT/PRO which only see their own org. No assign/resolve/archive
 * actions here -- those mutate a dispute's outcome and need their own spec.
 */
export default function AdminDisputesScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [disputes, setDisputes] = useState<DisputeRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      {disputes.length === 0 ? (
        <Text style={styles.hint}>Sin disputas en el tenant.</Text>
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
    error: { color: theme.colors.error, fontSize: 13 },
    hint: { fontSize: 13, color: theme.colors.muted, textAlign: "center", marginTop: theme.spacing.xl },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
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
