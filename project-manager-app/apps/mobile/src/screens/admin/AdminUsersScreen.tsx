import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { UserRecordView } from "@semse/schemas";
import { fetchUsers } from "../../api/users";
import { useTheme } from "../../theme/theme";

const STATUS_COLOR_KEY: Record<string, "ok" | "error" | "warn" | "muted"> = {
  active: "ok",
  pending: "warn",
  suspended: "error",
};

/**
 * GET /v1/users, OPS_ADMIN only (users:read) -- tenant-wide user directory,
 * read-only. No status/verify/profile mutation anywhere in this slice; see
 * mobile-admin-users.spec.md §2 for why. workerId-style ids and email are
 * shown as-is, same PII already visible to this role on apps/web.
 */
export default function AdminUsersScreen() {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [users, setUsers] = useState<UserRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setUsers(await fetchUsers());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los usuarios.");
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
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {users.length === 0 ? (
        <Text style={styles.hint}>Sin usuarios en el tenant.</Text>
      ) : (
        users.map((user) => {
          const colorKey = STATUS_COLOR_KEY[user.status] ?? "muted";
          return (
            <View key={user.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
                <View style={[styles.badge, { backgroundColor: theme.colors[colorKey] + "22" }]}>
                  <Text style={[styles.badgeText, { color: theme.colors[colorKey] }]}>
                    {user.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              {user.phone ? <Text style={styles.hint}>{user.phone}</Text> : null}
              <View style={styles.rowBetween}>
                <Text style={styles.hint}>Verificación: {user.verificationStatus}</Text>
                <Text style={styles.trustScore}>{Math.round(user.trustScore * 100)}%</Text>
              </View>
              <Text style={styles.riskLevel}>{user.riskLevel.toUpperCase()}</Text>
              {user.flags.length > 0 ? (
                <Text style={styles.flags}>⚠ {user.flags.join(", ")}</Text>
              ) : null}
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
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 4,
    },
    email: { fontSize: 14, fontWeight: "700", color: theme.colors.ink, flex: 1 },
    trustScore: { fontSize: 13, fontWeight: "700", color: theme.colors.ink },
    riskLevel: { fontSize: 11, fontWeight: "700", color: theme.colors.muted },
    flags: { fontSize: 12, color: theme.colors.error, fontWeight: "600" },
    badge: { borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: "700" },
  });
}
