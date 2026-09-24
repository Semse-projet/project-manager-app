import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import type { JobRecordView } from "@semse/schemas";
import { fetchJobsList } from "../../api/jobs";
import { navigationRef } from "../../navigation/navigationRef";
import { useTheme } from "../../theme/theme";
import { formatCurrency } from "../../utils/format";
import type { WorkerJobsStackParamList } from "../../navigation/types";
import { BIDDABLE_JOB_STATUSES, JOB_STATUS_COLOR_KEY, JOB_STATUS_LABEL, JOB_TAB_BUCKETS, WORKER_JOB_NEXT_ACTION } from "./jobStatus";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";

type Props = NativeStackScreenProps<WorkerJobsStackParamList, "JobsList">;

type Tab = "todos" | "activos" | "completados" | "oportunidades";

const TABS: { id: Tab; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "activos", label: "Activos" },
  { id: "completados", label: "Completados" },
  { id: "oportunidades", label: "Oportunidades" },
];

function matchesTab(job: JobRecordView, tab: Tab): boolean {
  if (tab === "activos") return JOB_TAB_BUCKETS.active.includes(job.status);
  if (tab === "completados") return JOB_TAB_BUCKETS.completed.includes(job.status);
  if (tab === "oportunidades") return BIDDABLE_JOB_STATUSES.includes(job.status);
  return true;
}

export default function JobsListScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [jobs, setJobs] = useState<JobRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("todos");
  const [query, setQuery] = useState("");

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

  const disputeCount = useMemo(() => jobs.filter((job) => job.status === "dispute").length, [jobs]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (!matchesTab(job, tab)) return false;
      if (!normalizedQuery) return true;
      return (
        job.title.toLowerCase().includes(normalizedQuery) ||
        (job.category ?? "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [jobs, tab, query]);

  function openDisputes() {
    if (!navigationRef.isReady()) return;
    (navigationRef.navigate as (...args: unknown[]) => void)("More", { screen: "Disputes" });
  }

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
      data={filtered}
      keyExtractor={(job) => job.id}
      onRefresh={() => void load(true)}
      refreshing={refreshing}
      ListHeaderComponent={
        <View style={styles.header}>
          {error ? <ErrorState message={error} /> : null}

          {disputeCount > 0 ? (
            <Pressable style={styles.disputeBanner} onPress={openDisputes}>
              <Ionicons name="warning-outline" size={16} color={theme.colors.error} />
              <Text style={styles.disputeBannerText} numberOfLines={2}>
                {disputeCount} job{disputeCount > 1 ? "s" : ""} con disputa activa — Aporta evidencia
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.error} />
            </Pressable>
          ) : null}

          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={theme.colors.muted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar jobs..."
              placeholderTextColor={theme.colors.muted}
              value={query}
              onChangeText={setQuery}
            />
          </View>

          <View style={styles.tabRow}>
            {TABS.map((filter) => {
              const active = tab === filter.id;
              return (
                <Pressable
                  key={filter.id}
                  onPress={() => setTab(filter.id)}
                  style={[styles.tabChip, active && styles.tabChipActive]}
                >
                  <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{filter.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title={jobs.length === 0 ? "No hay jobs disponibles todavía." : "Sin resultados para este filtro."}
        />
      }
      renderItem={({ item }) => {
        const colorKey = JOB_STATUS_COLOR_KEY[item.status];
        const badgeColor = theme.colors[colorKey];
        const nextAction = WORKER_JOB_NEXT_ACTION[item.status];

        return (
          <Pressable style={styles.card} onPress={() => navigation.navigate("JobDetail", { jobId: item.id })}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <View style={[styles.badge, { backgroundColor: badgeColor + "22" }]}>
                <Text style={[styles.badgeText, { color: badgeColor }]}>{JOB_STATUS_LABEL[item.status] ?? item.status}</Text>
              </View>
            </View>

            {item.location ? (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={13} color={theme.colors.muted} />
                <Text style={styles.cardHint}>{item.location}</Text>
              </View>
            ) : null}

            {item.budgetMin || item.budgetMax ? (
              <View style={styles.metaRow}>
                <Ionicons name="cash-outline" size={13} color={theme.colors.brand} />
                <Text style={styles.cardBudget}>
                  {item.budgetMin ? formatCurrency(item.budgetMin) : ""}
                  {item.budgetMin && item.budgetMax ? " – " : ""}
                  {item.budgetMax ? formatCurrency(item.budgetMax) : ""}
                </Text>
              </View>
            ) : null}

            {nextAction ? (
              <Text style={[styles.nextAction, { color: item.status === "dispute" ? theme.colors.error : theme.colors.warn }]}>
                ▶ {nextAction}
              </Text>
            ) : null}
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
    header: { gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
    error: { color: theme.colors.error, fontSize: 13 },
    hint: { fontSize: 13, color: theme.colors.muted, textAlign: "center", marginTop: theme.spacing.xl },
    disputeBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.error,
      backgroundColor: theme.colors.error + "15",
      borderRadius: theme.radius.md,
      padding: theme.spacing.sm,
    },
    disputeBannerText: { flex: 1, fontSize: 12, fontWeight: "700", color: theme.colors.error },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    searchIcon: {},
    searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: theme.colors.ink },
    tabRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
    tabChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tabChipActive: { borderColor: theme.colors.brand, backgroundColor: theme.colors.brandDim },
    tabChipText: { fontSize: 12, fontWeight: "600", color: theme.colors.muted },
    tabChipTextActive: { color: theme.colors.brand },
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
    metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    cardTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.ink, flexShrink: 1 },
    cardHint: { fontSize: 12, color: theme.colors.muted },
    cardBudget: { fontSize: 13, fontWeight: "700", color: theme.colors.brand },
    nextAction: { fontSize: 12, fontWeight: "700", marginTop: 4 },
    badge: { borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: "700" },
  });
}
