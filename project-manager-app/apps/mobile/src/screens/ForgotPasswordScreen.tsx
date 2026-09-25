import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { requestPasswordReset } from "../api/auth";
import { useTheme } from "../theme/theme";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (submitting || !email.trim()) return;
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Revisa tu correo</Text>
        <Text style={styles.subtitle}>
          Si existe una cuenta con {email.trim()}, te llegará un enlace para restablecer tu
          contraseña en los próximos minutos. Abrilo desde el navegador de tu teléfono para
          completar el cambio, y después volvé acá para iniciar sesión con la contraseña nueva.
        </Text>
        <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}>
          <Text style={styles.linkButtonText}>← Volver al login</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recuperar contraseña</Text>
      <Text style={styles.subtitle}>
        Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
      </Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Correo electrónico"
        placeholderTextColor={theme.colors.faint}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <Pressable
        style={[styles.button, (submitting || !email.trim()) && styles.buttonDisabled]}
        onPress={() => void handleSubmit()}
        disabled={submitting || !email.trim()}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Enviar enlace</Text>}
      </Pressable>
      <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}>
        <Text style={styles.linkButtonText}>← Volver al login</Text>
      </Pressable>
    </View>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: theme.colors.base, gap: 12 },
    title: { fontSize: 24, fontWeight: "800", textAlign: "center", color: theme.colors.ink },
    subtitle: { fontSize: 14, color: theme.colors.muted, textAlign: "center", marginBottom: 16 },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: 14,
      fontSize: 15,
      color: theme.colors.ink,
      backgroundColor: theme.colors.surface,
    },
    button: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, padding: 14, alignItems: "center", marginTop: 8 },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    linkButton: { alignItems: "center", marginTop: 12 },
    linkButtonText: { color: theme.colors.brand, fontWeight: "600", fontSize: 13 },
  });
}
