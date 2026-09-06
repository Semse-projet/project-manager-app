import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { createLiveSession, transitionLiveSession, type LiveSessionSnapshot } from "../api/liveSessions";
import LiveKitCall from "../components/LiveKitCall";
import { useLiveSessionEvents } from "../api/liveSessionEvents";

export default function LiveInspectionScreen() {
  const [jobId, setJobId] = useState("");
  const [session, setSession] = useState<LiveSessionSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const liveSnapshot = useLiveSessionEvents(session?.id ?? null);
  const currentSession = liveSnapshot ?? session;

  async function start() {
    const scopeId = jobId.trim();
    if (!scopeId || loading) return;
    setLoading(true);
    try {
      const created = await createLiveSession({ scopeType: "job", scopeId, purpose: "inspection", idempotencyKey: `mobile-${scopeId}-${Date.now()}` });
      setSession(created);
    } catch (cause: unknown) {
      Alert.alert("No se pudo iniciar la inspección", cause instanceof Error ? cause.message : "Inténtalo de nuevo.");
    } finally { setLoading(false); }
  }

  async function end() {
    if (!currentSession) return;
    try {
      const ended = await transitionLiveSession(currentSession.id, { action: "end", expectedVersion: currentSession.version });
      setSession(ended);
    } catch (cause: unknown) {
      Alert.alert("No se pudo cerrar la inspección", cause instanceof Error ? cause.message : "La sesión puede seguir activa.");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Inspección en vivo</Text>
      <Text style={styles.subtitle}>Conecta cámara y audio con Prometeo para revisar un job con autorización.</Text>
      {!currentSession ? <>
        <TextInput value={jobId} onChangeText={setJobId} placeholder="ID del job" style={styles.input} autoCapitalize="none" />
        <Pressable onPress={() => void start()} disabled={loading || !jobId.trim()} style={styles.button}><Text style={styles.buttonText}>{loading ? "Iniciando…" : "Iniciar inspección"}</Text></Pressable>
      </> : <>
        <Text style={styles.status}>Estado: {currentSession.status}</Text>
        {(currentSession.status === "ACTIVE" || currentSession.status === "CONNECTING") && <LiveKitCall sessionId={currentSession.id} />}
        <Pressable onPress={() => void end()} style={styles.endButton}><Text style={styles.endText}>Finalizar inspección</Text></Pressable>
      </>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  title: { fontSize: 26, fontWeight: "800", color: "#0f172a" },
  subtitle: { color: "#64748b", lineHeight: 20 },
  input: { borderColor: "#cbd5e1", borderWidth: 1, borderRadius: 12, padding: 14, color: "#0f172a" },
  button: { backgroundColor: "#16805c", borderRadius: 12, alignItems: "center", padding: 14 },
  buttonText: { color: "#fff", fontWeight: "800" },
  status: { fontWeight: "700", color: "#16805c" },
  endButton: { borderColor: "#dc2626", borderWidth: 1, borderRadius: 12, alignItems: "center", padding: 14 },
  endText: { color: "#dc2626", fontWeight: "800" },
});
