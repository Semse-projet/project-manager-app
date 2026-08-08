import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import type { BidRecordView, EvidenceRecordView, JobRecordView, MilestoneRecordView } from "@semse/schemas";
import { fetchJobDetail } from "../../api/jobs";
import { acceptBid, fetchJobBids } from "../../api/bids";
import { approveMilestone, fetchMilestonesByJob } from "../../api/milestones";
import { buildEvidenceFileUrl, fetchEvidenceByJob } from "../../api/evidence";
import { useTheme } from "../../theme/theme";
import { formatCurrency } from "../../utils/format";
import type { ClientJobsStackParamList } from "../../navigation/types";
import {
  BID_STATUS_COLOR_KEY,
  BID_STATUS_LABEL,
  CLIENT_JOB_NEXT_ACTION,
  JOB_STATUS_COLOR_KEY,
  JOB_STATUS_LABEL,
} from "../worker/jobStatus";

type Props = NativeStackScreenProps<ClientJobsStackParamList, "JobDetail">;

const MILESTONE_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  awaiting_review: "Esperando evidencia",
  submitted: "Enviado para revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
  paid: "Pagado",
};

export default function JobDetailScreen({ route, navigation }: Props) {
  const { jobId } = route.params;
  const theme = useTheme();
  const styles = buildStyles(theme);

  const [job, setJob] = useState<JobRecordView | null>(null);
  const [bids, setBids] = useState<BidRecordView[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRecordView[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyBidId, setBusyBidId] = useState<string | null>(null);
  const [busyMilestoneId, setBusyMilestoneId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobDetail, jobBids, jobMilestones, jobEvidence] = await Promise.all([
        fetchJobDetail(jobId),
        fetchJobBids(jobId),
        fetchMilestonesByJob(jobId),
        fetchEvidenceByJob(jobId),
      ]);
      setJob(jobDetail);
      setBids(jobBids);
      setMilestones(jobMilestones);
      setEvidence(jobEvidence);
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

  async function handleAcceptBid(bidId: string) {
    if (busyBidId) return;
    setBusyBidId(bidId);
    setError(null);
    try {
      await acceptBid(bidId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo aceptar la propuesta.");
    } finally {
      setBusyBidId(null);
    }
  }

  async function handleApproveMilestone(milestoneId: string) {
    if (busyMilestoneId) return;
    setBusyMilestoneId(milestoneId);
    setError(null);
    try {
      await approveMilestone(milestoneId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo aprobar el milestone.");
    } finally {
      setBusyMilestoneId(null);
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

  const acceptedBid = bids.find((bid) => bid.status === "accepted") ?? null;

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

      {CLIENT_JOB_NEXT_ACTION[job.status] ? (
        <Text style={styles.nextAction}>▶ {CLIENT_JOB_NEXT_ACTION[job.status]}</Text>
      ) : null}

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

      {job.status === "completed" && acceptedBid ? (
        <Pressable
          style={styles.secondaryButton}
          onPress={() =>
            navigation.navigate("Rating", {
              jobId: job.id,
              jobTitle: job.title,
              toUserId: acceptedBid.professionalUserId ?? "",
              toUserEmail: acceptedBid.proEmail ?? "",
            })
          }
        >
          <Text style={styles.secondaryButtonText}>⭐ Calificar al profesional</Text>
        </Pressable>
      ) : null}

      <Text style={styles.sectionLabel}>Propuestas recibidas</Text>
      {bids.length === 0 ? (
        <Text style={styles.hint}>Todavía no llegaron propuestas para este job.</Text>
      ) : (
        bids.map((bid) => {
          const colorKey = BID_STATUS_COLOR_KEY[bid.status] ?? "brand";
          return (
            <View key={bid.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{bid.proEmail ?? "Profesional"}</Text>
                <View style={[styles.badge, { backgroundColor: theme.colors[colorKey] + "22" }]}>
                  <Text style={[styles.badgeText, { color: theme.colors[colorKey] }]}>
                    {BID_STATUS_LABEL[bid.status] ?? bid.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>{formatCurrency(bid.amount)} · {bid.etaDays} días</Text>
              {bid.note ? <Text style={styles.meta}>{bid.note}</Text> : null}
              {bid.status === "submitted" ? (
                <Pressable
                  style={[styles.button, busyBidId === bid.id && styles.buttonDisabled]}
                  onPress={() => void handleAcceptBid(bid.id)}
                  disabled={busyBidId !== null}
                >
                  {busyBidId === bid.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Aceptar propuesta</Text>}
                </Pressable>
              ) : null}
            </View>
          );
        })
      )}

      <Text style={styles.sectionLabel}>Milestones</Text>
      {milestones.length === 0 ? (
        <Text style={styles.hint}>Este job todavía no tiene milestones.</Text>
      ) : (
        milestones.map((milestone) => (
          <View key={milestone.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle} numberOfLines={1}>{milestone.title}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{MILESTONE_STATUS_LABEL[milestone.status] ?? milestone.status}</Text>
              </View>
            </View>
            <Text style={styles.meta}>{formatCurrency(milestone.amount)}</Text>
            {milestone.status === "submitted" ? (
              <Pressable
                style={[styles.button, busyMilestoneId === milestone.id && styles.buttonDisabled]}
                onPress={() => void handleApproveMilestone(milestone.id)}
                disabled={busyMilestoneId !== null}
              >
                {busyMilestoneId === milestone.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Aprobar</Text>}
              </Pressable>
            ) : null}
          </View>
        ))
      )}

      <Text style={styles.sectionLabel}>Evidencia</Text>
      {evidence.length === 0 ? (
        <Text style={styles.hint}>Todavía no hay evidencia subida para este job.</Text>
      ) : (
        <View style={styles.evidenceGrid}>
          {evidence.map((item) => (
            <Image key={item.id} source={{ uri: buildEvidenceFileUrl(item.key) }} style={styles.evidenceThumb} />
          ))}
        </View>
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
    nextAction: { fontSize: 12, fontWeight: "700", color: theme.colors.warn, marginTop: 2 },
    hint: { fontSize: 13, color: theme.colors.muted, marginBottom: theme.spacing.sm },
    sectionLabel: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase", marginTop: theme.spacing.md },
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
      marginTop: theme.spacing.sm,
    },
    cardTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.ink, flexShrink: 1 },
    button: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, padding: 12, alignItems: "center", marginTop: 4 },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: "#fff", fontWeight: "700" },
    evidenceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: theme.spacing.sm },
    evidenceThumb: { width: 88, height: 88, borderRadius: theme.radius.sm, backgroundColor: theme.colors.raised },
  });
}
