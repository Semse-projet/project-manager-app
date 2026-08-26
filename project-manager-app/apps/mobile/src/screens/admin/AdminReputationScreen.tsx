import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { ReputationScoreView, ReputationTier } from "@semse/schemas";
import { fetchReputationBatch } from "../../api/reputation";
import { useTheme } from "../../theme/theme";

const TIER_LABEL: Record<ReputationTier, string> = {
  trusted: "Trusted",
  established: "Established",
  growing: "Growing",
  emerging: "Emerging",
};

const TIER_COLOR_KEY: Record<ReputationTier, "ok" | "brand" | "warn" | "muted"> = {
  trusted: "ok",
  established: "brand",
  growing: "warn",
  emerging: "muted",
};

/**
 * GET /v1/ratings/reputation, OPS_ADMIN only (ratings:read, already
 * granted), tenant-wide batch (computeBatchForTenant filters only by
 * tenantId, no org scoping -- verified in reputation.service.ts). Read-only,
 * no ratings sub-list (apps/web's Reputation page also shows individual
 * ratings via a separate GET /v1/ratings call -- that per-professional
 * detail is a separate, larger surface this phase doesn't build, same
 * reasoning as skipping the trust-passport detail in Fase 7f).
 *
 * Built against @semse/schemas's real reputationScoreViewSchema. Note:
 * apps/web's page declares an optional `user?: { email }` field the
 * backend never actually populates (verified in
 * reputation.service.ts:computeForUser's return shape) -- its UI always
 * falls back to a truncated userId as a result. That's a pre-existing gap
 * in apps/web, not something this phase fixes; mobile uses the same
 * truncated-userId fallback rather than pretending otherwise.
 */
export default function AdminReputationScreen() {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [scores, setScores] = useState<ReputationScoreView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setScores(await fetchReputationBatch());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar la reputación.");
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

  const sorted = useMemo(() => [...scores].sort((a, b) => b.score - a.score), [scores]);

  const statCards = useMemo(() => {
    if (scores.length === 0) return [];
    const avg = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);
    const trusted = scores.filter((s) => s.tier === "trusted").length;
    return [
      { label: "Profesionales", value: scores.length },
      { label: "Puntaje promedio", value: avg },
      { label: "Trusted", value: trusted },
    ];
  }, [scores]);

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

      {sorted.length === 0 ? (
        <Text style={styles.hint}>Sin profesionales con reputación calculada todavía.</Text>
      ) : (
        sorted.map((rep) => {
          const colorKey = TIER_COLOR_KEY[rep.tier];
          return (
            <View key={rep.userId} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle} numberOfLines={1}>{rep.userId.slice(-8)}</Text>
                <View style={[styles.badge, { backgroundColor: theme.colors[colorKey] + "22" }]}>
                  <Text style={[styles.badgeText, { color: theme.colors[colorKey] }]}>
                    {TIER_LABEL[rep.tier]} · {rep.score}
                  </Text>
                </View>
              </View>
              <Text style={styles.hint}>
                {rep.signals.totalRatings} rating{rep.signals.totalRatings === 1 ? "" : "s"} ·{" "}
                {Math.round(rep.signals.completionRate * 100)}% completados ·{" "}
                {Math.round(rep.signals.disputeResilienceRate * 100)}% sin disputas
              </Text>
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
      width: "31%",
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 4,
    },
    statValue: { fontSize: 20, fontWeight: "800", color: theme.colors.ink },
    statLabel: { fontSize: 11, color: theme.colors.muted },
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
  });
}
