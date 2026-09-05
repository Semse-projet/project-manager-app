import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../theme/theme";

/**
 * SettingsScreen (Worker) is entirely about proximityCheckInMode, a
 * field-ops/Labor Engine concept that doesn't apply to CLIENT — this is a
 * deliberately minimal, separate screen rather than a reused/branching one.
 */
export default function ClientSettingsScreen() {
  const { logout } = useAuth();
  const theme = useTheme();
  const styles = buildStyles(theme);

  return (
    <View style={styles.container}>
      <Pressable style={styles.logoutButton} onPress={() => void logout()}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: theme.colors.base },
    logoutButton: { marginTop: "auto", padding: 14, alignItems: "center" },
    logoutText: { color: theme.colors.error, fontWeight: "700" },
  });
}
