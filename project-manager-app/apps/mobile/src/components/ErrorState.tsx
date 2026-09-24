import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/theme";

export interface ErrorStateProps {
  message: string;
  /** Extra content below the text — usually a "reintentar" button. */
  children?: React.ReactNode;
}

/**
 * Shared error panel for a failed fetch — mirrors `ErrorState` in
 * packages/ui (web), generalized from the bare `<Text style={styles.error}>`
 * pattern found in JobsListScreen and other worker screens (2026-09).
 */
export function ErrorState({ message, children }: ErrorStateProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: `${theme.colors.error}0f`, borderColor: `${theme.colors.error}33` },
      ]}
      accessibilityRole="alert"
    >
      <Ionicons name="alert-circle-outline" size={16} color={theme.colors.error} style={styles.icon} />
      <Text style={[styles.message, { color: theme.colors.error }]}>{message}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  icon: { marginTop: 1 },
  message: { flex: 1, fontSize: 13, lineHeight: 18 },
});
