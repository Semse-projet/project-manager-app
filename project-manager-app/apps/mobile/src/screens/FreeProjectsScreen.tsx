import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import {
  createFreeProject,
  fetchFreeProjectList,
  updateFreeProject,
  type FreeProject,
} from "../api/labor";
import { LocationPickerMap } from "../components/LocationPickerMap";

const SWATCHES = ["#2563eb", "#d97706", "#059669", "#dc2626", "#8b5cf6", "#0891b2"];

type FormState = {
  name: string;
  color: string;
  location: string;
  description: string;
  latitude?: number;
  longitude?: number;
};

const EMPTY_FORM: FormState = { name: "", color: SWATCHES[0], location: "", description: "" };

export default function FreeProjectsScreen() {
  const [projects, setProjects] = useState<FreeProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await fetchFreeProjectList());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los proyectos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function startEdit(project: FreeProject) {
    setEditingId(project.id);
    setForm({
      name: project.name,
      color: project.color || SWATCHES[0],
      location: project.location ?? "",
      description: project.description ?? "",
      latitude: project.latitude ?? undefined,
      longitude: project.longitude ?? undefined,
    });
    setShowForm(true);
  }

  async function useCurrentLocation() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setError("Necesitamos permiso de ubicación para esto.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setForm((current) => ({ ...current, latitude: position.coords.latitude, longitude: position.coords.longitude }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo obtener tu ubicación.");
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit() {
    if (saving || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const input = {
        name: form.name.trim(),
        color: form.color,
        location: form.location || undefined,
        description: form.description || undefined,
        latitude: form.latitude,
        longitude: form.longitude,
      };
      if (editingId) {
        await updateFreeProject(editingId, input);
      } else {
        await createFreeProject(input);
      }
      setShowForm(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el proyecto.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (showForm) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={(name) => setForm((current) => ({ ...current, name }))}
          placeholder="Remodelación casa Pérez..."
        />

        <Text style={styles.label}>Color</Text>
        <View style={styles.swatchRow}>
          {SWATCHES.map((swatch) => (
            <Pressable
              key={swatch}
              onPress={() => setForm((current) => ({ ...current, color: swatch }))}
              style={[styles.swatch, { backgroundColor: swatch }, form.color === swatch && styles.swatchSelected]}
            />
          ))}
        </View>

        <Text style={styles.label}>Ubicación</Text>
        <View style={styles.rowGap}>
          <TextInput
            style={[styles.input, styles.flex1]}
            value={form.location}
            onChangeText={(location) => setForm((current) => ({ ...current, location }))}
            placeholder="Opcional"
          />
          <Pressable style={styles.locateButton} onPress={() => void useCurrentLocation()} disabled={locating}>
            {locating ? <ActivityIndicator size="small" /> : <Text style={styles.locateButtonText}>📍</Text>}
          </Pressable>
        </View>

        <LocationPickerMap
          latitude={form.latitude}
          longitude={form.longitude}
          onChange={({ latitude, longitude }) => setForm((current) => ({ ...current, latitude, longitude }))}
        />
        <Text style={styles.hint}>Toca el mapa o arrastra el pin para fijar el punto exacto.</Text>

        <Text style={styles.label}>Descripción</Text>
        <TextInput
          style={styles.input}
          value={form.description}
          onChangeText={(description) => setForm((current) => ({ ...current, description }))}
          placeholder="Opcional"
        />

        <View style={styles.rowGap}>
          <Pressable
            style={[styles.button, (saving || !form.name.trim()) && styles.buttonDisabled]}
            onPress={() => void handleSubmit()}
            disabled={saving || !form.name.trim()}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{editingId ? "Guardar cambios" : "Crear proyecto"}</Text>}
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => setShowForm(false)}>
            <Text style={styles.secondaryButtonText}>Cancelar</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.button} onPress={startCreate}>
        <Text style={styles.buttonText}>+ Nuevo proyecto</Text>
      </Pressable>

      {projects.length === 0 ? (
        <Text style={styles.hint}>Aún no tienes proyectos libres.</Text>
      ) : (
        projects.map((project) => (
          <Pressable key={project.id} style={styles.card} onPress={() => startEdit(project)}>
            <View style={[styles.colorDot, { backgroundColor: project.color || SWATCHES[0] }]} />
            <View style={styles.flex1}>
              <Text style={styles.cardTitle}>{project.name}</Text>
              {project.location ? <Text style={styles.cardHint}>{project.location}</Text> : null}
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  label: { fontSize: 12, fontWeight: "700", color: "#6b7280", textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, padding: 12, fontSize: 14, color: "#111827" },
  hint: { fontSize: 12, color: "#6b7280" },
  error: { color: "#dc2626", fontSize: 13 },
  rowGap: { flexDirection: "row", gap: 10, alignItems: "center" },
  flex1: { flex: 1 },
  swatchRow: { flexDirection: "row", gap: 10 },
  swatch: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: "transparent" },
  swatchSelected: { borderColor: "#111827" },
  locateButton: { width: 48, height: 48, borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center" },
  locateButtonText: { fontSize: 18 },
  button: { backgroundColor: "#2563eb", borderRadius: 10, padding: 12, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "700" },
  secondaryButton: { padding: 12, alignItems: "center" },
  secondaryButtonText: { color: "#6b7280", fontWeight: "700" },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#f9fafb", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  cardHint: { fontSize: 12, color: "#6b7280", marginTop: 2 },
});
