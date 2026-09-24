import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/theme";

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** @expo/vector-icons/Ionicons glyph name, e.g. "briefcase-outline". */
  icon?: ComponentProps<typeof Ionicons>["name"];
  /** Extra content below the text — usually a button. */
  children?: React.ReactNode;
}

/**
 * Shared "nothing here yet" view for worker/client/admin lists — mirrors
 * `EmptyState` in packages/ui (web), generalized from JobsListScreen's
 * bare `<Text style={styles.hint}>` (2026-09). Native cannot share React
 * DOM components with web, so this is the RN-native equivalent, same intent.
 */
export function EmptyState({ title, description, icon = "file-tray-outline", children }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { paddingVertical: theme.spacing["4xl"] }]}>
      <Ionicons name={icon} size={32} color={theme.colors.faint} style={styles.icon} />
      <Text style={[styles.title, { color: theme.colors.ink }]}>{title}</Text>
      {description ? <Text style={[styles.description, { color: theme.colors.muted }]}>{description}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingHorizontal: 24 },
  icon: { marginBottom: 12 },
  title: { fontSize: 14, fontWeight: "700", marginBottom: 4, textAlign: "center" },
  description: { fontSize: 13, textAlign: "center", lineHeight: 18 },
});
