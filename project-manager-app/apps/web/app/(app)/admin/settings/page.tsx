"use client";

import { useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import { Settings, Bell, Shield, Globe, Database, Key } from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

type SettingSection = "general" | "notifications" | "security" | "integrations";

const SECTIONS: { id: SettingSection; label: string; labelEn: string; icon: typeof Settings }[] = [
  { id: "general",       label: "General",        labelEn: "General",        icon: Globe },
  { id: "notifications", label: "Notificaciones", labelEn: "Notificaciones",  icon: Bell },
  { id: "security",      label: "Seguridad",       labelEn: "Seguridad",      icon: Shield },
  { id: "integrations",  label: "Integraciones",   labelEn: "Integraciones",  icon: Key },
];

export default function AdminSettingsPage() {
  const { t } = useLanguage();
  const [active, setActive] = useState<SettingSection>("general");

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

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "24px", alignItems: "start" }}>
        {/* Sidebar */}
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

        {/* Panel */}
        <div style={{ border: "1px solid var(--border)", borderRadius: "20px", background: "var(--surface)", padding: "28px" }}>
          {active === "general" && <GeneralSection />}
          {active === "notifications" && <NotificationsSection />}
          {active === "security" && <SecuritySection />}
          {active === "integrations" && <IntegrationsSection />}
        </div>
      </div>
    </main>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
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

function GeneralSection() {
  const [lang, setLang] = useState<"es" | "en">("es");
  const [timezone, setTimezone] = useState("America/Mexico_City");

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>General</h2>
      <SettingRow label="Idioma de interfaz" description="Afecta etiquetas y textos del panel administrativo">
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as "es" | "en")}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--ink)" }}
        >
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </SettingRow>
      <SettingRow label="Zona horaria" description="Usada para timestamps en reportes y logs">
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
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

function NotificationsSection() {
  const [email, setEmail] = useState(true);
  const [disputes, setDisputes] = useState(true);
  const [payments, setPayments] = useState(true);
  const [system, setSystem] = useState(false);

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Notificaciones</h2>
      <SettingRow label="Alertas por correo" description="Recibe resúmenes diarios de actividad">
        <Toggle checked={email} onChange={setEmail} />
      </SettingRow>
      <SettingRow label="Disputas escaladas" description="Notificación inmediata al abrir una disputa">
        <Toggle checked={disputes} onChange={setDisputes} />
      </SettingRow>
      <SettingRow label="Eventos de pago" description="Liberaciones de escrow y cargos fallidos">
        <Toggle checked={payments} onChange={setPayments} />
      </SettingRow>
      <SettingRow label="Eventos de sistema" description="Deployments, migraciones y errores críticos">
        <Toggle checked={system} onChange={setSystem} />
      </SettingRow>
    </div>
  );
}

function SecuritySection() {
  const [mfa, setMfa] = useState(false);
  const [sessionLog, setSessionLog] = useState(true);

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Seguridad</h2>
      <SettingRow label="Autenticación de dos factores" description="Requiere TOTP al iniciar sesión como administrador">
        <Toggle checked={mfa} onChange={setMfa} />
      </SettingRow>
      <SettingRow label="Registro de sesiones" description="Guarda IP y user-agent por cada login">
        <Toggle checked={sessionLog} onChange={setSessionLog} />
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

function IntegrationsSection() {
  const [openai, setOpenai] = useState(false);
  const [github, setGithub] = useState(false);

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Integraciones</h2>
      <SettingRow label="OpenAI" description="Habilita planes de tareas con IA para Autonomous PR Core">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Toggle checked={openai} onChange={setOpenai} />
          {openai && (
            <span style={{ fontSize: "0.8rem", color: "#34d399" }}>Configurado vía OPENAI_API_KEY</span>
          )}
        </div>
      </SettingRow>
      <SettingRow label="GitHub" description="Push de branches y apertura de PRs reales">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Toggle checked={github} onChange={setGithub} />
          {github && (
            <span style={{ fontSize: "0.8rem", color: "#34d399" }}>Configurado vía SEMSE_AUTONOMY_GITHUB_TOKEN</span>
          )}
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
