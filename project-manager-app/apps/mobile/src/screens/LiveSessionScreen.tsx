import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { LiveSessionRecordView, LiveSessionTransitionAction } from "@semse/schemas";
import {
  getLiveSession,
  getLiveSessionMediaToken,
  markLiveSessionReady,
  transitionLiveSession,
} from "../api/liveSessions";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme/theme";
import type { WorkerMoreStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<WorkerMoreStackParamList, "LiveSession">;

const POLL_MS = 4000;

/** Expo Go no puede cargar el SDK nativo de LiveKit (dev/prod build only). */
const IS_EXPO_GO = Constants.appOwnership === "expo";

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Solicitada",
  PERMISSION_PENDING: "Esperando permisos",
  CONNECTING: "Conectando…",
  ACTIVE: "En vivo",
  PAUSED: "En pausa",
  ENDING: "Finalizando…",
  ENDED: "Finalizada",
  CANCELLED: "Cancelada",
  FAILED: "Falló",
};

const TERMINAL = new Set(["ENDED", "CANCELLED", "FAILED"]);

export default function LiveSessionScreen({ route }: Props) {
  const { sessionId } = route.params;
  const theme = useTheme();
  const styles = buildStyles(theme);
  const { userId } = useAuth();

  const [session, setSession] = useState<LiveSessionRecordView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      setSession(await getLiveSession(sessionId));
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error && /not found/i.test(cause.message)
          ? "Esta sesión no está disponible."
          : cause instanceof Error
            ? cause.message
            : "No se pudo cargar la sesión.",
      );
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
    // v1: polling en vez de SSE nativo (react-native-sse) — ver spec §5.
    pollRef.current = setInterval(() => void load(), POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  useEffect(() => {
    if (session && TERMINAL.has(session.status) && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      setMediaReady(false);
    }
  }, [session]);

  const act = async (label: string, fn: () => Promise<LiveSessionRecordView>) => {
    if (busy) return;
    setBusy(label);
    try {
      setSession(await fn());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La acción no se pudo completar.");
    } finally {
      setBusy(null);
    }
  };

  const doTransition = (action: LiveSessionTransitionAction) =>
    act(action, () => transitionLiveSession(sessionId, action, session!.version));

  const doReady = () => act("ready", () => markLiveSessionReady(sessionId, session!.version));

  const joinMedia = async () => {
    if (IS_EXPO_GO) {
      Alert.alert(
        "Video no disponible en Expo Go",
        "El video en vivo necesita la app instalada (build de desarrollo o de tienda), no funciona dentro de Expo Go.",
      );
      return;
    }
    setBusy("join");
    try {
      await getLiveSessionMediaToken(sessionId); // valida estado/expiración/participante en el backend
      setMediaReady(true);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo obtener el acceso al video.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  if (error && !session) {
    return (
      <View style={styles.center}>
        <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
      </View>
    );
  }

  const s = session!;
  const isOwner = s.createdById === userId;
  const isTerminal = TERMINAL.has(s.status);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.status}>{STATUS_LABEL[s.status] ?? s.status}</Text>
        <Text style={styles.meta}>
          {s.purpose === "inspection" ? "Inspección remota" : "Asistencia guiada"} ·{" "}
          {s.scopeType === "job" ? "Job" : "Proyecto"} {s.scopeId}
        </Text>
        {s.expiresAt ? (
          <Text style={styles.meta}>Expira: {new Date(s.expiresAt).toLocaleString()}</Text>
        ) : null}
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      {!isTerminal && (
        <View style={styles.actions}>
          {s.status === "REQUESTED" && !isOwner && (
            <Btn label="Aceptar" onPress={() => doTransition("accept")} busy={busy} theme={theme} />
          )}
          {s.status === "PERMISSION_PENDING" && (
            <Btn label="Estoy listo (cámara/mic)" onPress={doReady} busy={busy} theme={theme} />
          )}
          {(s.status === "CONNECTING" || s.status === "ACTIVE" || s.status === "PAUSED") && (
            <Btn
              label={mediaReady ? "Video conectado" : "Unirse al video"}
              onPress={joinMedia}
              busy={busy}
              disabled={mediaReady}
              theme={theme}
            />
          )}
          {s.status === "ACTIVE" && (
            <Btn label="Pausar" onPress={() => doTransition("pause")} busy={busy} theme={theme} />
          )}
          {s.status === "PAUSED" && (
            <Btn label="Reanudar" onPress={() => doTransition("resume")} busy={busy} theme={theme} />
          )}
          {(s.status === "ACTIVE" || s.status === "PAUSED") && (
            <Btn label="Finalizar" onPress={() => doTransition("end")} busy={busy} variant="danger" theme={theme} />
          )}
          {isOwner && ["REQUESTED", "PERMISSION_PENDING", "CONNECTING"].includes(s.status) && (
            <Btn label="Cancelar" onPress={() => doTransition("cancel")} busy={busy} variant="danger" theme={theme} />
          )}
        </View>
      )}

      {mediaReady && (
        <View style={styles.mediaBox}>
          <Text style={styles.mediaText}>
            Acceso al video obtenido. El componente de video en vivo requiere el
            SDK nativo de LiveKit (build de desarrollo) — pendiente de integrar.
          </Text>
        </View>
      )}

      {IS_EXPO_GO && (
        <Text style={styles.degraded}>
          Estás en Expo Go: podés seguir el estado de la sesión, pero el video en
          vivo sólo funciona en la app instalada.
        </Text>
      )}

      {isTerminal && (
        <Text style={styles.meta}>La sesión terminó. No hay más acciones disponibles.</Text>
      )}
    </ScrollView>
  );
}

function Btn({
  label,
  onPress,
  busy,
  disabled,
  variant,
  theme,
}: {
  label: string;
  onPress: () => void;
  busy: string | null;
  disabled?: boolean;
  variant?: "danger";
  theme: ReturnType<typeof useTheme>;
}) {
  const styles = buildStyles(theme);
  const isDisabled = !!busy || !!disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        variant === "danger" && styles.buttonDanger,
        isDisabled && styles.disabled,
      ]}
    >
      {busy ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: theme.spacing.lg, gap: theme.spacing.md },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.lg },
    hero: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 4,
    },
    status: { color: theme.colors.ink, fontSize: 22, fontWeight: "800" },
    meta: { color: theme.colors.muted, fontSize: 13 },
    actions: { gap: theme.spacing.sm },
    button: {
      backgroundColor: theme.colors.brand,
      borderRadius: theme.radius.md,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.lg,
    },
    buttonDanger: { backgroundColor: theme.colors.error },
    disabled: { opacity: 0.5 },
    buttonText: { color: "#ffffff", fontWeight: "800" },
    error: { color: theme.colors.error },
    degraded: { color: theme.colors.muted, fontSize: 13, fontStyle: "italic" },
    mediaBox: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    mediaText: { color: theme.colors.ink, lineHeight: 20 },
  });
}
