import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { JobRecordView } from "@semse/schemas";
import { fetchJobsList } from "../../api/jobs";
import { useTheme } from "../../theme/theme";
import { formatCurrency } from "../../utils/format";
import type { WorkerJobsStackParamList } from "../../navigation/types";
import { BIDDABLE_JOB_STATUSES, JOB_STATUS_LABEL } from "./jobStatus";

type Props = NativeStackScreenProps<WorkerJobsStackParamList, "JobsList">;

type Section = { title: string; data: JobRecordView[] };

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
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los jobs.");
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

  // Split so "can still act on this" jobs surface first — a flat list mixing
  // open opportunities with the worker's own in-progress/completed jobs made
  // it hard to tell what's actually actionable as the list grows.
  const sections = useMemo<Section[]>(() => {
    const biddable = jobs.filter((job) => BIDDABLE_JOB_STATUSES.includes(job.status));
    const other = jobs.filter((job) => !BIDDABLE_JOB_STATUSES.includes(job.status));
    const result: Section[] = [];
    if (biddable.length > 0) result.push({ title: "Disponibles para propuesta", data: biddable });
    if (other.length > 0) result.push({ title: "Otros", data: other });
    return result;
  }, [jobs]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  return (
    <SectionList
      contentContainerStyle={styles.container}
      sections={sections}
      keyExtractor={(job) => job.id}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      ListEmptyComponent={<Text style={styles.hint}>No hay jobs disponibles todavía.</Text>}
      onRefresh={() => void load(true)}
      refreshing={refreshing}
      renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
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
    sectionHeader: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.muted,
      textTransform: "uppercase",
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
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
