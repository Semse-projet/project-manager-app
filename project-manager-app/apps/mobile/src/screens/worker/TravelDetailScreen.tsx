import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { TravelAssignmentRecordView } from "@semse/schemas";
import { fetchTravelAssignmentDetail } from "../../api/travel";
import { useTheme } from "../../theme/theme";
import { formatCurrency } from "../../utils/format";
import type { WorkerMoreStackParamList } from "../../navigation/types";
import { TRAVEL_STATUS_LABEL } from "./jobStatus";

type Props = NativeStackScreenProps<WorkerMoreStackParamList, "TravelDetail">;

export default function TravelDetailScreen({ route }: Props) {
  const { travelId } = route.params;
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [assignment, setAssignment] = useState<TravelAssignmentRecordView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAssignment(await fetchTravelAssignmentDetail(travelId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el viaje.");
    } finally {
      setLoading(false);
    }
  }, [travelId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  if (!assignment) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? "Viaje no encontrado."}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.title}>{assignment.destinationCity}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{TRAVEL_STATUS_LABEL[assignment.status] ?? assignment.status}</Text>
      </View>

      <Text style={styles.meta}>📅 {assignment.departureDate}{assignment.returnDate ? ` – ${assignment.returnDate}` : ""}</Text>
      {assignment.estimatedDays != null ? <Text style={styles.meta}>Duración estimada: {assignment.estimatedDays} días</Text> : null}
      {assignment.mainTransportMode ? <Text style={styles.meta}>Transporte: {assignment.mainTransportMode}</Text> : null}
      <Text style={styles.meta}>Personas: {assignment.headcount}</Text>
      <Text style={styles.meta}>Alojamiento requerido: {assignment.requiresLodging ? "Sí" : "No"}</Text>
      {assignment.approvedBudget != null ? (
        <Text style={styles.meta}>Presupuesto aprobado: {formatCurrency(assignment.approvedBudget)}</Text>
      ) : null}
      {assignment.notes ? (
        <>
          <Text style={styles.sectionLabel}>Notas</Text>
          <Text style={styles.body}>{assignment.notes}</Text>
        </>
      ) : null}
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
    meta: { fontSize: 13, color: theme.colors.muted },
    sectionLabel: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase", marginTop: theme.spacing.sm },
    body: { fontSize: 14, color: theme.colors.ink, lineHeight: 20 },
  });
}
