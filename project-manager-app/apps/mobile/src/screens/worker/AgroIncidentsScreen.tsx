import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fetchAgroIncidents, type AgroIncident } from "../../api/agro";
import { useTheme } from "../../theme/theme";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import type { AgroStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AgroStackParamList, "AgroIncidents">;

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Abierto",
  TRIAGED: "Priorizado",
  IN_PROGRESS: "En curso",
  RESOLVED: "Resuelto",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
  DUPLICATE: "Duplicado",
};

const SEVERITY_LABEL: Record<string, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export default function AgroIncidentsScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [incidents, setIncidents] = useState<AgroIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setIncidents(await fetchAgroIncidents(farmId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar las incidencias.");
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [farmId]);

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
      data={incidents}
      keyExtractor={(incident) => incident.id}
      onRefresh={() => void load(true)}
      refreshing={refreshing}
      ListHeaderComponent={
        <View style={styles.header}>
          {error ? <ErrorState message={error} /> : null}
          <Pressable
            style={styles.button}
            onPress={() => navigation.navigate("AgroReportIncident", { farmId, farmName })}
          >
            <Text style={styles.buttonText}>+ Reportar incidencia</Text>
          </Pressable>
        </View>
      }
      ListEmptyComponent={<EmptyState icon="alert-circle-outline" title={`Sin incidencias reportadas en ${farmName}.`} />}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{SEVERITY_LABEL[item.severity] ?? item.severity}</Text>
            </View>
          </View>
          <Text style={styles.cardMeta}>
            {STATUS_LABEL[item.status] ?? item.status} · {new Date(item.detectedAt).toLocaleDateString()}
          </Text>
          {item.description ? <Text style={styles.cardMeta}>{item.description}</Text> : null}
        </View>
      )}
    />
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: theme.spacing.lg, gap: theme.spacing.md },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
    button: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, padding: 12, alignItems: "center" },
    buttonText: { color: "#fff", fontWeight: "700" },
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
    cardMeta: { fontSize: 12, color: theme.colors.muted },
    badge: { borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: theme.colors.warn + "22" },
    badgeText: { fontSize: 11, fontWeight: "700", color: theme.colors.warn },
  });
}
