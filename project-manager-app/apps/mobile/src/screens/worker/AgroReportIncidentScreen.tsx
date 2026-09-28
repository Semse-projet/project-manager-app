import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { createAgroIncident, proposeAgroIntake, type AgroIntakeProposal } from "../../api/agro";
import { buildEvidenceFileUrl, presignEvidenceUpload, uploadToPresignedUrl } from "../../api/evidence";
import { useTheme } from "../../theme/theme";
import { ErrorState } from "../../components/ErrorState";
import type { AgroStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AgroStackParamList, "AgroReportIncident">;

const TYPE_LABEL: Record<string, string> = {
  ANIMAL_INJURY: "Animal lesionado",
  ANIMAL_ILLNESS_OBSERVED: "Animal enfermo",
  ANIMAL_MORTALITY: "Mortalidad animal",
  ANIMAL_ESCAPE: "Animal escapado",
  WATER_SHORTAGE: "Falta de agua",
  FEED_SHORTAGE: "Falta de alimento",
  BIOSECURITY_RISK: "Riesgo de bioseguridad",
  INFRASTRUCTURE_DAMAGE: "Daño de infraestructura",
  EQUIPMENT_FAILURE: "Falla de equipo",
  CROP_DAMAGE: "Daño de cultivo",
  PEST_OBSERVED: "Plaga observada",
  IRRIGATION_FAILURE: "Falla de riego",
  SAFETY_HAZARD: "Riesgo de seguridad",
  OTHER: "Otro",
};

const SEVERITY_LABEL: Record<string, string> = { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", CRITICAL: "Crítica" };

type PendingPhoto = { localId: string; uri: string; fileUrl?: string; status: "uploading" | "done" | "error" };

/**
 * Solo texto en este primer corte — no hay `expo-av`/`expo-audio` en el
 * proyecto mobile, así que "reportar por audio" (parte del intake aprobado)
 * queda pendiente de una decisión aparte sobre agregar esa dependencia
 * nativa (impacto en el dev-client). Las fotos sí se adjuntan, vía el mismo
 * presign→PUT que usa EvidenceCapture, pero como evidencia inline al crear
 * la incidencia — no se registran como AgroEvidenceItem antes de proponer,
 * así que esta v1 no envía `evidenceIds` a `intake/propose` ni ve
 * `visionSignals` en la propuesta.
 */
export default function AgroReportIncidentScreen({ route, navigation }: Props) {
  const { farmId, farmName } = route.params;
  const theme = useTheme();
  const styles = buildStyles(theme);

  const [text, setText] = useState("");
  const [proposing, setProposing] = useState(false);
  const [proposal, setProposal] = useState<AgroIntakeProposal | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<string>("MEDIUM");
  const [type, setType] = useState<string>("OTHER");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePropose() {
    if (proposing || !text.trim()) return;
    setProposing(true);
    setError(null);
    try {
      const { proposal: result } = await proposeAgroIntake(farmId, { text: text.trim() });
      setProposal(result);
      if (result.incident) {
        setTitle(result.incident.title);
        setDescription(result.incident.description);
        setSeverity(result.incident.suggestedSeverity);
        setType(result.incident.type);
      } else {
        setTitle(text.trim().slice(0, 200));
        setDescription(text.trim());
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo analizar el reporte.");
    } finally {
      setProposing(false);
    }
  }

  async function addPhoto(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || result.assets.length === 0) return;
    for (const asset of result.assets) {
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setPhotos((current) => [...current, { localId, uri: asset.uri, status: "uploading" }]);
      try {
        const contentType = asset.mimeType ?? "image/jpeg";
        const filename = asset.fileName ?? `incidente-${localId}.jpg`;
        const presigned = await presignEvidenceUpload({ filename, contentType, fileSizeBytes: asset.fileSize, source: "camera_capture" });
        await uploadToPresignedUrl(presigned.uploadUrl, asset.uri, contentType);
        const fileUrl = buildEvidenceFileUrl(presigned.key);
        setPhotos((current) => current.map((p) => (p.localId === localId ? { ...p, status: "done", fileUrl } : p)));
      } catch (caught) {
        setPhotos((current) => current.map((p) => (p.localId === localId ? { ...p, status: "error" } : p)));
        setError(caught instanceof Error ? caught.message : "No se pudo subir la foto.");
      }
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== "granted") { setError("Necesitamos permiso de cámara para esto."); return; }
    await addPhoto(await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 }));
  }

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") { setError("Necesitamos permiso para acceder a tus fotos."); return; }
    await addPhoto(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsMultipleSelection: true }));
  }

  async function handleConfirm() {
    if (saving || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createAgroIncident(farmId, {
        type,
        severity,
        title: title.trim(),
        description: description.trim() || undefined,
        source: "MOBILE",
        evidence: photos.filter((p) => p.status === "done" && p.fileUrl).map((p) => ({ mediaType: "PHOTO", fileUrl: p.fileUrl })),
      });
      navigation.navigate("AgroIncidents", { farmId, farmName });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear la incidencia.");
    } finally {
      setSaving(false);
    }
  }

  if (!proposal) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        {error ? <ErrorState message={error} /> : null}
        <Text style={styles.label}>¿Qué pasó en {farmName}?</Text>
        <TextInput
          style={styles.textArea}
          value={text}
          onChangeText={setText}
          placeholder="Ej: Al lote 15 le falta agua desde ayer."
          placeholderTextColor={theme.colors.faint}
          multiline
        />
        <Pressable
          style={[styles.button, (proposing || !text.trim()) && styles.buttonDisabled]}
          onPress={() => void handlePropose()}
          disabled={proposing || !text.trim()}
        >
          {proposing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Analizar</Text>}
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <ErrorState message={error} /> : null}

      <View style={styles.reviewBanner}>
        <Text style={styles.reviewBannerText}>{proposal.disclaimer}</Text>
      </View>

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.chipRow}>
        {Object.keys(TYPE_LABEL).map((key) => (
          <Pressable key={key} onPress={() => setType(key)} style={[styles.chip, type === key && styles.chipSelected]}>
            <Text style={[styles.chipText, type === key && styles.chipTextSelected]}>{TYPE_LABEL[key]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Severidad sugerida (confírmala o ajústala)</Text>
      <View style={styles.chipRow}>
        {Object.keys(SEVERITY_LABEL).map((key) => (
          <Pressable key={key} onPress={() => setSeverity(key)} style={[styles.chip, severity === key && styles.chipSelected]}>
            <Text style={[styles.chipText, severity === key && styles.chipTextSelected]}>{SEVERITY_LABEL[key]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Título</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor={theme.colors.faint} />

      <Text style={styles.label}>Descripción</Text>
      <TextInput style={styles.textArea} value={description} onChangeText={setDescription} multiline placeholderTextColor={theme.colors.faint} />

      <Text style={styles.label}>Fotos (opcional)</Text>
      <View style={styles.buttonRow}>
        <Pressable style={styles.secondaryButton} onPress={() => void takePhoto()}>
          <Text style={styles.secondaryButtonText}>📷 Tomar foto</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => void pickPhoto()}>
          <Text style={styles.secondaryButtonText}>🖼️ Galería</Text>
        </Pressable>
      </View>
      {photos.length > 0 ? (
        <View style={styles.thumbRow}>
          {photos.map((photo) => (
            <View key={photo.localId} style={styles.thumbWrap}>
              <Image source={{ uri: photo.uri }} style={styles.thumb} />
              {photo.status === "uploading" ? (
                <View style={styles.thumbOverlay}><ActivityIndicator color="#fff" size="small" /></View>
              ) : null}
              {photo.status === "error" ? (
                <View style={[styles.thumbOverlay, styles.thumbOverlayError]}><Text style={styles.thumbErrorText}>⚠</Text></View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {proposal.duplicateCandidates?.length ? (
        <View style={styles.duplicateBanner}>
          <Text style={styles.duplicateBannerText}>
            Puede que ya exista una incidencia parecida: {proposal.duplicateCandidates.map((d) => d.title).join(", ")}
          </Text>
        </View>
      ) : null}

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.button, (saving || !title.trim()) && styles.buttonDisabled]}
          onPress={() => void handleConfirm()}
          disabled={saving || !title.trim()}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirmar y crear</Text>}
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => setProposal(null)}>
          <Text style={styles.secondaryButtonText}>Volver a escribir</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: theme.spacing.lg, gap: theme.spacing.md },
    label: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase" },
    input: {
      borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
      padding: 12, fontSize: 14, color: theme.colors.ink, backgroundColor: theme.colors.surface,
    },
    textArea: {
      borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
      padding: 12, fontSize: 14, color: theme.colors.ink, backgroundColor: theme.colors.surface, minHeight: 90, textAlignVertical: "top",
    },
    reviewBanner: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12, backgroundColor: theme.colors.raised },
    reviewBannerText: { fontSize: 12, color: theme.colors.muted },
    duplicateBanner: { borderWidth: 1, borderColor: theme.colors.warn, borderRadius: theme.radius.md, padding: 12, backgroundColor: theme.colors.warn + "15" },
    duplicateBannerText: { fontSize: 12, color: theme.colors.warn, fontWeight: "600" },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.border },
    chipSelected: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
    chipText: { fontSize: 12, fontWeight: "600", color: theme.colors.ink },
    chipTextSelected: { color: "#fff" },
    buttonRow: { flexDirection: "row", gap: 10, alignItems: "center" },
    button: { flex: 1, backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, padding: 12, alignItems: "center" },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: "#fff", fontWeight: "700" },
    secondaryButton: { flex: 1, padding: 12, alignItems: "center", borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md },
    secondaryButtonText: { color: theme.colors.muted, fontWeight: "700", fontSize: 13 },
    thumbRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    thumbWrap: { width: 72, height: 72, borderRadius: theme.radius.sm, overflow: "hidden" },
    thumb: { width: "100%", height: "100%" },
    thumbOverlay: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
    thumbOverlayError: { backgroundColor: "rgba(220,38,38,0.55)" },
    thumbErrorText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  });
}
