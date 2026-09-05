import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../theme/theme";

/**
 * Logout-only, same minimal pattern as ClientSettingsScreen — Worker's
 * SettingsScreen is entirely about proximityCheckInMode, which doesn't
 * apply to OPS_ADMIN either.
 */
export default function AdminSettingsScreen() {
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
