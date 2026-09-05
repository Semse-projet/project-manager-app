import { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { EvidenceKind } from "@semse/schemas";
import { presignEvidenceUpload, registerEvidence, uploadToPresignedUrl, type RegisteredEvidence } from "../api/evidence";
import { useTheme } from "../theme/theme";

type EvidenceTarget =
  | { jobId: string; projectId?: undefined; milestoneId?: undefined }
  | { projectId: string; jobId?: undefined; milestoneId?: undefined }
  | { milestoneId: string; jobId?: undefined; projectId?: undefined };

type CapturedItem = {
  localId: string;
  uri: string;
  status: "uploading" | "done" | "error";
  error?: string;
};

type Props = {
  target: EvidenceTarget;
  onUploaded?: (evidence: RegisteredEvidence) => void;
};

/**
 * Shared camera/gallery capture + upload flow, reused by Worker (Fase 4) and
 * Client (Fase 6) evidence screens. Follows apps/api's presign -> PUT -> register
 * contract (evidence.controller.ts) — no multipart, single PUT only (fine for
 * phone photos; the >25MB multipart path is deferred until a real need shows up).
 */
export function EvidenceCapture({ target, onUploaded }: Props) {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [items, setItems] = useState<CapturedItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handlePicked(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || result.assets.length === 0) return;
    setError(null);

    for (const asset of result.assets) {
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setItems((current) => [...current, { localId, uri: asset.uri, status: "uploading" }]);

      try {
        const kind: EvidenceKind = asset.type === "video" ? "VIDEO" : "PHOTO";
        const contentType = asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg");
        const filename = asset.fileName ?? `evidence-${localId}.${asset.type === "video" ? "mp4" : "jpg"}`;

        const presigned = await presignEvidenceUpload({
          filename,
          contentType,
          fileSizeBytes: asset.fileSize,
          source: "camera_capture",
        });
        await uploadToPresignedUrl(presigned.uploadUrl, asset.uri, contentType);
        const evidence = await registerEvidence({
          ...target,
          key: presigned.key,
          kind,
          filename,
        });

        setItems((current) =>
          current.map((item) => (item.localId === localId ? { ...item, status: "done" } : item)),
        );
        onUploaded?.(evidence);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "No se pudo subir la evidencia.";
        setItems((current) =>
          current.map((item) => (item.localId === localId ? { ...item, status: "error", error: message } : item)),
        );
        setError(message);
      }
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== "granted") {
      setError("Necesitamos permiso de cámara para esto.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 });
    await handlePicked(result);
  }

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      setError("Necesitamos permiso para acceder a tus fotos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsMultipleSelection: true,
    });
    await handlePicked(result);
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.buttonRow}>
        <Pressable style={styles.button} onPress={() => void takePhoto()}>
          <Text style={styles.buttonText}>📷 Tomar foto</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => void pickFromLibrary()}>
          <Text style={styles.buttonText}>🖼️ Galería</Text>
        </Pressable>
      </View>

      {items.length > 0 ? (
        <View style={styles.thumbRow}>
          {items.map((item) => (
            <View key={item.localId} style={styles.thumbWrap}>
              <Image source={{ uri: item.uri }} style={styles.thumb} />
              {item.status === "uploading" ? (
                <View style={styles.thumbOverlay}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              ) : null}
              {item.status === "error" ? (
                <View style={[styles.thumbOverlay, styles.thumbOverlayError]}>
                  <Text style={styles.thumbErrorText}>⚠</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { gap: 12 },
    error: { color: theme.colors.error, fontSize: 13 },
    buttonRow: { flexDirection: "row", gap: 10 },
    button: {
      flex: 1,
      backgroundColor: theme.colors.brand,
      borderRadius: theme.radius.md,
      paddingVertical: 12,
      alignItems: "center",
    },
    buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    thumbRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    thumbWrap: { width: 72, height: 72, borderRadius: theme.radius.sm, overflow: "hidden" },
    thumb: { width: "100%", height: "100%" },
    thumbOverlay: {
      position: "absolute",
      inset: 0,
      backgroundColor: "rgba(0,0,0,0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    thumbOverlayError: { backgroundColor: "rgba(220,38,38,0.55)" },
    thumbErrorText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  });
}
