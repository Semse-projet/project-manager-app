import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

interface PermissionPrimerModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Shown once, before the very first request for location/notification
 * permissions, so the "why" isn't buried in the OS dialog's one-liner. */
export function PermissionPrimerModal({ visible, onConfirm, onCancel }: PermissionPrimerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Antes de pedir el permiso</Text>
          <Text style={styles.body}>
            Vamos a pedirte permiso de ubicación (y notificaciones) para avisarte — o iniciar el
            reloj automáticamente, según tu configuración — cuando llegues a un job o proyecto
            libre, incluso con la app cerrada. Solo se usa para esto, nunca para rastrear tu
            recorrido, y puedes desactivarlo en cualquier momento desde Ajustes.
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={onCancel}>
              <Text style={styles.secondaryButtonText}>Ahora no</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={onConfirm}>
              <Text style={styles.primaryButtonText}>Entendido</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20, gap: 14, width: "100%", maxWidth: 380 },
  title: { fontSize: 16, fontWeight: "800", color: "#111827" },
  body: { fontSize: 13, color: "#4b5563", lineHeight: 19 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
  secondaryButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  secondaryButtonText: { color: "#6b7280", fontWeight: "700", fontSize: 13 },
  primaryButton: { backgroundColor: "#2563eb", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
