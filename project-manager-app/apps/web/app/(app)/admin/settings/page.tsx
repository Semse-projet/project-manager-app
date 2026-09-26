"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useLanguage } from "../../../../lib/language-context";
import { Settings, Bell, Shield, Globe, Key, MapPin, Save, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";
import {
  fetchAdminIntegrationStatuses,
  fetchAdminSettings,
  updateAdminSettings,
  verifyAdminIntegration,
} from "../../../semse-api";
import type { AdminIntegrationId, AdminIntegrationStatus, AdminSettings } from "@semse/schemas";
import styles from "./settings.module.css";

type SettingSection = "general" | "notifications" | "security" | "integrations" | "time-tracker";

const SECTIONS: { id: SettingSection; label: string; labelEn: string; icon: typeof Settings }[] = [
  { id: "general",       label: "General",        labelEn: "General",        icon: Globe },
  { id: "notifications", label: "Notificaciones", labelEn: "Notificaciones",  icon: Bell },
  { id: "security",      label: "Seguridad",       labelEn: "Seguridad",      icon: Shield },
  { id: "integrations",  label: "Integraciones",   labelEn: "Integraciones",  icon: Key },
  { id: "time-tracker",  label: "Time Tracker",    labelEn: "Time Tracker",   icon: MapPin },
];

const DEFAULT_SETTINGS: AdminSettings = {
  language: "es",
  timezone: "America/Mexico_City",
  notifications: { email: true, disputes: true, payments: true, system: false },
  security: { mfaRequired: false, sessionLog: true },
  integrations: { openai: false, github: false, checks: {} },
  proximity: { radiusMeters: 150, cooldownMinutes: 20 },
};

export default function AdminSettingsPage() {
  const { t } = useLanguage();
  const [active, setActive] = useState<SettingSection>("general");
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [integrationStatuses, setIntegrationStatuses] = useState<AdminIntegrationStatus[]>([]);
  const [integrationLoading, setIntegrationLoading] = useState(true);
  const [verifyingIntegration, setVerifyingIntegration] = useState<AdminIntegrationId | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchAdminSettings()
      .then((data) => {
        if (data) setSettings(data);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadIntegrationStatuses = useCallback(async () => {
    setIntegrationLoading(true);
    try {
      setIntegrationStatuses(await fetchAdminIntegrationStatuses());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el estado de las integraciones");
    } finally {
      setIntegrationLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIntegrationStatuses();
  }, [loadIntegrationStatuses]);

  const handleVerifyIntegration = useCallback(async (integrationId: AdminIntegrationId) => {
    setVerifyingIntegration(integrationId);
    setError(null);
    try {
      const verified = await verifyAdminIntegration(integrationId);
      setIntegrationStatuses((current) => current.map((item) => item.id === integrationId ? verified : item));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo probar la conexión");
    } finally {
      setVerifyingIntegration(null);
    }
  }, []);

  const persist = useCallback(async (next: AdminSettings) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    setSaveStatus("idle");
    try {
      const saved = await updateAdminSettings(next);
      setSettings(saved);
      setSaveStatus("saved");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error guardando ajustes";
      setSaveStatus("error");
      setError(message);
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback((patch: Partial<AdminSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(next), 600);
      return next;
    });
  }, [persist]);

  const updateNested = useCallback(<K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) => {
    setSettings((current) => {
      const next = { ...current, [key]: value } as AdminSettings;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persist(next), 600);
      return next;
    });
  }, [persist]);

  return (
    <main className={styles.page} style={{ color: "var(--ink)" }}>
      <AdminPageHeader
        title={t("page.settings")}
        subtitle="Ajustes del sistema SEMSE Project"
        icon={Settings}
        iconColor="#818cf8"
        iconBg="rgba(99,102,241,0.15)"
        actions={<NotificationBanner audience="admin" />}
      />

      {error && (
        <div style={{ margin: "16px 0", padding: "12px 16px", borderRadius: "12px", background: "rgba(239,68,68,0.12)", color: "#f87171", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className={styles.layout}>
        <nav className={styles.nav}>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px 18px",
                  border: "none",
                  background: isActive ? "rgba(99,102,241,0.12)" : "transparent",
                  color: isActive ? "#818cf8" : "var(--ink)",
                  fontWeight: isActive ? 700 : 400,
                  cursor: "pointer",
                  borderLeft: isActive ? "3px solid #818cf8" : "3px solid transparent",
                }}
              >
                <Icon size={16} />
                {s.label}
              </button>
            );
          })}
        </nav>

        <div className={styles.panel}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
              <Loader2 size={16} className="animate-spin" /> Cargando ajustes…
            </div>
          ) : (
            <>
              {active === "general" && <GeneralSection value={settings} onChange={update} />}
              {active === "notifications" && <NotificationsSection value={settings.notifications} onChange={(v) => updateNested("notifications", v)} />}
              {active === "security" && <SecuritySection value={settings.security} onChange={(v) => updateNested("security", v)} />}
              {active === "integrations" && (
                <IntegrationsSection
                  value={settings.integrations}
                  statuses={integrationStatuses}
                  loading={integrationLoading}
                  verifying={verifyingIntegration}
                  onChange={(v) => updateNested("integrations", v)}
                  onRefresh={loadIntegrationStatuses}
                  onVerify={handleVerifyIntegration}
                />
              )}
              {active === "time-tracker" && <TimeTrackerSection value={settings.proximity} onChange={(v) => updateNested("proximity", v)} />}

              <div style={{ marginTop: "24px", display: "flex", alignItems: "center", gap: "12px", justifyContent: "flex-end" }}>
                {saving ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--muted)", fontSize: "0.875rem" }}>
                    <Loader2 size={14} className="animate-spin" /> Guardando…
                  </span>
                ) : saveStatus === "saved" ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#34d399", fontSize: "0.875rem" }}>
                    <Save size={14} /> Guardado
                  </span>
                ) : saveStatus === "error" ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f87171", fontSize: "0.875rem" }}>
                    <AlertCircle size={14} /> Error al guardar
                  </span>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={styles.settingRow}>
      <div style={{ flex: 1, paddingRight: "24px" }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        {description && <div style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: "4px" }}>{description}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 999,
        border: "none",
        background: checked ? "#6366f1" : "var(--border)",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute",
        top: 3,
        left: checked ? 23 : 3,
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: "#fff",
        transition: "left 0.2s",
      }} />
    </button>
  );
}

function GeneralSection({ value, onChange }: { value: AdminSettings; onChange: (patch: Partial<AdminSettings>) => void }) {
  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>General</h2>
      <SettingRow label="Idioma de interfaz" description="Afecta etiquetas y textos del panel administrativo">
        <select
          value={value.language}
          onChange={(e) => onChange({ language: e.target.value as "es" | "en" })}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--ink)" }}
        >
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </SettingRow>
      <SettingRow label="Zona horaria" description="Usada para timestamps en reportes y logs">
        <select
          value={value.timezone}
          onChange={(e) => onChange({ timezone: e.target.value })}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--ink)" }}
        >
          <option value="America/Mexico_City">Ciudad de México (UTC-6)</option>
          <option value="America/New_York">New York (UTC-5)</option>
          <option value="UTC">UTC</option>
        </select>
      </SettingRow>
      <SettingRow label="Versión del sistema" description="SEMSE Project — monorepo">
        <span style={{ color: "var(--muted)", fontFamily: "monospace" }}>v0.1.0-dev</span>
      </SettingRow>
    </div>
  );
}

function NotificationsSection({ value, onChange }: { value: AdminSettings["notifications"]; onChange: (v: AdminSettings["notifications"]) => void }) {
  const update = (key: keyof AdminSettings["notifications"]) => (checked: boolean) => onChange({ ...value, [key]: checked });
  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Notificaciones</h2>
      <SettingRow label="Alertas por correo" description="Recibe resúmenes diarios de actividad">
        <Toggle checked={value.email} onChange={update("email")} />
      </SettingRow>
      <SettingRow label="Disputas escaladas" description="Notificación inmediata al abrir una disputa">
        <Toggle checked={value.disputes} onChange={update("disputes")} />
      </SettingRow>
      <SettingRow label="Eventos de pago" description="Liberaciones de escrow y cargos fallidos">
        <Toggle checked={value.payments} onChange={update("payments")} />
      </SettingRow>
      <SettingRow label="Eventos de sistema" description="Deployments, migraciones y errores críticos">
        <Toggle checked={value.system} onChange={update("system")} />
      </SettingRow>
    </div>
  );
}

function SecuritySection({ value, onChange }: { value: AdminSettings["security"]; onChange: (v: AdminSettings["security"]) => void }) {
  const update = (key: keyof AdminSettings["security"]) => (checked: boolean) => onChange({ ...value, [key]: checked });
  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Seguridad</h2>
      <SettingRow
        label="Autenticación de dos factores"
        description={
          <>
            Requiere TOTP al iniciar sesión como administrador.
            <br />
            <span style={{ color: "#fbbf24" }}>Se guarda la preferencia; el enforcement real de TOTP requiere configuración adicional del servidor de autenticación.</span>
          </>
        }
      >
        <Toggle checked={value.mfaRequired} onChange={update("mfaRequired")} />
      </SettingRow>
      <SettingRow
        label="Registro de sesiones"
        description={
          <>
            Guarda IP y user-agent por cada login.
            <br />
            <span style={{ color: "#fbbf24" }}>Preferencia persistente; aplica si el middleware de sesiones está configurado para registrar estos datos.</span>
          </>
        }
      >
        <Toggle checked={value.sessionLog} onChange={update("sessionLog")} />
      </SettingRow>
      <SettingRow label="Tiempo de sesión" description="Las sesiones expiran tras inactividad">
        <span style={{ color: "var(--muted)" }}>8 horas</span>
      </SettingRow>
      <SettingRow label="Versión de sesión" description="Esquema de cookie actual">
        <span style={{ fontFamily: "monospace", color: "var(--muted)" }}>semse_session v1</span>
      </SettingRow>
    </div>
  );
}

const INTEGRATION_STATE_LABELS: Record<AdminIntegrationStatus["state"], string> = {
  UNCONFIGURED: "Sin configurar",
  SIMULATION: "Simulación",
  CONFIGURED_UNVERIFIED: "Configurada sin verificar",
  VERIFIED: "Verificada",
  ERROR: "Con error",
};

const INTEGRATION_STATE_COLORS: Record<AdminIntegrationStatus["state"], string> = {
  UNCONFIGURED: "#94a3b8",
  SIMULATION: "#fbbf24",
  CONFIGURED_UNVERIFIED: "#60a5fa",
  VERIFIED: "#34d399",
  ERROR: "#f87171",
};

function IntegrationsSection({
  value,
  statuses,
  loading,
  verifying,
  onChange,
  onRefresh,
  onVerify,
}: {
  value: AdminSettings["integrations"];
  statuses: AdminIntegrationStatus[];
  loading: boolean;
  verifying: AdminIntegrationId | null;
  onChange: (v: AdminSettings["integrations"]) => void;
  onRefresh: () => Promise<void>;
  onVerify: (integrationId: AdminIntegrationId) => Promise<void>;
}) {
  const update = (key: "openai" | "github") => (checked: boolean) => onChange({ ...value, [key]: checked });
  return (
    <div>
      <div className={styles.integrationHeader}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Integraciones externas</h2>
          <p style={{ color: "var(--muted)", margin: "6px 0 0", fontSize: "0.9rem" }}>
            Los interruptores habilitan una función para este tenant. El estado indica si el proveedor externo está realmente conectado.
          </p>
        </div>
        <button className={styles.secondaryButton} onClick={() => void onRefresh()} disabled={loading}>
          <RefreshCw size={15} className={loading ? "animate-spin" : undefined} />
          Actualizar
        </button>
      </div>

      {loading && statuses.length === 0 ? (
        <div className={styles.integrationLoading}><Loader2 size={17} className="animate-spin" /> Comprobando configuración…</div>
      ) : statuses.length === 0 ? (
        <div className={styles.integrationLoading}>No se pudo obtener el estado de las integraciones.</div>
      ) : (
        <div className={styles.integrationList}>
          {statuses.map((integration) => {
            const color = INTEGRATION_STATE_COLORS[integration.state];
            const isVerifying = verifying === integration.id;
            return (
              <section key={integration.id} className={styles.integrationItem} aria-labelledby={`integration-${integration.id}`}>
                <div className={styles.integrationTopline}>
                  <div>
                    <h3 id={`integration-${integration.id}`} style={{ margin: 0, fontSize: "1rem" }}>{integration.label}</h3>
                    <p style={{ color: "var(--muted)", margin: "5px 0 0", fontSize: "0.85rem" }}>{integration.purpose}</p>
                  </div>
                  <span className={styles.statusBadge} style={{ color, borderColor: `${color}66`, background: `${color}14` }}>
                    {INTEGRATION_STATE_LABELS[integration.state]}
                  </span>
                </div>

                <p className={styles.integrationMessage}>{integration.message}</p>

                {integration.missingVariables.length > 0 && (
                  <div className={styles.variableList}>
                    {integration.missingVariables.map((name) => <code key={name}>{name}</code>)}
                  </div>
                )}

                <div className={styles.integrationActions}>
                  {integration.enabledForTenant !== null && (
                    <label className={styles.tenantToggle}>
                      <Toggle checked={value[integration.id as "openai" | "github"]} onChange={update(integration.id as "openai" | "github")} />
                      <span>Habilitada para este tenant</span>
                    </label>
                  )}
                  <button
                    className={styles.verifyButton}
                    onClick={() => void onVerify(integration.id)}
                    disabled={!integration.canVerify || isVerifying}
                  >
                    {isVerifying ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                    {isVerifying ? "Probando…" : "Probar conexión"}
                  </button>
                </div>

                {integration.checkedAt && (
                  <div className={styles.checkedAt}>Última prueba: {new Date(integration.checkedAt).toLocaleString()}</div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TimeTrackerSection({ value, onChange }: { value: AdminSettings["proximity"]; onChange: (v: AdminSettings["proximity"]) => void }) {
  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Time Tracker — check-in por proximidad</h2>
      <SettingRow
        label="Radio de detección"
        description="Qué tan cerca (en metros) debe estar un trabajador de un job o proyecto libre para que se le sugiera (o inicie) el reloj."
      >
        <input
          type="number"
          min={10}
          max={2000}
          step={10}
          value={value.radiusMeters}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            if (Number.isFinite(parsed)) onChange({ ...value, radiusMeters: parsed });
          }}
          style={{ width: 100, padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--ink)" }}
        />
      </SettingRow>
      <SettingRow
        label="Cooldown"
        description="Minutos antes de volver a sugerir el mismo sitio, tras descartarlo o iniciar el reloj."
      >
        <input
          type="number"
          min={1}
          max={240}
          step={1}
          value={value.cooldownMinutes}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            if (Number.isFinite(parsed)) onChange({ ...value, cooldownMinutes: parsed });
          }}
          style={{ width: 100, padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--ink)" }}
        />
      </SettingRow>
    </div>
  );
}
