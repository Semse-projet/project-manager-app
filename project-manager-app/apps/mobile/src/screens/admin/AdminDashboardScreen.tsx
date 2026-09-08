import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { JobRecordView } from "@semse/schemas";
import { fetchJobsList } from "../../api/jobs";
import { useTheme } from "../../theme/theme";
import { formatCurrency } from "../../utils/format";

const ACTIVE_STATUSES = ["in_progress", "reserved", "accepted", "review"];

/**
 * Mirrors apps/web's admin/dashboard page: a single GET /v1/jobs call,
 * everything else (stat cards, dispute alerts) derived client-side. Not the
 * richer mission-control dashboard — that surface is AI/agent-ops territory,
 * explicitly out of scope for the business-ops admin role built here.
 */
export default function AdminDashboardScreen() {
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
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el dashboard.");
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

  const stats = useMemo(() => {
    const active = jobs.filter((j) => ACTIVE_STATUSES.includes(j.status));
    const disputes = jobs.filter((j) => j.status === "dispute");
    const completed = jobs.filter((j) => j.status === "completed");
    const activeBudget = active.reduce((sum, j) => sum + (j.budgetMin ?? 0), 0);
    return {
      active: active.length,
      disputes,
      completed: completed.length,
      total: jobs.length,
      activeBudget,
    };
  }, [jobs]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load(true)}
          tintColor={theme.colors.brand}
        />
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.grid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.active}</Text>
          <Text style={styles.statLabel}>Trabajos activos</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.colors.error }]}>{stats.disputes.length}</Text>
          <Text style={styles.statLabel}>En disputa</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.colors.ok }]}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completados</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total de trabajos</Text>
        </View>
      </View>

      <View style={styles.budgetCard}>
        <Text style={styles.budgetLabel}>Presupuesto activo</Text>
        <Text style={styles.budgetValue}>{formatCurrency(stats.activeBudget)}</Text>
      </View>

      <Text style={styles.sectionLabel}>Alertas</Text>
      {stats.disputes.length === 0 ? (
        <Text style={styles.hint}>Sin alertas activas.</Text>
      ) : (
        stats.disputes.slice(0, 4).map((job) => (
          <View key={job.id} style={styles.alertCard}>
            <Text style={styles.alertText}>⚠ Disputa activa: {job.title}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: theme.spacing.lg, gap: theme.spacing.md },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    error: { color: theme.colors.error, fontSize: 13 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
    statCard: {
      width: "47%",
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 4,
    },
    statValue: { fontSize: 26, fontWeight: "800", color: theme.colors.ink },
    statLabel: { fontSize: 12, color: theme.colors.muted },
    budgetCard: {
      backgroundColor: theme.colors.brandDim,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      gap: 4,
    },
    budgetLabel: { fontSize: 12, fontWeight: "700", color: theme.colors.brand, textTransform: "uppercase" },
    budgetValue: { fontSize: 22, fontWeight: "800", color: theme.colors.brand },
    sectionLabel: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase", marginTop: theme.spacing.sm },
    hint: { fontSize: 13, color: theme.colors.muted },
    alertCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    alertText: { fontSize: 13, color: theme.colors.error, fontWeight: "600" },
  });
}
