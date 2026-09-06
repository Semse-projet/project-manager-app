import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { fetchMobileTasks, updateMobileTask, type MobileTask } from "../api/liveSessions";

const labels: Record<MobileTask["status"], string> = { pending: "Pendiente", in_progress: "En progreso", done: "Completada", blocked: "Bloqueada" };

export default function TasksScreen() {
  const [items, setItems] = useState<MobileTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setItems(await fetchMobileTasks()); } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "No se pudieron cargar las tareas."); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function advance(task: MobileTask) { const next = task.status === "pending" ? "in_progress" : task.status === "in_progress" ? "done" : task.status; if (next === task.status) return; try { const updated = await updateMobileTask(task.id, next); setItems((current) => current.map((entry) => entry.id === task.id ? updated : entry)); } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "No se pudo actualizar la tarea."); } }
  return <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />} contentContainerStyle={styles.content}><Text style={styles.title}>Mis tareas</Text><Text style={styles.subtitle}>Seguimiento operativo de tus compromisos.</Text>{error ? <Text style={styles.error}>{error}</Text> : null}{items.length === 0 ? <Text style={styles.empty}>{loading ? "Cargando tareas…" : "No hay tareas asignadas"}</Text> : items.map((task) => <Pressable key={task.id} onPress={() => void advance(task)} style={styles.card}><View style={styles.row}><Text style={styles.task}>{task.title}</Text><Text style={styles.status}>{labels[task.status]}</Text></View>{task.description ? <Text style={styles.description}>{task.description}</Text> : null}<Text style={styles.meta}>{task.priority ? `Prioridad ${task.priority}` : "Prioridad normal"}{task.dueDate ? ` · vence ${new Date(task.dueDate).toLocaleDateString("es-MX")}` : ""}</Text>{task.status === "pending" || task.status === "in_progress" ? <Text style={styles.action}>Tocar para {task.status === "pending" ? "iniciar" : "completar"} →</Text> : null}</Pressable>)}</ScrollView>;
}

const styles = StyleSheet.create({ content: { padding: 20, gap: 12 }, title: { fontSize: 28, fontWeight: "800", color: "#0f172a" }, subtitle: { color: "#64748b" }, error: { color: "#b91c1c" }, empty: { padding: 24, color: "#64748b" }, card: { padding: 15, borderRadius: 15, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff" }, row: { flexDirection: "row", gap: 8 }, task: { flex: 1, fontWeight: "800", color: "#0f172a" }, status: { color: "#16805c", fontSize: 11, fontWeight: "800" }, description: { color: "#475569", marginTop: 8 }, meta: { color: "#64748b", fontSize: 11, marginTop: 8 }, action: { color: "#16805c", fontWeight: "700", marginTop: 10 } });
