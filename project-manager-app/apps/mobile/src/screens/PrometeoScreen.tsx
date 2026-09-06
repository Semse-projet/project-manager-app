import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { askPrometeo, executePrometeoAction, fetchPrometeoContext, sendPrometeoCopilotMessage, type PrometeoContext, type PrometeoSuggestedAction } from "../api/liveSessions";

export default function PrometeoScreen() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("Pregúntale a Prometeo sobre tus trabajos, evidencias o próximos pasos.");
  const [threadId, setThreadId] = useState<string>();
  const [sessionId, setSessionId] = useState<string>();
  const [context, setContext] = useState<PrometeoContext | null>(null);
  const [actions, setActions] = useState<PrometeoSuggestedAction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchPrometeoContext()
      .then((result) => {
        setContext(result);
        setActions(result.suggestedActions);
      })
      .catch((cause: unknown) => {
        Alert.alert("Prometeo no está disponible", cause instanceof Error ? cause.message : "No se pudo cargar el contexto.");
      });
  }, []);

  async function send() {
    const value = message.trim();
    if (!value || loading) return;
    setLoading(true);
    try {
      const result = await askPrometeo({ message: value, threadId, agentId: "prometeo" });
      setReply(result.reply ?? result.message ?? "Prometeo no devolvió una respuesta.");
      if (result.threadId) setThreadId(result.threadId);
      setMessage("");
    } catch (cause: unknown) {
      Alert.alert("No se pudo consultar al agente", cause instanceof Error ? cause.message : "Inténtalo de nuevo.");
    } finally { setLoading(false); }
  }

  async function sendCopilot() {
    const value = message.trim();
    if (!value || loading) return;
    setLoading(true);
    try {
      const result = await sendPrometeoCopilotMessage({
        message: value,
        sessionId,
        context: context ? { module: context.module, resource: context.resource, permissions: context.permissions } : undefined,
      });
      setReply(result.response);
      setSessionId(result.sessionId);
      setActions(result.suggestedActions);
      setMessage("");
    } catch (cause: unknown) {
      Alert.alert("No se pudo consultar a Prometeo", cause instanceof Error ? cause.message : "Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function executeAction(action: PrometeoSuggestedAction) {
    if (!context || loading) return;
    setLoading(true);
    try {
      const result = await executePrometeoAction({
        action: action.action,
        targetResource: { resourceId: context.resource.id ?? context.module, resourceType: context.resource.type || context.module },
      });
      setReply(result.requiresWorkspace ? "Esta acción requiere abrir el espacio de trabajo." : `Acción lista: ${action.description}`);
      setActions((current) => current.filter((item) => item.action !== action.action));
    } catch (cause: unknown) {
      Alert.alert("No se pudo ejecutar la acción", cause instanceof Error ? cause.message : "Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>SEMSE / INTELIGENCIA</Text>
      <Text style={styles.title}>Prometeo</Text>
      <Text style={styles.subtitle}>Asistente operativo conectado a tus datos reales.</Text>
      <Text style={styles.reply}>{reply}</Text>
      {actions.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
          {actions.map((action) => (
            <Pressable key={action.action} onPress={() => void executeAction(action)} disabled={loading} style={styles.actionButton}>
              <Text style={styles.actionText}>{action.description}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <TextInput value={message} onChangeText={setMessage} onSubmitEditing={() => void sendCopilot()} placeholder="Escribe una pregunta…" style={styles.input} multiline />
      <Pressable onPress={() => void sendCopilot()} disabled={loading || !message.trim()} style={[styles.button, (loading || !message.trim()) && styles.disabled]}>
        <Text style={styles.buttonText}>{loading ? "Analizando…" : "Enviar a Prometeo"}</Text>
      </Pressable>
      <Text style={styles.note}>Las acciones sensibles requieren autorización y quedan registradas.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 },
  eyebrow: { color: "#16805c", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: "#0f172a", fontSize: 31, fontWeight: "800" },
  subtitle: { color: "#64748b", fontSize: 13 },
  reply: { backgroundColor: "#e8f7ef", borderRadius: 16, padding: 16, color: "#0f172a", fontSize: 14, lineHeight: 21 },
  input: { minHeight: 80, borderColor: "#cbd5e1", borderWidth: 1, borderRadius: 14, color: "#0f172a", padding: 14, textAlignVertical: "top" },
  button: { backgroundColor: "#16805c", borderRadius: 13, alignItems: "center", padding: 15 },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  note: { color: "#64748b", fontSize: 11, textAlign: "center" },
  actions: { gap: 8, paddingVertical: 2 },
  actionButton: { backgroundColor: "#fff7ed", borderColor: "#fed7aa", borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 10 },
  actionText: { color: "#9a3412", fontSize: 12, fontWeight: "700" },
});
