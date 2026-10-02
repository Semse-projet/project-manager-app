import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import type { JobRecordView } from "@semse/schemas";
import { fetchJobsList } from "../../api/jobs";
import { useTheme } from "../../theme/theme";
import { formatCurrency } from "../../utils/format";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import type { ClientJobsStackParamList } from "../../navigation/types";
import { CLIENT_JOB_TAB_BUCKETS, CLIENT_JOB_TAB_HEADER_COPY, JOB_STATUS_COLOR_KEY, JOB_STATUS_LABEL } from "../worker/jobStatus";

type Props = NativeStackScreenProps<ClientJobsStackParamList, "JobsList">;

type Tab = "todos" | keyof typeof CLIENT_JOB_TAB_BUCKETS;

const TABS: { id: Tab; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "draft", label: "Borradores" },
  { id: "active", label: "Activos" },
  { id: "pending", label: "Esperando propuestas" },
  { id: "review", label: "En revisión" },
  { id: "completed", label: "Completados" },
];

function matchesTab(job: JobRecordView, tab: Tab): boolean {
  if (tab === "todos") return true;
  return CLIENT_JOB_TAB_BUCKETS[tab].includes(job.status);
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

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (!matchesTab(job, tab)) return false;
      if (!normalizedQuery) return true;
      return job.title.toLowerCase().includes(normalizedQuery);
    });
  }, [jobs, tab, query]);

  const headerCopy = tab === "todos" ? null : CLIENT_JOB_TAB_HEADER_COPY[tab];

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

          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={theme.colors.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar trabajo..."
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

          {headerCopy ? (
            <View style={styles.tabHeaderBanner}>
              <Text style={styles.tabHeaderTitle}>{headerCopy.title}</Text>
              <Text style={styles.tabHeaderDetail}>{headerCopy.detail}</Text>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title={jobs.length === 0 ? "Aún no tienes jobs publicados." : "Sin resultados para este filtro."}
        />
      }
      renderItem={({ item }) => {
        const badgeColor = theme.colors[JOB_STATUS_COLOR_KEY[item.status]];
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
    tabHeaderBanner: {
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.brandDim,
      padding: theme.spacing.md,
      gap: 2,
    },
    tabHeaderTitle: { fontSize: 13, fontWeight: "700", color: theme.colors.brand },
    tabHeaderDetail: { fontSize: 12, color: theme.colors.muted },
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
    badge: { borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: "700" },
  });
}
