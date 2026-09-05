import { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { isAuthError } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme/theme";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (submitting || !email.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (caught) {
      if (isAuthError(caught)) {
        setError(caught.message);
      } else if (caught instanceof Error) {
        setError(`No se pudo iniciar sesión: ${caught.message}`);
      } else {
        setError("No se pudo iniciar sesión.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Image source={require("../../assets/icon.png")} style={styles.logo} />
      <Text style={styles.title}>SEMSE</Text>
      <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
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
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Contraseña"
        placeholderTextColor={theme.colors.faint}
        secureTextEntry
        autoComplete="password"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={[styles.button, submitting && styles.buttonDisabled]} onPress={() => void handleSubmit()} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Ingresar</Text>}
      </Pressable>
      <Pressable style={styles.forgotLink} onPress={() => navigation.navigate("ForgotPassword")}>
        <Text style={styles.forgotLinkText}>¿Olvidaste tu contraseña?</Text>
      </Pressable>
    </View>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: theme.colors.base, gap: 12 },
    logo: { width: 88, height: 88, borderRadius: theme.radius.lg, alignSelf: "center", marginBottom: 4 },
    title: { fontSize: 28, fontWeight: "800", textAlign: "center", color: theme.colors.ink },
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
    error: { color: theme.colors.error, fontSize: 13, textAlign: "center" },
    button: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, padding: 14, alignItems: "center", marginTop: 8 },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    forgotLink: { alignItems: "center", marginTop: 4 },
    forgotLinkText: { color: theme.colors.brand, fontWeight: "600", fontSize: 13 },
  });
}
