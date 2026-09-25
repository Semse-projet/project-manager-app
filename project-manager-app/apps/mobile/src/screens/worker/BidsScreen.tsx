import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { BidRecordView } from "@semse/schemas";
import { fetchMyBids } from "../../api/bids";
import { useTheme } from "../../theme/theme";
import { formatCurrency } from "../../utils/format";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import type { WorkerTabParamList } from "../../navigation/types";
import { BID_STATUS_COLOR_KEY, BID_STATUS_LABEL } from "./jobStatus";

type Props = BottomTabScreenProps<WorkerTabParamList, "Bids">;

export default function BidsScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [bids, setBids] = useState<BidRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setBids(await fetchMyBids());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar tus propuestas.");
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
      data={bids}
      keyExtractor={(bid) => bid.id}
      ListHeaderComponent={error ? <ErrorState message={error} /> : null}
      ListEmptyComponent={<EmptyState title="Aún no has enviado propuestas." />}
      onRefresh={() => void load(true)}
      refreshing={refreshing}
      renderItem={({ item }) => {
        const colorKey = BID_STATUS_COLOR_KEY[item.status] ?? "brand";
        return (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate("Jobs", { screen: "JobDetail", params: { jobId: item.jobId } })}
          >
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.jobTitle ?? "Job"}</Text>
              <View style={[styles.badge, { backgroundColor: theme.colors[colorKey] + "22" }]}>
                <Text style={[styles.badgeText, { color: theme.colors[colorKey] }]}>
                  {BID_STATUS_LABEL[item.status] ?? item.status}
                </Text>
              </View>
            </View>
            <Text style={styles.cardMeta}>{formatCurrency(item.amount)} · {item.etaDays} días</Text>
            {item.note ? <Text style={styles.cardNote}>{item.note}</Text> : null}
          </Pressable>
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
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 6,
      marginBottom: theme.spacing.md,
    },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
    cardTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.ink, flexShrink: 1 },
    cardMeta: { fontSize: 13, color: theme.colors.muted },
    cardNote: { fontSize: 12, color: theme.colors.faint, fontStyle: "italic" },
    badge: { borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: "700" },
  });
}
