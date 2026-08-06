import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { JobRecordView } from "@semse/schemas";
import { fetchJobsList } from "../../api/jobs";
import { useTheme } from "../../theme/theme";
import { formatCurrency } from "../../utils/format";
import type { ClientJobsStackParamList } from "../../navigation/types";
import { JOB_STATUS_LABEL } from "../worker/jobStatus";

type Props = NativeStackScreenProps<ClientJobsStackParamList, "JobsList">;

export default function JobsListScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [jobs, setJobs] = useState<JobRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setJobs(await fetchJobsList());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar tus jobs.");
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
      data={jobs}
      keyExtractor={(job) => job.id}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      ListEmptyComponent={<Text style={styles.hint}>Aún no tienes jobs publicados.</Text>}
      onRefresh={() => void load(true)}
      refreshing={refreshing}
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => navigation.navigate("JobDetail", { jobId: item.id })}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{JOB_STATUS_LABEL[item.status] ?? item.status}</Text>
            </View>
          </View>
          {item.location ? <Text style={styles.cardHint}>{item.location}</Text> : null}
          {item.budgetMin || item.budgetMax ? (
            <Text style={styles.cardBudget}>
              {item.budgetMin ? formatCurrency(item.budgetMin) : ""}
              {item.budgetMin && item.budgetMax ? " – " : ""}
              {item.budgetMax ? formatCurrency(item.budgetMax) : ""}
            </Text>
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
    cardHint: { fontSize: 12, color: theme.colors.muted },
    cardBudget: { fontSize: 13, fontWeight: "700", color: theme.colors.brand },
    badge: { backgroundColor: theme.colors.brandDim, borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: "700", color: theme.colors.brand },
  });
}
