import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Eliminación de Datos — SEMSE Project",
  description: "Instrucciones para solicitar la eliminación de tus datos personales de SEMSE Project.",
};

const STEPS = [
  {
    num: "01",
    title: "Envía tu solicitud por correo",
    desc: "Escribe a privacy@semseproject.com con el asunto \"Solicitud de eliminación de datos\". Incluye el correo electrónico asociado a tu cuenta.",
  },
  {
    num: "02",
    title: "Verificamos tu identidad",
    desc: "Te enviaremos un correo de confirmación para verificar que eres el titular de la cuenta. Responde desde la misma dirección registrada.",
  },
  {
    num: "03",
    title: "Procesamos la solicitud",
    desc: "Una vez verificada la identidad, eliminamos o anonimizamos tus datos personales dentro de los 30 días siguientes a la confirmación.",
  },
  {
    num: "04",
    title: "Recibes confirmación",
    desc: "Te enviamos un correo confirmando que la eliminación fue completada e indicando qué datos fueron retenidos por obligación legal.",
  },
];

const WHAT_DELETED = [
  "Nombre, correo electrónico y datos de contacto",
  "Fotos de perfil y documentos de identidad subidos",
  "Historial de conversaciones con Prometeo IA",
  "Mensajes de chat con otros usuarios",
  "Preferencias y configuración de cuenta",
  "Datos de dispositivo y registros de sesión",
];

const WHAT_RETAINED = [
  "Registros de transacciones financieras (requerido por ley por 5–7 años)",
  "Evidencias de proyectos completados en disputa activa",
  "Datos anonimizados sin posibilidad de reidentificación",
  "Información necesaria para cumplir obligaciones contractuales pendientes",
];

export default function DataDeletionPage() {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "64px 24px 96px" }}>
      {/* Header */}
      <div style={{ marginBottom: 48 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 14px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 700,
            color: "#dc2626",
            marginBottom: 24,
          }}
        >
          Privacidad · Datos
        </div>
        <h1
          style={{
            fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#0f172a",
            marginBottom: 16,
          }}
        >
          Instrucciones para la Eliminación de Datos
        </h1>
        <p style={{ fontSize: 16, color: "#64748b", lineHeight: 1.7, maxWidth: 640 }}>
          Tienes derecho a solicitar la eliminación de tus datos personales de SEMSE Project en cualquier
          momento. Sigue los pasos a continuación para completar la solicitud.
        </p>
      </div>

      {/* Steps */}
      <div style={{ display: "grid", gap: 20, marginBottom: 56 }}>
        {STEPS.map((step) => (
          <div
            key={step.num}
            style={{
              display: "flex",
              gap: 20,
              padding: "24px 28px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {step.num}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", marginBottom: 6 }}>
                {step.title}
              </div>
              <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7 }}>{step.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA email */}
      <div
        style={{
          padding: "28px 32px",
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: 14,
          marginBottom: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#1e40af", marginBottom: 4 }}>
            Envía tu solicitud ahora
          </div>
          <div style={{ fontSize: 14, color: "#3b82f6" }}>privacy@semseproject.com</div>
        </div>
        <a
          href="mailto:privacy@semseproject.com?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20datos&body=Hola%2C%20solicito%20la%20eliminaci%C3%B3n%20de%20mis%20datos%20personales.%0A%0ACorreo%20de%20cuenta%3A%20"
          style={{
            padding: "12px 24px",
            background: "#2563eb",
            color: "#fff",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          Abrir correo →
        </a>
      </div>

      {/* What gets deleted / retained */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, marginBottom: 56 }}>
        <div
          style={{
            padding: "24px 28px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 14,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15, color: "#15803d", marginBottom: 16 }}>
            ✓ Qué se elimina
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
            {WHAT_DELETED.map((item) => (
              <li key={item} style={{ display: "flex", gap: 10, fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
                <span style={{ color: "#16a34a", flexShrink: 0 }}>•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div
          style={{
            padding: "24px 28px",
            background: "#fefce8",
            border: "1px solid #fde68a",
            borderRadius: 14,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15, color: "#92400e", marginBottom: 16 }}>
            ⚠ Qué se retiene por ley
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
            {WHAT_RETAINED.map((item) => (
              <li key={item} style={{ display: "flex", gap: 10, fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
                <span style={{ color: "#d97706", flexShrink: 0 }}>•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Timeline note */}
      <div
        style={{
          padding: "20px 24px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          fontSize: 14,
          color: "#64748b",
          lineHeight: 1.7,
          marginBottom: 40,
        }}
      >
        <strong style={{ color: "#0f172a" }}>Tiempo de respuesta:</strong> Confirmaremos la recepción de tu
        solicitud dentro de las 72 horas. La eliminación se completa en un máximo de <strong style={{ color: "#0f172a" }}>30 días calendario</strong> desde
        la verificación de identidad, conforme a las leyes de privacidad aplicables (CCPA, GDPR, LGPD).
      </div>

      {/* Footer nav */}
      <div
        style={{
          paddingTop: 32,
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href="/privacy" style={{ fontSize: 14, color: "#3b82f6", textDecoration: "none", fontWeight: 600 }}>
          ← Política de Privacidad
        </Link>
        <Link href="/terms" style={{ fontSize: 14, color: "#64748b", textDecoration: "none" }}>
          Términos de servicio →
        </Link>
      </div>
    </main>
  );
}
