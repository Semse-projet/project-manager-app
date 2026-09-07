import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../theme/theme";
import type { WorkerMoreStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<WorkerMoreStackParamList, "MoreMenu">;

const ITEMS: { route: "FreeProjects" | "Disputes" | "Incidents" | "Travel" | "Materials" | "Rates" | "Agenda" | "Review" | "Payments" | "Prometeo"; icon: string; label: string; hint: string }[] = [
  { route: "Agenda", icon: "📅", label: "Agenda", hint: "Tus jobs activos, agrupados por fecha." },
  { route: "FreeProjects", icon: "🗂️", label: "Proyectos libres", hint: "Tus proyectos propios fuera del marketplace." },
  { route: "Disputes", icon: "⚖️", label: "Disputas", hint: "Reclamos abiertos sobre tus proyectos." },
  { route: "Incidents", icon: "⚠️", label: "Incidentes", hint: "Reporta problemas de seguridad, daños o retrasos en un job." },
  { route: "Travel", icon: "🧳", label: "Viajes", hint: "Asignaciones de viaje y gastos aprobados." },
  { route: "Materials", icon: "🧱", label: "Materiales", hint: "Solicita materiales para un job." },
  { route: "Rates", icon: "💵", label: "Tarifas", hint: "Tu tarifa por hora y margen de materiales." },
  { route: "Review", icon: "⭐", label: "Reseñas", hint: "Califica a tus clientes y revisa tu historial." },
  { route: "Payments", icon: "💳", label: "Pagos", hint: "Historial de pagos por job." },
  { route: "Prometeo", icon: "✨", label: "Prometeo", hint: "Asistente operativo con control de aprobaciones." },
];

export default function MoreScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const { logout } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {ITEMS.map((item) => (
        <Pressable key={item.route} style={styles.row} onPress={() => navigation.navigate(item.route)}>
          <Text style={styles.icon}>{item.icon}</Text>
          <View style={styles.flex1}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.hint}>{item.hint}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}

      <Pressable style={styles.row} onPress={() => navigation.navigate("Settings")}>
        <Text style={styles.icon}>⚙️</Text>
        <View style={styles.flex1}>
          <Text style={styles.label}>Ajustes</Text>
          <Text style={styles.hint}>Check-in por proximidad y otras preferencias.</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable style={styles.logoutButton} onPress={() => void logout()}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: theme.spacing.lg, gap: theme.spacing.sm },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    icon: { fontSize: 22 },
    flex1: { flex: 1 },
    label: { fontSize: 15, fontWeight: "700", color: theme.colors.ink },
    hint: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
    chevron: { fontSize: 20, color: theme.colors.faint },
    logoutButton: { marginTop: theme.spacing.lg, padding: 14, alignItems: "center" },
    logoutText: { color: theme.colors.error, fontWeight: "700" },
  });
}
