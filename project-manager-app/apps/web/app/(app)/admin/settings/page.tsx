"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useLanguage } from "../../../../lib/language-context";
import { Settings, Bell, Shield, Globe, Database, Key, Save, AlertCircle, Loader2 } from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";
import { fetchAdminSettings, updateAdminSettings } from "../../../semse-api";
import type { AdminSettings } from "@semse/schemas";

const spinStyle = { animation: "spin 1s linear infinite" };

type SettingSection = "general" | "notifications" | "security" | "integrations";

const SECTIONS: { id: SettingSection; label: string; labelEn: string; icon: typeof Settings }[] = [
  { id: "general",       label: "General",        labelEn: "General",        icon: Globe },
  { id: "notifications", label: "Notificaciones", labelEn: "Notificaciones",  icon: Bell },
  { id: "security",      label: "Seguridad",       labelEn: "Seguridad",      icon: Shield },
  { id: "integrations",  label: "Integraciones",   labelEn: "Integraciones",  icon: Key },
];

const DEFAULT_SETTINGS: AdminSettings = {
  language: "es",
  timezone: "America/Mexico_City",
  notifications: { email: true, disputes: true, payments: true, system: false },
  security: { mfaRequired: false, sessionLog: true },
  integrations: { openai: false, github: false },
};

export default function AdminSettingsPage() {
  const { t } = useLanguage();
  const [active, setActive] = useState<SettingSection>("general");
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
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
    <main style={{ padding: "32px", color: "var(--ink)" }}>
      <AdminPageHeader
        title={t("page.settings")}
        subtitle="Ajustes del sistema SEMSE OS"
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

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "24px", alignItems: "start" }}>
        <nav style={{ border: "1px solid var(--border)", borderRadius: "20px", background: "var(--surface)", overflow: "hidden" }}>
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

        <div style={{ border: "1px solid var(--border)", borderRadius: "20px", background: "var(--surface)", padding: "28px" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
              <Loader2 size={16} style={spinStyle} /> Cargando ajustes…
            </div>
          ) : (
            <>
              {active === "general" && <GeneralSection value={settings} onChange={update} />}
              {active === "notifications" && <NotificationsSection value={settings.notifications} onChange={(v) => updateNested("notifications", v)} />}
              {active === "security" && <SecuritySection value={settings.security} onChange={(v) => updateNested("security", v)} />}
              {active === "integrations" && <IntegrationsSection value={settings.integrations} onChange={(v) => updateNested("integrations", v)} />}

              <div style={{ marginTop: "24px", display: "flex", alignItems: "center", gap: "12px", justifyContent: "flex-end" }}>
                {saving ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--muted)", fontSize: "0.875rem" }}>
                    <Loader2 size={14} style={spinStyle} /> Guardando…
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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
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
      <SettingRow label="Versión del sistema" description="SEMSE OS — monorepo">
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

function IntegrationsSection({ value, onChange }: { value: AdminSettings["integrations"]; onChange: (v: AdminSettings["integrations"]) => void }) {
  const update = (key: keyof AdminSettings["integrations"]) => (checked: boolean) => onChange({ ...value, [key]: checked });
  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Integraciones</h2>
      <SettingRow
        label="OpenAI"
        description="Habilita planes de tareas con IA para Autonomous PR Core"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Toggle checked={value.openai} onChange={update("openai")} />
          <span style={{ fontSize: "0.8rem", color: value.openai ? "#34d399" : "var(--muted)" }}>
            {value.openai ? "Configurado vía OPENAI_API_KEY" : "Requiere OPENAI_API_KEY en el servidor"}
          </span>
        </div>
      </SettingRow>
      <SettingRow
        label="GitHub"
        description="Push de branches y apertura de PRs reales"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Toggle checked={value.github} onChange={update("github")} />
          <span style={{ fontSize: "0.8rem", color: value.github ? "#34d399" : "var(--muted)" }}>
            {value.github ? "Configurado vía SEMSE_AUTONOMY_GITHUB_TOKEN" : "Requiere SEMSE_AUTONOMY_GITHUB_TOKEN en el servidor"}
          </span>
        </div>
      </SettingRow>
      <SettingRow label="Base de datos" description="PostgreSQL — estado de conexión">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Database size={14} color="#34d399" />
          <span style={{ color: "#34d399", fontSize: "0.875rem" }}>Conectado</span>
        </div>
      </SettingRow>
    </div>
  );
}
