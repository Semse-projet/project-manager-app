import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { AdminLaborOverviewView, LaborAlertSeverity } from "@semse/schemas";
import { fetchAdminLaborOverview } from "../../api/labor";
import { useTheme } from "../../theme/theme";
import { formatCurrency } from "../../utils/format";

const ALERT_LABEL: Record<string, string> = {
  stale_timer: "Timer olvidado",
  overtime: "Horas extra",
  long_entry: "Jornada larga",
  off_site_checkin: "Check-in lejos del sitio",
};

const SEVERITY_COLOR_KEY: Record<LaborAlertSeverity, "warn" | "error"> = {
  warning: "warn",
  critical: "error",
};

/**
 * GET /v1/labor/admin/overview, OPS_ADMIN only (ops:dashboard:read) --
 * QualityGuard alerts + team weekly summary, read-only. workerId is shown
 * truncated, not resolved to a name (apps/web does that via a separate
 * users call this fase intentionally skips, see spec §2).
 */
export default function AdminLaborOverviewScreen() {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [overview, setOverview] = useState<AdminLaborOverviewView | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setOverview(await fetchAdminLaborOverview());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el resumen de Labor Engine.");
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

  const alerts = overview?.alerts ?? [];
  const team = overview?.team ?? [];
  const isEmpty = alerts.length === 0 && team.length === 0;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isEmpty ? (
        <Text style={styles.hint}>Sin alertas ni actividad del equipo esta semana.</Text>
      ) : (
        <>
          <Text style={styles.sectionLabel}>Alertas ({alerts.length})</Text>
          {alerts.length === 0 ? (
            <Text style={styles.hint}>Sin alertas activas.</Text>
          ) : (
            alerts.map((alert, index) => {
              const colorKey = SEVERITY_COLOR_KEY[alert.severity] ?? "warn";
              return (
                <View key={`${alert.type}-${alert.entryId ?? alert.workerId}-${index}`} style={styles.alertCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.alertTitle}>{ALERT_LABEL[alert.type] ?? alert.type}</Text>
                    <View style={[styles.badge, { backgroundColor: theme.colors[colorKey] + "22" }]}>
                      <Text style={[styles.badgeText, { color: theme.colors[colorKey] }]}>
                        {alert.severity === "critical" ? "Crítica" : "Alerta"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.hint}>{alert.detail}</Text>
                  <Text style={styles.workerId}>{alert.workerId.slice(0, 12)}</Text>
                </View>
              );
            })
          )}

          <Text style={styles.sectionLabel}>Equipo esta semana ({team.length})</Text>
          {team.length === 0 ? (
            <Text style={styles.hint}>Sin horas registradas esta semana.</Text>
          ) : (
            team.map((member) => (
              <View key={member.workerId} style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.workerId}>{member.workerId.slice(0, 12)}</Text>
                  <Text style={styles.cardValue}>{(member.totalMinutes / 60).toFixed(1)}h</Text>
                </View>
                <Text style={styles.hint}>{formatCurrency(member.knownCost)}</Text>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: theme.spacing.lg, gap: theme.spacing.sm },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    error: { color: theme.colors.error, fontSize: 13 },
    hint: { fontSize: 13, color: theme.colors.muted },
    sectionLabel: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase", marginTop: theme.spacing.md },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
    workerId: { fontSize: 12, color: theme.colors.muted, fontVariant: ["tabular-nums"] },
    alertCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 4,
    },
    alertTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.ink },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 4,
    },
    cardValue: { fontSize: 14, fontWeight: "700", color: theme.colors.ink },
    badge: { borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: "700" },
  });
}
