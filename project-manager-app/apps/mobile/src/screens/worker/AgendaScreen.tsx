import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { JobRecordView } from "@semse/schemas";
import { fetchJobsList } from "../../api/jobs";
import { useTheme } from "../../theme/theme";
import type { WorkerMoreStackParamList } from "../../navigation/types";
import { JOB_STATUS_LABEL } from "./jobStatus";

type Props = NativeStackScreenProps<WorkerMoreStackParamList, "Agenda">;

const ACTIVE_STATUSES = ["accepted", "in_progress", "reserved", "review"];

/**
 * No dedicated agenda/calendar endpoint exists on the backend — mirrors
 * apps/web's worker/agenda page, which reuses the plain jobs list and uses
 * createdAt as a stand-in for a real scheduled date (there is no scheduled-date
 * field on Job yet). Grouped by month here since there's no true calendar data.
 */
export default function AgendaScreen({ navigation }: Props) {
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
      const all = await fetchJobsList();
      setJobs(all.filter((job) => ACTIVE_STATUSES.includes(job.status)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar tu agenda.");
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

  const sections = useMemo(() => {
    const byMonth = new Map<string, JobRecordView[]>();
    for (const job of jobs) {
      const jobWithCreatedAt = job as JobRecordView & { createdAt?: string };
      const date = jobWithCreatedAt.createdAt ? new Date(jobWithCreatedAt.createdAt) : new Date();
      const key = date.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
      const list = byMonth.get(key) ?? [];
      list.push(job);
      byMonth.set(key, list);
    }
    return Array.from(byMonth.entries()).map(([title, data]) => ({ title, data }));
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
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      ListEmptyComponent={<Text style={styles.hint}>No tienes jobs activos en tu agenda.</Text>}
      onRefresh={() => void load(true)}
      refreshing={refreshing}
      renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => navigation.getParent()?.navigate("Jobs", { screen: "JobDetail", params: { jobId: item.id } })}
        >
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{JOB_STATUS_LABEL[item.status] ?? item.status}</Text>
            </View>
          </View>
          {item.location ? <Text style={styles.cardMeta}>{item.location}</Text> : null}
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
    sectionHeader: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "capitalize", marginTop: theme.spacing.sm, marginBottom: theme.spacing.sm },
    card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border, gap: 6, marginBottom: theme.spacing.md },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
    cardTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.ink, flexShrink: 1 },
    cardMeta: { fontSize: 12, color: theme.colors.muted },
    badge: { backgroundColor: theme.colors.brandDim, borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: "700", color: theme.colors.brand },
  });
}
