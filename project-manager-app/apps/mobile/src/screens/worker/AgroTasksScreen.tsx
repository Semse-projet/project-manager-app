import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  completeAgroTaskFromAnyStatus, fetchMyTasks, isAgroTask, toAgroFarmTaskId, type CrossDomainTask,
} from "../../api/tasks";
import { useTheme } from "../../theme/theme";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import type { AgroStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AgroStackParamList, "AgroTasks">;

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  done: "Completada",
  blocked: "Bloqueada",
};

/**
 * `GET /v1/tasks` es entre dominios — filtramos a las que espejan un
 * AgroFarmTask (`agrotask_` prefix, ver api/tasks.ts) porque esta pestaña es
 * Agro; las tareas de otros dominios (Jobs/BuildOps) se ven en sus propias
 * pantallas.
 */
export default function AgroTasksScreen(_props: Props) {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [tasks, setTasks] = useState<CrossDomainTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const all = await fetchMyTasks();
      setTasks(all.filter(isAgroTask));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar tus tareas.");
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

  async function handleComplete(task: CrossDomainTask) {
    if (completingId) return;
    setCompletingId(task.id);
    setError(null);
    try {
      await completeAgroTaskFromAnyStatus(toAgroFarmTaskId(task), task.status);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo completar la tarea.");
    } finally {
      setCompletingId(null);
    }
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
      data={tasks}
      keyExtractor={(task) => task.id}
      onRefresh={() => void load(true)}
      refreshing={refreshing}
      ListHeaderComponent={error ? <ErrorState message={error} /> : undefined}
      ListEmptyComponent={<EmptyState icon="checkbox-outline" title="No tienes tareas Agro asignadas." />}
      renderItem={({ item }) => {
        const done = item.status === "done";
        return (
          <View style={styles.card}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.cardMeta}>{STATUS_LABEL[item.status] ?? item.status}</Text>
            {item.description ? <Text style={styles.cardMeta}>{item.description}</Text> : null}
            {!done ? (
              <Pressable
                style={[styles.button, completingId === item.id && styles.buttonDisabled]}
                onPress={() => void handleComplete(item)}
                disabled={completingId === item.id}
              >
                {completingId === item.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Marcar completada</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        );
      }}
    />
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: theme.spacing.lg, gap: theme.spacing.md },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 6,
      marginBottom: theme.spacing.md,
    },
    cardTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.ink },
    cardMeta: { fontSize: 12, color: theme.colors.muted },
    button: { marginTop: 8, backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, padding: 10, alignItems: "center" },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  });
}
