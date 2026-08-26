import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { createLead, fetchLeadStats, fetchLeads, type LeadRecordView, type LeadStats, type LeadStatus } from "../../api/contractor";
import { useTheme } from "../../theme/theme";

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  estimate_sent: "Estimado enviado",
  estimate_approved: "Estimado aprobado",
  in_progress: "En progreso",
  completed: "Completado",
  lost: "Perdido",
};

const STATUS_COLOR_KEY: Record<LeadStatus, "ok" | "error" | "warn" | "brand" | "info" | "violet"> = {
  new: "info",
  contacted: "brand",
  estimate_sent: "warn",
  estimate_approved: "violet",
  in_progress: "warn",
  completed: "ok",
  lost: "error",
};

/**
 * Fase 7c: leads list + stats (GET /v1/contractor/leads[/stats], jobs:read,
 * already granted to OPS_ADMIN, org-scoped server-side via
 * contractor.service.ts's listLeads/getStats -- unlike disputes, this
 * endpoint is NOT tenant-wide for OPS_ADMIN) plus create (POST, jobs:create,
 * also already granted). No status change, delete, or estimate/invoice
 * generation here -- see mobile-admin-contractors.spec.md §2 for why those
 * are a separate phase.
 */
export default function AdminContractorsScreen() {
  const theme = useTheme();
  const styles = buildStyles(theme);
  const [leads, setLeads] = useState<LeadRecordView[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobType, setJobType] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [leadsResult, statsResult] = await Promise.all([fetchLeads(), fetchLeadStats()]);
      setLeads(leadsResult);
      setStats(statsResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los leads.");
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const canSubmit = !saving && name.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await createLead({
        name: name.trim(),
        phone: phone.trim() || undefined,
        jobType: jobType.trim() || undefined,
      });
      setName("");
      setPhone("");
      setJobType("");
      setShowForm(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo crear el lead.");
    } finally {
      setSaving(false);
    }
  }

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "Total", value: stats.total },
      { label: "Nuevos", value: stats.new },
      { label: "En proceso", value: stats.contacted + stats.estimate_sent + stats.estimate_approved + stats.in_progress },
      { label: "Completados", value: stats.completed },
      { label: "Perdidos", value: stats.lost },
    ];
  }, [stats]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.brand} />
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
          value={name}
          onChangeText={setName}
          placeholder="Nombre del contacto"
          placeholderTextColor={theme.colors.faint}
        />

        <Text style={styles.label}>Teléfono</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+1 555 000 0000"
          placeholderTextColor={theme.colors.faint}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Rubro</Text>
        <TextInput
          style={styles.input}
          value={jobType}
          onChangeText={setJobType}
          placeholder="Electricidad, plomería, ..."
          placeholderTextColor={theme.colors.faint}
        />

        <View style={styles.rowGap}>
          <Pressable
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Crear lead</Text>}
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => setShowForm(false)}>
            <Text style={styles.secondaryButtonText}>Cancelar</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {statCards.length > 0 && (
        <View style={styles.grid}>
          {statCards.map((card) => (
            <View key={card.label} style={styles.statCard}>
              <Text style={styles.statValue}>{card.value}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable style={styles.button} onPress={() => setShowForm(true)}>
        <Text style={styles.buttonText}>+ Nuevo lead</Text>
      </Pressable>

      {leads.length === 0 ? (
        <Text style={styles.hint}>No hay leads registrados todavía.</Text>
      ) : (
        leads.map((lead) => {
          const colorKey = STATUS_COLOR_KEY[lead.status] ?? "muted";
          return (
            <View key={lead.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle} numberOfLines={1}>{lead.name}</Text>
                <View style={[styles.badge, { backgroundColor: theme.colors[colorKey] + "22" }]}>
                  <Text style={[styles.badgeText, { color: theme.colors[colorKey] }]}>
                    {STATUS_LABEL[lead.status] ?? lead.status}
                  </Text>
                </View>
              </View>
              {(lead.jobType || lead.phone) && (
                <Text style={styles.cardSub}>
                  {[lead.jobType, lead.phone].filter(Boolean).join(" · ")}
                </Text>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function buildStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: theme.spacing.lg, gap: theme.spacing.md },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    error: { color: theme.colors.error, fontSize: 13 },
    label: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, textTransform: "uppercase" },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: 12,
      fontSize: 14,
      color: theme.colors.ink,
      backgroundColor: theme.colors.surface,
    },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
    statCard: {
      width: "31%",
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 4,
    },
    statValue: { fontSize: 20, fontWeight: "800", color: theme.colors.ink },
    statLabel: { fontSize: 11, color: theme.colors.muted },
    hint: { fontSize: 13, color: theme.colors.muted, textAlign: "center", marginTop: theme.spacing.xl },
    rowGap: { flexDirection: "row", gap: 10, alignItems: "center" },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
    button: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, padding: 12, alignItems: "center" },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: "#fff", fontWeight: "700" },
    secondaryButton: { padding: 12, alignItems: "center" },
    secondaryButtonText: { color: theme.colors.muted, fontWeight: "700" },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 6,
    },
    cardTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.ink, flex: 1 },
    cardSub: { fontSize: 12, color: theme.colors.muted },
    badge: { borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { fontSize: 11, fontWeight: "700" },
  });
}
