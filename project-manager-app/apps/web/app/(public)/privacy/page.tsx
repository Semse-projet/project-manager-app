import Link from "next/link";

export const metadata = {
  title: "Política de Privacidad — SEMSE Project",
  description: "Cómo SEMSE Project recopila, usa y protege tu información personal.",
};

const SECTIONS = [
  {
    id: "recopilacion",
    title: "1. Información que recopilamos",
    content: [
      "**Datos de cuenta:** nombre, correo electrónico, número de teléfono y contraseña al registrarte.",
      "**Datos de perfil profesional:** especialidades, ubicación, credenciales, fotos de trabajos anteriores y referencias.",
      "**Datos de proyectos:** descripción del trabajo, presupuesto, hitos, mensajes, evidencias fotográficas y documentos de contrato.",
      "**Datos de pagos:** información de transacciones procesadas a través del sistema de escrow. No almacenamos datos completos de tarjeta de crédito.",
      "**Datos de uso:** páginas visitadas, acciones realizadas en la plataforma, dispositivo, navegador e IP.",
      "**Comunicaciones:** mensajes enviados a través de la plataforma, incluyendo conversaciones con Prometeo IA.",
    ],
  },
  {
    id: "uso",
    title: "2. Cómo usamos tu información",
    content: [
      "Operar y mejorar la plataforma SEMSE Project.",
      "Conectar clientes con profesionales verificados según las necesidades del proyecto.",
      "Procesar pagos y gestionar el sistema de escrow.",
      "Enviar notificaciones relevantes sobre el estado de tus proyectos y propuestas.",
      "Generar reportes, resúmenes automáticos y análisis asistidos por Prometeo IA.",
      "Verificar identidad y credenciales de profesionales.",
      "Detectar fraude, disputas y comportamiento malicioso.",
      "Cumplir con obligaciones legales y regulatorias.",
    ],
  },
  {
    id: "compartir",
    title: "3. Compartir información",
    content: [
      "**Entre usuarios de la plataforma:** clientes pueden ver el perfil público, especialidades y calificaciones de profesionales. Los profesionales pueden ver el detalle del proyecto para presentar propuestas.",
      "**Proveedores de servicios:** compartimos datos necesarios con proveedores de pagos, almacenamiento en la nube, y servicios de IA para operar la plataforma.",
      "**Autoridades competentes:** cuando la ley lo requiera, por orden judicial o para proteger derechos e integridad de los usuarios.",
      "**No vendemos tus datos personales** a terceros con fines publicitarios.",
    ],
  },
  {
    id: "retencion",
    title: "4. Retención de datos",
    content: [
      "Conservamos tu información mientras tu cuenta esté activa.",
      "Los datos de proyectos completados se conservan por un mínimo de 5 años para efectos de historial operativo y disputas.",
      "Puedes solicitar la eliminación de tu cuenta y datos personales, sujeto a obligaciones legales y contractuales pendientes.",
    ],
  },
  {
    id: "seguridad",
    title: "5. Seguridad",
    content: [
      "Utilizamos cifrado TLS en tránsito y AES-256 en reposo para datos sensibles.",
      "Las contraseñas se almacenan con hashing seguro (bcrypt).",
      "El acceso a datos de producción está restringido y auditado.",
      "Realizamos revisiones de seguridad periódicas.",
      "Ningún sistema es 100% infalible. En caso de brecha de seguridad que afecte tus datos, te notificaremos conforme a la regulación aplicable.",
    ],
  },
  {
    id: "derechos",
    title: "6. Tus derechos",
    content: [
      "**Acceso:** puedes solicitar una copia de los datos personales que tenemos sobre ti.",
      "**Rectificación:** puedes corregir datos incorrectos desde tu perfil o contactándonos.",
      "**Eliminación:** puedes solicitar la eliminación de tu cuenta y datos, salvo retención legal requerida.",
      "**Portabilidad:** puedes solicitar una exportación de tus datos en formato estructurado.",
      "**Oposición:** puedes oponerte al procesamiento de tus datos para fines de marketing.",
      "Para ejercer estos derechos, escríbenos a privacidad@semseproject.com.",
    ],
  },
  {
    id: "cookies",
    title: "7. Cookies y tecnologías similares",
    content: [
      "Usamos cookies de sesión para autenticación y cookies analíticas para entender el uso de la plataforma.",
      "No usamos cookies de seguimiento de terceros para publicidad.",
      "Puedes configurar tu navegador para rechazar cookies, aunque esto puede afectar la funcionalidad de la plataforma.",
    ],
  },
  {
    id: "ia",
    title: "8. Inteligencia Artificial (Prometeo)",
    content: [
      "Prometeo IA procesa el contexto de tus proyectos para generar resúmenes, clasificaciones, presupuestos estimados y asistencia operativa.",
      "Las conversaciones con Prometeo pueden ser revisadas por nuestro equipo para mejorar la calidad del servicio.",
      "No utilizamos tus datos para entrenar modelos de IA de terceros sin tu consentimiento explícito.",
    ],
  },
  {
    id: "cambios",
    title: "9. Cambios a esta política",
    content: [
      "Podemos actualizar esta política cuando sea necesario.",
      "Te notificaremos por correo o mediante un aviso en la plataforma ante cambios materiales.",
      "La versión vigente siempre estará disponible en semseproject.com/privacy.",
    ],
  },
  {
    id: "contacto",
    title: "10. Contacto",
    content: [
      "Para preguntas o ejercer tus derechos de privacidad, contáctanos en:",
      "**Email:** privacidad@semseproject.com",
      "**SEMSE Project** · Plataforma operativa para servicios de construcción y mantenimiento",
    ],
  },
];

function renderLine(line: string) {
  const parts = line.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "64px 24px 96px" }}>
      {/* Header */}
      <div style={{ marginBottom: 56 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 20, fontSize: 13, fontWeight: 700, color: "#2563eb", marginBottom: 24 }}>
          Legal
        </div>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 2.8rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "#0f172a", marginBottom: 16 }}>
          Política de Privacidad
        </h1>
        <p style={{ fontSize: 16, color: "#64748b", lineHeight: 1.7, maxWidth: 640 }}>
          En SEMSE Project nos tomamos en serio la privacidad de nuestros usuarios. Esta política explica qué datos recopilamos, cómo los usamos y cómo los protegemos.
        </p>
        <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 16 }}>
          Última actualización: Mayo 2026
        </p>
      </div>

      {/* Table of contents */}
      <nav
        style={{
          padding: "24px 28px",
          borderRadius: 16,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          marginBottom: 56,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: "0.06em", marginBottom: 14 }}>
          CONTENIDO
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                style={{ textDecoration: "none", color: "#3b82f6", fontSize: 14, fontWeight: 500 }}
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Sections */}
      <div style={{ display: "grid", gap: 48 }}>
        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", marginBottom: 20, paddingBottom: 12, borderBottom: "1px solid #e2e8f0" }}>
              {section.title}
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
              {section.content.map((line, i) => (
                <li key={i} style={{ display: "flex", gap: 12, fontSize: 15, color: "#374151", lineHeight: 1.7 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", flexShrink: 0, marginTop: 9 }} />
                  <span>{renderLine(line)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Footer nav */}
      <div
        style={{
          marginTop: 64,
          paddingTop: 32,
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href="/terms" style={{ fontSize: 14, color: "#3b82f6", textDecoration: "none", fontWeight: 600 }}>
          Términos de servicio →
        </Link>
        <Link href="/" style={{ fontSize: 14, color: "#64748b", textDecoration: "none" }}>
          ← Volver al inicio
        </Link>
      </div>
    </main>
  );
}
