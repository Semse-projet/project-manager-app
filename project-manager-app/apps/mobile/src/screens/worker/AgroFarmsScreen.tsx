import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { fetchAgroMemberships, type AgroFarmMembership } from "../../api/agro";
import { useTheme } from "../../theme/theme";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import type { AgroStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AgroStackParamList, "AgroFarms">;

export default function AgroFarmsScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [farms, setFarms] = useState<AgroFarmMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setFarms(await fetchAgroMemberships());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar tus fincas.");
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
    <FlatList
      contentContainerStyle={styles.container}
      data={farms}
      keyExtractor={(farm) => farm.farmId}
      onRefresh={() => void load(true)}
      refreshing={refreshing}
      ListHeaderComponent={
        <View style={styles.header}>
          {error ? <ErrorState message={error} /> : null}
          <Pressable style={styles.tasksButton} onPress={() => navigation.navigate("AgroTasks")}>
            <Ionicons name="checkbox-outline" size={16} color={theme.colors.brand} />
            <Text style={styles.tasksButtonText}>Mis tareas</Text>
          </Pressable>
          <Text style={styles.sectionLabel}>Mis fincas</Text>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="leaf-outline"
          title="No estás asignado a ninguna finca todavía."
          description="Pídele a la persona encargada que te agregue como miembro activo."
        />
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate("AgroIncidents", { farmId: item.farmId, farmName: item.farmName })}
        >
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.farmName}</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
          </View>
          <Text style={styles.cardMeta}>{item.farmRole}</Text>
        </Pressable>
      )}
    />
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: theme.spacing.lg, gap: theme.spacing.md },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
    sectionLabel: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase" },
    tasksButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.full,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    tasksButtonText: { fontSize: 13, fontWeight: "700", color: theme.colors.brand },
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
  });
}
