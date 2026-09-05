import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EvidenceRecordView } from "@semse/schemas";
import { buildEvidenceFileUrl, fetchEvidenceByJob } from "../../api/evidence";
import { EvidenceCapture } from "../../components/EvidenceCapture";
import { useTheme } from "../../theme/theme";
import type { WorkerJobsStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<WorkerJobsStackParamList, "Evidence">;

export default function EvidenceScreen({ route }: Props) {
  const { jobId, jobTitle } = route.params;
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [evidence, setEvidence] = useState<EvidenceRecordView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEvidence(await fetchEvidenceByJob(jobId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar la evidencia.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={evidence}
      keyExtractor={(item) => item.id}
      numColumns={3}
      columnWrapperStyle={styles.grid}
      ListHeaderComponent={
        <View style={styles.header}>
          {jobTitle ? <Text style={styles.title}>{jobTitle}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <EvidenceCapture target={{ jobId }} onUploaded={() => void load()} />
          {loading ? <ActivityIndicator color={theme.colors.brand} style={styles.spinner} /> : null}
          <Text style={styles.sectionLabel}>Evidencia subida</Text>
        </View>
      }
      ListEmptyComponent={!loading ? <Text style={styles.hint}>Aún no hay evidencia para este job.</Text> : null}
      renderItem={({ item }) => (
        <View style={styles.thumbWrap}>
          <Image source={{ uri: buildEvidenceFileUrl(item.key) }} style={styles.thumb} />
        </View>
      )}
    />
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: theme.spacing.lg, gap: theme.spacing.sm },
    header: { gap: theme.spacing.md, marginBottom: theme.spacing.sm },
    title: { fontSize: 18, fontWeight: "800", color: theme.colors.ink },
    error: { color: theme.colors.error, fontSize: 13 },
    hint: { fontSize: 13, color: theme.colors.muted, textAlign: "center", marginTop: theme.spacing.xl },
    sectionLabel: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase" },
    spinner: { marginVertical: theme.spacing.sm },
    grid: { gap: theme.spacing.sm },
    thumbWrap: {
      flex: 1 / 3,
      aspectRatio: 1,
      margin: 4,
      borderRadius: theme.radius.sm,
      overflow: "hidden",
      backgroundColor: theme.colors.raised,
    },
    thumb: { width: "100%", height: "100%" },
  });
}
