import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import type { BidRecordView, JobRecordView } from "@semse/schemas";
import { fetchJobDetail } from "../../api/jobs";
import { fetchMyBids, submitBid } from "../../api/bids";
import { fetchActiveTimer, startTimer } from "../../api/labor";
import { createLiveSession } from "../../api/liveSessions";
import { useTheme } from "../../theme/theme";
import { formatCurrency } from "../../utils/format";
import type { WorkerJobsStackParamList } from "../../navigation/types";
import {
  BID_STATUS_COLOR_KEY,
  BID_STATUS_LABEL,
  BIDDABLE_JOB_STATUSES,
  JOB_STATUS_COLOR_KEY,
  JOB_STATUS_LABEL,
} from "./jobStatus";

type Props = NativeStackScreenProps<WorkerJobsStackParamList, "JobDetail">;

export default function JobDetailScreen({ route, navigation }: Props) {
  const { jobId } = route.params;
  const theme = useTheme();
  const styles = buildStyles(theme);

  const [job, setJob] = useState<JobRecordView | null>(null);
  const [existingBid, setExistingBid] = useState<BidRecordView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [etaDays, setEtaDays] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [startingTimer, setStartingTimer] = useState(false);
  const [startingLive, setStartingLive] = useState(false);
  const [timerMessage, setTimerMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobDetail, myBids] = await Promise.all([fetchJobDetail(jobId), fetchMyBids()]);
      setJob(jobDetail);
      setExistingBid(myBids.find((bid) => bid.jobId === jobId) ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el job.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleSubmitBid() {
    const parsedAmount = Number(amount);
    const parsedEtaDays = Number(etaDays);
    if (submitting || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !Number.isInteger(parsedEtaDays) || parsedEtaDays <= 0) {
      setError("Ingresa un monto y un plazo (días) válidos.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const bid = await submitBid(jobId, { amount: parsedAmount, etaDays: parsedEtaDays, note: note.trim() || undefined });
      setExistingBid(bid);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo enviar la propuesta.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStartJobTimer() {
    if (startingTimer) return;
    setStartingTimer(true);
    setError(null);
    setTimerMessage(null);
    try {
      const active = await fetchActiveTimer();
      if (active) {
        setError(
          active.jobId === jobId
            ? "Ya tienes el reloj corriendo para este job — revísalo en la pestaña Timer."
            : "Ya tienes un reloj corriendo en otro trabajo. Detenlo desde la pestaña Timer antes de iniciar este.",
        );
        return;
      }
      await startTimer({ purpose: "job_linked", jobId, clientEventId: `job-linked-${jobId}-${Date.now()}` });
      setTimerMessage("Reloj iniciado para este job — revísalo en la pestaña Timer.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo iniciar el reloj.");
    } finally {
      setStartingTimer(false);
    }
  }

  async function handleStartLiveSession() {
    if (startingLive) return;
    setStartingLive(true);
    setError(null);
    try {
      const session = await createLiveSession({
        scopeType: "job",
        scopeId: jobId,
        purpose: "assist",
        idempotencyKey: `job-${jobId}-live-${Date.now()}`,
      });
      navigation.navigate("LiveSession", { sessionId: session.id });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo iniciar la sesión en vivo.");
    } finally {
      setStartingLive(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? "Job no encontrado."}</Text>
      </View>
    );
  }

  const canBid = BIDDABLE_JOB_STATUSES.includes(job.status);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.title}>{job.title}</Text>
      {(() => {
        const badgeColor = theme.colors[JOB_STATUS_COLOR_KEY[job.status]];
        return (
          <View style={[styles.badge, { backgroundColor: badgeColor + "22" }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{JOB_STATUS_LABEL[job.status] ?? job.status}</Text>
          </View>
        );
      })()}

      {job.location ? (
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={theme.colors.muted} />
          <Text style={styles.meta}>{job.location}</Text>
        </View>
      ) : null}
      {job.category ? (
        <View style={styles.metaRow}>
          <Ionicons name="pricetag-outline" size={14} color={theme.colors.muted} />
          <Text style={styles.meta}>{job.category}</Text>
        </View>
      ) : null}
      {job.budgetMin || job.budgetMax ? (
        <View style={styles.metaRow}>
          <Ionicons name="cash-outline" size={14} color={theme.colors.brand} />
          <Text style={styles.meta}>
            {job.budgetMin ? formatCurrency(job.budgetMin) : ""}
            {job.budgetMin && job.budgetMax ? " – " : ""}
            {job.budgetMax ? formatCurrency(job.budgetMax) : ""}
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Alcance</Text>
      <Text style={styles.scope}>{job.scope}</Text>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => navigation.navigate("Evidence", { jobId: job.id, jobTitle: job.title })}
      >
        <Text style={styles.secondaryButtonText}>📷 Evidencia de este job</Text>
      </Pressable>

      <Pressable
        style={[styles.secondaryButton, startingLive && styles.buttonDisabled]}
        onPress={() => void handleStartLiveSession()}
        disabled={startingLive}
        accessibilityRole="button"
        accessibilityLabel="Iniciar sesión en vivo"
      >
        <Text style={styles.secondaryButtonText}>
          {startingLive ? "Abriendo…" : "🎥 Sesión en vivo (asistencia)"}
        </Text>
      </Pressable>

      {existingBid ? (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Tu propuesta</Text>
            <View style={[styles.badge, { backgroundColor: theme.colors[BID_STATUS_COLOR_KEY[existingBid.status] ?? "brand"] + "22" }]}>
              <Text style={[styles.badgeText, { color: theme.colors[BID_STATUS_COLOR_KEY[existingBid.status] ?? "brand"] }]}>
                {BID_STATUS_LABEL[existingBid.status] ?? existingBid.status}
              </Text>
            </View>
          </View>
          <Text style={styles.meta}>{formatCurrency(existingBid.amount)} · {existingBid.etaDays} días</Text>
          {existingBid.note ? <Text style={styles.meta}>{existingBid.note}</Text> : null}
          {existingBid.status === "accepted" ? (
            timerMessage ? (
              <Text style={styles.meta}>✅ {timerMessage}</Text>
            ) : (
              <Pressable
                style={[styles.button, startingTimer && styles.buttonDisabled]}
                onPress={() => void handleStartJobTimer()}
                disabled={startingTimer}
              >
                {startingTimer ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>⏱️ Iniciar reloj para este job</Text>}
              </Pressable>
            )
          ) : null}
        </View>
      ) : canBid ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nueva propuesta</Text>
          <Text style={styles.label}>Monto ($)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>Plazo (días)</Text>
          <TextInput
            style={styles.input}
            value={etaDays}
            onChangeText={setEtaDays}
            placeholder="0"
            keyboardType="number-pad"
          />
          <Text style={styles.label}>Nota (opcional)</Text>
          <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Detalles de tu propuesta..." multiline />
          <Pressable style={[styles.button, submitting && styles.buttonDisabled]} onPress={() => void handleSubmitBid()} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Enviar propuesta</Text>}
          </Pressable>
        </View>
      ) : (
        <Text style={styles.hint}>Este job ya no está disponible para nuevas propuestas.</Text>
      )}
    </ScrollView>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: theme.spacing.lg, gap: theme.spacing.sm },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: theme.spacing.lg },
    error: { color: theme.colors.error, fontSize: 13 },
    title: { fontSize: 20, fontWeight: "800", color: theme.colors.ink },
    badge: { alignSelf: "flex-start", backgroundColor: theme.colors.brandDim, borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: "700", color: theme.colors.brand },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    meta: { fontSize: 13, color: theme.colors.muted },
    hint: { fontSize: 13, color: theme.colors.muted, textAlign: "center", marginTop: theme.spacing.lg },
    sectionLabel: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase", marginTop: theme.spacing.sm },
    scope: { fontSize: 14, color: theme.colors.ink, lineHeight: 20 },
    secondaryButton: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      alignItems: "center",
      marginTop: theme.spacing.sm,
    },
    secondaryButtonText: { color: theme.colors.ink, fontWeight: "700" },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    cardTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.ink },
    label: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase" },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: 12,
      fontSize: 14,
      color: theme.colors.ink,
    },
    button: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, padding: 12, alignItems: "center", marginTop: 4 },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: "#fff", fontWeight: "700" },
  });
}
