import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { PaymentTxnRecordView } from "@semse/schemas";
import { fetchMyBids } from "../../api/bids";
import { fetchJobPayments } from "../../api/payments";
import { useTheme } from "../../theme/theme";
import { formatCurrency } from "../../utils/format";

type PaymentRow = PaymentTxnRecordView & { jobTitle?: string };

const STATUS_COLOR_KEY: Record<string, "ok" | "warn" | "error"> = {
  SUCCEEDED: "ok",
  PENDING: "warn",
  FAILED: "error",
};

/** No single "my payments" endpoint exists — fetch per job (from accepted bids) and flatten, same convention as apps/web's worker/payments page. */
export default function PaymentsScreen() {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const bids = await fetchMyBids();
      const myJobs = bids.filter((bid) => bid.status === "accepted");
      const perJob = await Promise.all(
        myJobs.map(async (bid) => {
          const txns = await fetchJobPayments(bid.jobId).catch(() => []);
          return txns.map((txn) => ({ ...txn, jobTitle: bid.jobTitle }));
        }),
      );
      const flattened = perJob.flat().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      setRows(flattened);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los pagos.");
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
    <FlatList
      contentContainerStyle={styles.container}
      data={rows}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      ListEmptyComponent={<Text style={styles.hint}>No tienes movimientos de pago todavía.</Text>}
      onRefresh={() => void load(true)}
      refreshing={refreshing}
      renderItem={({ item }) => {
        const colorKey = STATUS_COLOR_KEY[item.status] ?? "warn";
        return (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.jobTitle ?? "Job"}</Text>
              <View style={[styles.badge, { backgroundColor: theme.colors[colorKey] + "22" }]}>
                <Text style={[styles.badgeText, { color: theme.colors[colorKey] }]}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.cardMeta}>{item.type} · {formatCurrency(item.amount)}</Text>
          </View>
        );
      }}
    />
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: theme.spacing.lg, gap: theme.spacing.md },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    error: { color: theme.colors.error, fontSize: 13, marginBottom: theme.spacing.sm },
    hint: { fontSize: 13, color: theme.colors.muted, textAlign: "center", marginTop: theme.spacing.xl },
    card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border, gap: 6, marginBottom: theme.spacing.md },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
    cardTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.ink, flexShrink: 1 },
    cardMeta: { fontSize: 12, color: theme.colors.muted },
    badge: { borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: "700" },
  });
}
