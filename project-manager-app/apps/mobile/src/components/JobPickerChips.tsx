import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { fetchMyBids } from "../api/bids";
import { useTheme } from "../theme/theme";

type JobOption = { jobId: string; jobTitle: string };

type Props = {
  selectedJobId: string;
  onSelect: (jobId: string, jobTitle: string) => void;
};

/**
 * Replaces raw "type a job ID" text fields (Incidentes/Disputas/Materiales
 * when opened without a job already in context) with a real picker over the
 * worker's own accepted jobs — never ask someone to type an ID they can't see
 * anywhere else in the app.
 */
export function JobPickerChips({ selectedJobId, onSelect }: Props) {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchMyBids()
      .then((bids) => {
        if (cancelled) return;
        const accepted = bids.filter((bid) => bid.status === "accepted");
        setJobs(accepted.map((bid) => ({ jobId: bid.jobId, jobTitle: bid.jobTitle ?? "Job" })));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <ActivityIndicator color={theme.colors.brand} style={styles.spinner} />;
  }

  if (jobs.length === 0) {
    return <Text style={styles.empty}>No tienes jobs asignados todavía.</Text>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {jobs.map((job) => {
        const selected = job.jobId === selectedJobId;
        return (
          <Pressable
            key={job.jobId}
            onPress={() => onSelect(job.jobId, job.jobTitle)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
              {job.jobTitle}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    spinner: { alignSelf: "flex-start" },
    empty: { fontSize: 12, color: theme.colors.muted },
    row: { gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      maxWidth: 180,
    },
    chipSelected: { borderColor: theme.colors.brand, backgroundColor: theme.colors.brandDim },
    chipText: { fontSize: 12, fontWeight: "600", color: theme.colors.ink },
    chipTextSelected: { color: theme.colors.brand },
  });
}
