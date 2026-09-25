import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { submitRating } from "../../api/ratings";
import { useTheme } from "../../theme/theme";
import { ErrorState } from "../../components/ErrorState";
import type { WorkerMoreStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<WorkerMoreStackParamList, "ReviewForm">;

const SCORES = [1, 2, 3, 4, 5];

/**
 * Mirrors src/screens/client/RatingFormScreen.tsx — same backend endpoint and
 * the same caveat: RatingsService.canCreateRating only checks role, not prior
 * ratings, so disabling the form after submit is a UX mitigation, not a real
 * idempotency guarantee.
 */
export default function WorkerReviewFormScreen({ route, navigation }: Props) {
  const { jobTitle, toUserId, toUserEmail } = route.params;
  const theme = useTheme();
  const styles = buildStyles(theme);

  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (submitting || submitted || !score) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitRating({
        jobId: route.params.jobId,
        toUserId,
        score,
        comment: comment.trim() || undefined,
      });
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo enviar la calificación.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>¡Gracias por tu calificación!</Text>
        <Pressable style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Calificar a {toUserEmail || "cliente"}</Text>
      <Text style={styles.hint}>{jobTitle}</Text>
      {error ? <ErrorState message={error} /> : null}

      <View style={styles.stars}>
        {SCORES.map((value) => (
          <Pressable key={value} onPress={() => setScore(value)} accessibilityLabel={`${value} estrellas`}>
            <Text style={[styles.star, value <= (score ?? 0) && styles.starSelected]}>★</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Comentario (opcional)</Text>
      <TextInput
        style={styles.input}
        value={comment}
        onChangeText={setComment}
        placeholder="¿Cómo fue trabajar con este cliente?"
        placeholderTextColor={theme.colors.faint}
        multiline
      />

      <Pressable
        style={[styles.button, (submitting || !score) && styles.buttonDisabled]}
        onPress={() => void handleSubmit()}
        disabled={submitting || !score}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Enviar calificación</Text>}
      </Pressable>
    </View>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, padding: theme.spacing.lg, gap: theme.spacing.sm, backgroundColor: theme.colors.base },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: theme.spacing.lg, gap: theme.spacing.md },
    title: { fontSize: 18, fontWeight: "800", color: theme.colors.ink, textAlign: "center" },
    hint: { fontSize: 13, color: theme.colors.muted, marginBottom: theme.spacing.sm },
    error: { color: theme.colors.error, fontSize: 13 },
    stars: { flexDirection: "row", gap: 8, marginVertical: theme.spacing.md },
    star: { fontSize: 36, color: theme.colors.border },
    starSelected: { color: theme.colors.brand },
    label: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase" },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: 12,
      fontSize: 14,
      color: theme.colors.ink,
      minHeight: 80,
      textAlignVertical: "top",
    },
    button: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, padding: 12, alignItems: "center", marginTop: theme.spacing.md },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: "#fff", fontWeight: "700" },
  });
}
