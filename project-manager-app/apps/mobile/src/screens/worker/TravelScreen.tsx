import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { TravelAssignmentSummaryView } from "@semse/schemas";
import { fetchMyTravelAssignments } from "../../api/travel";
import { useTheme } from "../../theme/theme";
import { formatCurrency } from "../../utils/format";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import type { WorkerMoreStackParamList } from "../../navigation/types";
import { TRAVEL_STATUS_LABEL } from "./jobStatus";

type Props = NativeStackScreenProps<WorkerMoreStackParamList, "Travel">;

export default function TravelScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [assignments, setAssignments] = useState<TravelAssignmentSummaryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setAssignments(await fetchMyTravelAssignments());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los viajes.");
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
      data={assignments}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={error ? <ErrorState message={error} /> : null}
      ListEmptyComponent={<EmptyState title="No tienes asignaciones de viaje." />}
      onRefresh={() => void load(true)}
      refreshing={refreshing}
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => navigation.navigate("TravelDetail", { travelId: item.id })}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.destinationCity}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{TRAVEL_STATUS_LABEL[item.status] ?? item.status}</Text>
            </View>
          </View>
          <Text style={styles.cardMeta}>
            {item.departureDate}{item.returnDate ? ` – ${item.returnDate}` : ""}
          </Text>
          {item.totalSpent != null ? (
            <Text style={styles.cardMeta}>
              Gastado: {formatCurrency(item.totalSpent)}
              {item.expectedBalance != null ? ` · Balance: ${formatCurrency(item.expectedBalance)}` : ""}
            </Text>
          ) : null}
          {item.missingReceipts > 0 ? (
            <Text style={styles.warnText}>⚠ {item.missingReceipts} recibo(s) pendiente(s)</Text>
          ) : null}
        </Pressable>
      )}
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
    cardMeta: { fontSize: 12, color: theme.colors.muted },
    warnText: { fontSize: 12, color: theme.colors.warn, fontWeight: "600" },
    badge: { backgroundColor: theme.colors.brandDim, borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: "700", color: theme.colors.brand },
  });
}
