import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BidRecordView, RatingRecordView } from "@semse/schemas";
import { fetchMyBids } from "../../api/bids";
import { fetchMyRatings } from "../../api/ratings";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../theme/theme";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import type { WorkerMoreStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<WorkerMoreStackParamList, "Review">;

const REVIEWABLE_JOB_STATUSES = ["completed", "review"];

export default function ReviewScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const { userId } = useAuth();
  const [bids, setBids] = useState<BidRecordView[]>([]);
  const [ratings, setRatings] = useState<RatingRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [myBids, myRatings] = await Promise.all([fetchMyBids(), fetchMyRatings()]);
      setBids(myBids);
      setRatings(myRatings);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar las reseñas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const given = useMemo(() => ratings.filter((r) => r.fromUser.id === userId), [ratings, userId]);
  const received = useMemo(() => ratings.filter((r) => r.toUser.id === userId), [ratings, userId]);

  const reviewable = useMemo(() => {
    const ratedJobIds = new Set(given.map((r) => r.jobId));
    return bids.filter(
      (bid) =>
        bid.status === "accepted" &&
        bid.jobStatus &&
        REVIEWABLE_JOB_STATUSES.includes(bid.jobStatus) &&
        bid.clientUserId &&
        !ratedJobIds.has(bid.jobId),
    );
  }, [bids, given]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <ErrorState message={error} /> : null}

      <Text style={styles.sectionLabel}>Por calificar</Text>
      {reviewable.length === 0 ? (
        <EmptyState title="No tienes jobs pendientes de calificar." />
      ) : (
        reviewable.map((bid) => (
          <Pressable
            key={bid.jobId}
            style={styles.card}
            onPress={() =>
              navigation.navigate("ReviewForm", {
                jobId: bid.jobId,
                jobTitle: bid.jobTitle ?? "Job",
                toUserId: bid.clientUserId!,
                toUserEmail: bid.clientEmail,
              })
            }
          >
            <Text style={styles.cardTitle}>{bid.jobTitle ?? "Job"}</Text>
            <Text style={styles.cardMeta}>Calificar a {bid.clientEmail ?? "cliente"}</Text>
          </Pressable>
        ))
      )}

      <Text style={styles.sectionLabel}>Dadas</Text>
      {given.length === 0 ? (
        <EmptyState title="Aún no has calificado a nadie." />
      ) : (
        given.map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.cardTitle}>{r.job.title}</Text>
            <Text style={styles.stars}>{"★".repeat(r.score)}{"☆".repeat(5 - r.score)}</Text>
            {r.comment ? <Text style={styles.cardMeta}>{r.comment}</Text> : null}
          </View>
        ))
      )}

      <Text style={styles.sectionLabel}>Recibidas</Text>
      {received.length === 0 ? (
        <EmptyState title="Aún no has recibido calificaciones." />
      ) : (
        received.map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.cardTitle}>{r.job.title}</Text>
            <Text style={styles.stars}>{"★".repeat(r.score)}{"☆".repeat(5 - r.score)}</Text>
            {r.comment ? <Text style={styles.cardMeta}>{r.comment}</Text> : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: theme.spacing.lg, gap: theme.spacing.sm },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    error: { color: theme.colors.error, fontSize: 13 },
    hint: { fontSize: 13, color: theme.colors.muted },
    sectionLabel: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase", marginTop: theme.spacing.md },
    card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border, gap: 4 },
    cardTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.ink },
    cardMeta: { fontSize: 12, color: theme.colors.muted },
    stars: { fontSize: 16, color: theme.colors.brand },
  });
}
