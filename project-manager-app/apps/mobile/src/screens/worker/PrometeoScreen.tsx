import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { chatWithPrometeo, type PrometeoChatResponse } from "../../api/prometeo";
import { useTheme } from "../../theme/theme";
import type { WorkerMoreStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<WorkerMoreStackParamList, "Prometeo">;
export default function PrometeoScreen(_props: Props) {
  const theme = useTheme(); const styles = buildStyles(theme);
  const [message, setMessage] = useState(""); const [result, setResult] = useState<PrometeoChatResponse | null>(null); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const send = async () => { const trimmed = message.trim(); if (!trimmed || loading) return; setLoading(true); setError(null); try { setResult(await chatWithPrometeo({ message: trimmed, agentId: "prometeo" })); setMessage(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo contactar a Prometeo."); } finally { setLoading(false); } };
  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <View style={styles.hero}><Text style={styles.title}>Prometeo</Text><Text style={styles.subtitle}>Asistente operativo de SEMSE. Sus acciones sensibles siempre requieren aprobación.</Text></View>
    <TextInput accessibilityLabel="Mensaje para Prometeo" multiline value={message} onChangeText={setMessage} placeholder="¿Qué necesitas revisar?" placeholderTextColor={theme.colors.muted} style={styles.input} />
    <Pressable accessibilityRole="button" accessibilityLabel="Enviar mensaje" onPress={() => void send()} disabled={!message.trim() || loading} style={[styles.button, (!message.trim() || loading) && styles.disabled]}>{loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Consultar a Prometeo</Text>}</Pressable>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {result ? <View style={styles.response}><Text style={styles.responseLabel}>Respuesta</Text><Text style={styles.responseText}>{result.response}</Text>{result.proposedActions?.length ? <Text style={styles.notice}>Hay acciones propuestas; revísalas antes de ejecutarlas.</Text> : null}</View> : null}
  </ScrollView>;
}
function buildStyles(theme: ReturnType<typeof useTheme>) { return StyleSheet.create({ container: { padding: theme.spacing.lg, gap: theme.spacing.md }, hero: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border }, title: { color: theme.colors.ink, fontSize: 24, fontWeight: "800" }, subtitle: { color: theme.colors.muted, lineHeight: 20, marginTop: theme.spacing.xs }, input: { minHeight: 110, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: theme.spacing.md, color: theme.colors.ink, backgroundColor: theme.colors.surface, textAlignVertical: "top" }, button: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: theme.spacing.lg }, disabled: { opacity: 0.5 }, buttonText: { color: "#ffffff", fontWeight: "800" }, error: { color: theme.colors.error }, response: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border }, responseLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }, responseText: { color: theme.colors.ink, lineHeight: 22, marginTop: theme.spacing.sm }, notice: { color: theme.colors.warn, marginTop: theme.spacing.md, fontWeight: "700" } }); }
