import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Condiciones del Servicio — SEMSE Project",
  description: "Condiciones del servicio de SEMSE Project. Lee los términos que rigen el uso de nuestra plataforma para contratistas y clientes.",
};

const SECTIONS = [
  {
    id: "aceptacion",
    title: "1. Aceptación de los Términos",
    content: `Al acceder o usar la plataforma SEMSE Project (el "Servicio"), ya sea como cliente o como contratista, aceptas quedar vinculado por estas Condiciones del Servicio. Si no estás de acuerdo con alguno de los términos aquí establecidos, no debes utilizar el Servicio.

Estos términos constituyen un acuerdo legal entre tú y SEMSE Project LLC ("SEMSE", "nosotros", "nuestro"). Nos reservamos el derecho de modificar estos términos en cualquier momento, con notificación previa a los usuarios registrados.`,
  },
  {
    id: "descripcion",
    title: "2. Descripción del Servicio",
    content: `SEMSE Project es una plataforma tecnológica que conecta a clientes (propietarios, administradores de propiedades, empresas) con contratistas verificados para la realización de proyectos de construcción, remodelación, mantenimiento y servicios administrativos relacionados.

El Servicio incluye:
• Publicación y búsqueda de proyectos
• Sistema de propuestas y licitaciones
• Herramientas de gestión de proyectos por hitos
• Sistema de escrow para protección de pagos
• Módulo de evidencias y documentación
• Asistente de IA "Prometeo" para análisis y soporte
• Herramientas profesionales para contratistas (ProTools)`,
  },
  {
    id: "cuentas",
    title: "3. Cuentas de Usuario",
    content: `3.1 Elegibilidad: Debes tener al menos 18 años de edad y capacidad legal para celebrar contratos para usar el Servicio.

3.2 Registro: Debes proporcionar información exacta, completa y actualizada al crear tu cuenta. Eres responsable de mantener la confidencialidad de tus credenciales de acceso.

3.3 Tipos de cuenta:
• Cliente: Puede publicar proyectos, recibir propuestas, gestionar hitos y liberar pagos.
• Contratista: Puede enviar propuestas, completar proyectos, subir evidencias y recibir pagos.
• Administrador: Cuenta interna con acceso extendido para gestión de la plataforma.

3.4 Una cuenta no puede ser transferida a terceros sin autorización expresa de SEMSE.`,
  },
  {
    id: "pagos",
    title: "4. Pagos, Escrow y Comisiones",
    content: `4.1 Escrow: Los pagos del cliente quedan protegidos en escrow y se liberan únicamente cuando el cliente aprueba un hito como completado. SEMSE actúa como intermediario neutral.

4.2 Comisión de plataforma: SEMSE retiene un porcentaje del pago por cada transacción completada. La tarifa vigente se indica al momento de crear el acuerdo.

4.3 Disputas: En caso de disputa, SEMSE puede mediar para determinar si un hito fue completado según lo acordado. La decisión de SEMSE es vinculante para ambas partes.

4.4 Reembolsos: Los reembolsos se procesan únicamente en los casos previstos en la política de disputas. Los pagos ya liberados al contratista no son reembolsables salvo orden judicial.

4.5 Impuestos: Cada usuario es responsable de declarar y pagar los impuestos que correspondan a sus ingresos obtenidos a través de la plataforma.`,
  },
  {
    id: "contratistas",
    title: "5. Obligaciones del Contratista",
    content: `5.1 Verificación: Los contratistas deben completar el proceso de verificación de identidad y, según el tipo de trabajo, presentar licencias, seguros y certificaciones válidas.

5.2 Calidad y cumplimiento: El contratista se compromete a ejecutar los proyectos según lo acordado, en tiempo y forma, cumpliendo con los códigos de construcción y normas de seguridad locales aplicables.

5.3 Evidencias: Deben subir fotos, videos u otro material que acredite el avance y la finalización de cada hito.

5.4 Conducta profesional: Queda prohibido el contacto inapropiado con clientes, el cobro fuera de la plataforma o cualquier conducta que perjudique la reputación de SEMSE.`,
  },
  {
    id: "clientes",
    title: "6. Obligaciones del Cliente",
    content: `6.1 Información veraz: El cliente debe describir el proyecto de forma honesta y completa para facilitar propuestas precisas.

6.2 Pagos oportunos: El cliente debe depositar los fondos en escrow antes del inicio de cada hito. La demora en el pago puede resultar en suspensión del proyecto.

6.3 Revisión de hitos: El cliente tiene 5 días hábiles para aprobar o rechazar un hito completado. La falta de respuesta dentro de ese plazo se considera aprobación automática.

6.4 Buena fe: El cliente no puede rechazar hitos completados satisfactoriamente de forma injustificada para evadir el pago.`,
  },
  {
    id: "ia",
    title: "7. Uso de Inteligencia Artificial (Prometeo)",
    content: `7.1 El asistente Prometeo utiliza modelos de IA para analizar proyectos, generar recomendaciones, calcular estimados y facilitar la comunicación. Sus respuestas son orientativas y no constituyen asesoría legal, técnica o financiera formal.

7.2 Las decisiones finales sobre alcance, precio, materiales y condiciones del proyecto son siempre responsabilidad de las partes humanas involucradas.

7.3 SEMSE no garantiza la exactitud de las estimaciones generadas por IA. Los costos reales pueden variar.`,
  },
  {
    id: "propiedad",
    title: "8. Propiedad Intelectual",
    content: `8.1 El software, diseño, marca y contenido de SEMSE Project son propiedad exclusiva de SEMSE Project LLC y están protegidos por leyes de propiedad intelectual.

8.2 Los usuarios conservan la propiedad de los contenidos que publican (fotos, descripiciones de proyectos, documentos), pero otorgan a SEMSE una licencia no exclusiva para usar ese contenido con el propósito de operar y mejorar el Servicio.

8.3 Está prohibido copiar, reproducir, distribuir o crear obras derivadas del Servicio sin autorización escrita de SEMSE.`,
  },
  {
    id: "privacidad",
    title: "9. Privacidad y Datos",
    content: `El uso de tus datos personales se rige por nuestra Política de Privacidad, que forma parte integral de estas Condiciones. Al usar el Servicio aceptas la recopilación y uso de información según lo descrito en dicha política.

Tus datos son utilizados para:
• Verificar identidad y prevenir fraudes
• Procesar pagos y transacciones
• Mejorar el Servicio mediante aprendizaje automático
• Comunicaciones operativas sobre tus proyectos`,
  },
  {
    id: "prohibiciones",
    title: "10. Conductas Prohibidas",
    content: `Está prohibido en la plataforma:
• Publicar información falsa o engañosa
• Evadir el sistema de pagos acordando transacciones fuera de la plataforma
• Crear múltiples cuentas para manipular valoraciones o el sistema de reputación
• Acosar, amenazar o discriminar a otros usuarios
• Violar leyes locales, estatales o federales aplicables
• Intentar acceder de forma no autorizada a sistemas de SEMSE
• Usar el Servicio para actividades ilegales de cualquier tipo

Las violaciones pueden resultar en suspensión inmediata de la cuenta y, de ser necesario, reporte a autoridades competentes.`,
  },
  {
    id: "limitacion",
    title: "11. Limitación de Responsabilidad",
    content: `SEMSE actúa como plataforma intermediaria. No es parte de los contratos entre clientes y contratistas y no garantiza la calidad, legalidad o resultado de ningún proyecto.

En la medida máxima permitida por la ley, SEMSE no será responsable por:
• Daños directos, indirectos, incidentales o consecuentes derivados del uso del Servicio
• Disputas entre clientes y contratistas
• Errores en estimaciones generadas por IA
• Interrupciones del Servicio fuera de nuestro control

La responsabilidad total de SEMSE ante cualquier reclamación no excederá el monto de las comisiones pagadas en los 12 meses anteriores al evento que origina la reclamación.`,
  },
  {
    id: "terminacion",
    title: "12. Terminación",
    content: `SEMSE puede suspender o terminar tu acceso al Servicio en cualquier momento, con o sin causa, con o sin previo aviso, especialmente en caso de violación de estas Condiciones.

Tú puedes cancelar tu cuenta en cualquier momento desde la configuración de tu perfil. La cancelación no afecta las obligaciones derivadas de proyectos activos al momento de la cancelación.`,
  },
  {
    id: "ley",
    title: "13. Ley Aplicable y Resolución de Disputas",
    content: `Estas Condiciones se rigen por las leyes del Estado de Florida, Estados Unidos, sin perjuicio de sus disposiciones sobre conflicto de leyes.

Cualquier disputa relacionada con el Servicio se resolverá mediante arbitraje vinculante administrado bajo las reglas de la American Arbitration Association (AAA), renunciando ambas partes al derecho a juicio ante jurado o a participar en demandas colectivas.`,
  },
  {
    id: "contacto",
    title: "14. Contacto",
    content: `Si tienes preguntas sobre estas Condiciones del Servicio puedes contactarnos en:

SEMSE Project LLC
Email: legal@semseproject.com
Web: semseproject.com`,
  },
];

export default function TermsPage() {
  const lastUpdated = "28 de mayo de 2026";

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px 80px" }}>
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>
          Condiciones del Servicio
        </h1>
        <p style={{ color: "var(--muted, #6b7280)", fontSize: "0.95rem" }}>
          Última actualización: {lastUpdated}
        </p>
        <p style={{ marginTop: 16, color: "var(--ink-soft, #374151)", lineHeight: 1.7 }}>
          Por favor, lee atentamente estas Condiciones del Servicio antes de usar la plataforma SEMSE Project.
          El uso continuo del Servicio implica tu aceptación de todos los términos aquí descritos.
        </p>
      </div>

      {/* Table of contents */}
      <nav
        style={{
          background: "var(--surface, #f9fafb)",
          border: "1px solid var(--border, #e5e7eb)",
          borderRadius: 12,
          padding: "20px 24px",
          marginBottom: 48,
        }}
      >
        <p style={{ fontWeight: 700, marginBottom: 12, color: "var(--ink)" }}>Contenido</p>
        <ol style={{ margin: 0, padding: "0 0 0 20px", display: "grid", gap: 6, color: "var(--accent, #3b82f6)" }}>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} style={{ color: "inherit", textDecoration: "none", fontSize: "0.9rem" }}>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Sections */}
      <div style={{ display: "grid", gap: 40 }}>
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id}>
            <h2
              style={{
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "var(--ink)",
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: "2px solid var(--accent, #3b82f6)",
                display: "inline-block",
              }}
            >
              {s.title}
            </h2>
            <div
              style={{
                color: "var(--ink-soft, #374151)",
                lineHeight: 1.75,
                fontSize: "0.95rem",
                whiteSpace: "pre-line",
              }}
            >
              {s.content}
            </div>
          </section>
        ))}
      </div>

      <div
        style={{
          marginTop: 56,
          padding: "20px 24px",
          background: "var(--surface, #f9fafb)",
          border: "1px solid var(--border, #e5e7eb)",
          borderRadius: 12,
          textAlign: "center",
          color: "var(--muted, #6b7280)",
          fontSize: "0.875rem",
        }}
      >
        ¿Tienes preguntas? Escríbenos a{" "}
        <a href="mailto:legal@semseproject.com" style={{ color: "var(--accent, #3b82f6)" }}>
          legal@semseproject.com
        </a>
      </div>
    </main>
  );
}
