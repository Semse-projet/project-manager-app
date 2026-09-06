import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { askPrometeo } from "../api/liveSessions";

export default function PrometeoScreen() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("Pregúntale a Prometeo sobre tus trabajos, evidencias o próximos pasos.");
  const [threadId, setThreadId] = useState<string>();
  const [loading, setLoading] = useState(false);

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

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>SEMSE / INTELIGENCIA</Text>
      <Text style={styles.title}>Prometeo</Text>
      <Text style={styles.subtitle}>Asistente operativo conectado a tus datos reales.</Text>
      <Text style={styles.reply}>{reply}</Text>
      <TextInput value={message} onChangeText={setMessage} onSubmitEditing={() => void send()} placeholder="Escribe una pregunta…" style={styles.input} multiline />
      <Pressable onPress={() => void send()} disabled={loading || !message.trim()} style={[styles.button, (loading || !message.trim()) && styles.disabled]}>
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
});
