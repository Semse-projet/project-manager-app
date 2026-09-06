import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { fetchMobileNotifications, markMobileNotificationRead, type MobileNotification } from "../api/liveSessions";

export default function NotificationsScreen() {
  const [items, setItems] = useState<MobileNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setItems(await fetchMobileNotifications()); } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : "No se pudieron cargar las notificaciones."); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function markRead(item: MobileNotification) { if (item.readAt) return; try { await markMobileNotificationRead(item.id); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry)); } catch { /* La bandeja sigue disponible aunque falle el marcado. */ } }
  const unread = items.filter((item) => !item.readAt).length;
  return <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />} contentContainerStyle={styles.content}><Text style={styles.title}>Notificaciones</Text><Text style={styles.subtitle}>{unread ? `${unread} pendientes de revisar` : "Todo está al día"}</Text>{error ? <Text style={styles.error}>{error}</Text> : null}{items.length === 0 ? <Text style={styles.empty}>{loading ? "Cargando actividad…" : "Sin notificaciones"}</Text> : items.map((item) => <Pressable key={item.id} onPress={() => void markRead(item)} style={[styles.card, !item.readAt && styles.unread]}><View style={styles.row}><Text style={styles.cardTitle}>{item.title ?? "Actualización de SEMSE"}</Text><Text style={styles.date}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString("es-MX") : ""}</Text></View><Text style={styles.message}>{item.message ?? item.body ?? "Toca para marcar como leída."}</Text></Pressable>)}</ScrollView>;
}

const styles = StyleSheet.create({ content: { padding: 20, gap: 12 }, title: { fontSize: 28, fontWeight: "800", color: "#0f172a" }, subtitle: { color: "#64748b" }, error: { color: "#b91c1c" }, empty: { padding: 24, color: "#64748b" }, card: { padding: 15, borderRadius: 15, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff" }, unread: { borderColor: "#16805c", backgroundColor: "#f0fdf4" }, row: { flexDirection: "row", gap: 8 }, cardTitle: { flex: 1, fontWeight: "800", color: "#0f172a" }, date: { color: "#64748b", fontSize: 10 }, message: { color: "#475569", marginTop: 8 } });
