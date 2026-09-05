import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { TrustOverview, TrustOverviewItem } from "@semse/schemas";
import { fetchTrustOverview } from "../../api/trust";
import { useTheme } from "../../theme/theme";

type Level = TrustOverviewItem["level"];

const LEVEL_LABEL: Record<Level, string> = {
  low: "Bajo",
  medium: "Medio",
  high: "Alto",
};

const LEVEL_COLOR_KEY: Record<Level, "ok" | "warn" | "error"> = {
  low: "ok",
  medium: "warn",
  high: "error",
};

/**
 * GET /v1/ops/trust-overview, OPS_ADMIN only (ops:risk:read) -- tenant-wide
 * (scoped by tenantId only, same as Disputes -- verified in
 * ops.repository.ts's listRecentJobsWithProject), read-only. No trust
 * passport detail here (apps/web's expandable "Pasaporte" card is a
 * separate read surface, same reasoning as skipping evidence rendering in
 * Fase 7b) and no mutation anywhere in this slice.
 *
 * Built against @semse/schemas's real trustOverviewSchema, not apps/web's
 * Trust page: that page reads a nonexistent `data.entries` (the API
 * returns `items`), filters for a `"critical"` level the schema never
 * produces (only low/medium/high), and checks `scopeType === "user"` when
 * scopeType is only ever `"job"` or `"project"` -- so its passport button
 * never renders and its data table never populates. None of that is
 * replicated here.
 */
export default function AdminTrustScreen() {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [overview, setOverview] = useState<TrustOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<Level | "">("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setOverview(await fetchTrustOverview());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los trust scores.");
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

  const items = overview?.items ?? [];
  const filtered = levelFilter ? items.filter((i) => i.level === levelFilter) : items;

  const statCards = useMemo(() => {
    if (!overview) return [];
    return [
      { label: "Total", value: overview.total },
      { label: "Alto riesgo", value: overview.highRisk },
      { label: "Riesgo medio", value: overview.mediumRisk },
      { label: "Bajo riesgo", value: overview.lowRisk },
    ];
  }, [overview]);

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {statCards.length > 0 && (
        <View style={styles.grid}>
          {statCards.map((card) => (
            <View key={card.label} style={styles.statCard}>
              <Text style={styles.statValue}>{card.value}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.filterRow}>
        {(["", "low", "medium", "high"] as const).map((level) => (
          <Pressable
            key={level || "all"}
            style={[styles.filterChip, levelFilter === level && styles.filterChipActive]}
            onPress={() => setLevelFilter(level)}
          >
            <Text style={[styles.filterChipText, levelFilter === level && styles.filterChipTextActive]}>
              {level ? LEVEL_LABEL[level] : "Todos"}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <Text style={styles.hint}>
          {levelFilter ? "Sin entradas en este nivel." : "Sin datos de trust disponibles."}
        </Text>
      ) : (
        filtered.map((item, index) => {
          const colorKey = LEVEL_COLOR_KEY[item.level];
          return (
            <View key={`${item.scopeId}-${index}`} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.scopeType}: {item.scopeId.slice(0, 12)}
                </Text>
                <View style={[styles.badge, { backgroundColor: theme.colors[colorKey] + "22" }]}>
                  <Text style={[styles.badgeText, { color: theme.colors[colorKey] }]}>
                    {LEVEL_LABEL[item.level]} · {item.score}
                  </Text>
                </View>
              </View>
              <Text style={styles.hint} numberOfLines={2}>{item.primaryReason}</Text>
              {item.flags.length > 0 && (
                <Text style={styles.flags}>⚠ {item.flags.join(", ")}</Text>
              )}
            </View>
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
    hint: { fontSize: 13, color: theme.colors.muted },
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
    statValue: { fontSize: 22, fontWeight: "800", color: theme.colors.ink },
    statLabel: { fontSize: 11, color: theme.colors.muted },
    filterRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterChipActive: { borderColor: theme.colors.brand, backgroundColor: theme.colors.brandDim },
    filterChipText: { fontSize: 12, fontWeight: "700", color: theme.colors.muted },
    filterChipTextActive: { color: theme.colors.brand },
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
    flags: { fontSize: 12, color: theme.colors.error, fontWeight: "600" },
  });
}
