import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bot,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  HardHat,
  Layers3,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Cómo se usa SEMSE Project",
  description:
    "Guía servicio por servicio para entender cómo interactúan clientes, profesionales, administradores, evidencia, pagos, IA y operaciones dentro de SEMSE Project.",
};

const services = [
  {
    title: "Publicación de proyectos",
    icon: BriefcaseBusiness,
    summary: "El cliente crea una solicitud con alcance, ubicación, presupuesto, fechas y fotos iniciales.",
    interaction: "Prometeo resume la necesidad, clasifica el trabajo y prepara la solicitud para recibir propuestas.",
    users: "Cliente, admin operativo, agentes IA",
  },
  {
    title: "Marketplace de profesionales",
    icon: Users,
    summary: "Contratistas y workers revisan oportunidades, envían propuestas y muestran historial verificable.",
    interaction: "El cliente compara precio, disponibilidad, reputación, experiencia y riesgo antes de elegir.",
    users: "Cliente, profesional, contractor owner",
  },
  {
    title: "Estimación y alcance",
    icon: ClipboardCheck,
    summary: "El proyecto se convierte en alcance, line items, materiales, mano de obra, margen y tiempos.",
    interaction: "SEMSE organiza el presupuesto para que ambas partes entiendan qué se entrega y qué no.",
    users: "Cliente, profesional, PMO, Prometeo",
  },
  {
    title: "Contratos e hitos",
    icon: FileText,
    summary: "El trabajo se divide en milestones: inicio, avance, inspección, entrega y cierre.",
    interaction: "Cada hito tiene requisitos, evidencia esperada, monto asociado y estado de aprobación.",
    users: "Cliente, profesional, admin, finance operator",
  },
  {
    title: "Pagos protegidos",
    icon: Banknote,
    summary: "El dinero se mantiene protegido y se libera por avance aprobado, no por promesas.",
    interaction: "Finance revisa depósitos, escrow, release, refund y bloqueos por evidencia o disputa.",
    users: "Cliente, profesional, finance operator",
  },
  {
    title: "WorkOps y campo",
    icon: HardHat,
    summary: "El equipo ejecuta tareas, reporta avance, sube fotos, registra incidencias y coordina visitas.",
    interaction: "Field Ops, Worker, PMO y QA ven el mismo estado operativo para reducir llamadas y confusión.",
    users: "Worker, supervisor, PMO, QA",
  },
  {
    title: "Evidencia y QA",
    icon: UploadCloud,
    summary: "Fotos, documentos, notas, cambios y entregables quedan conectados al hito correcto.",
    interaction: "QA valida si la evidencia cumple; si falta algo, el pago queda bloqueado hasta corregir.",
    users: "Worker, cliente, QA, agentes IA",
  },
  {
    title: "Comunicación y trazabilidad",
    icon: MessageSquareText,
    summary: "Mensajes, decisiones, cambios y aprobaciones quedan dentro del contexto del proyecto.",
    interaction: "Las conversaciones alimentan el historial para evitar acuerdos perdidos fuera del sistema.",
    users: "Cliente, profesional, soporte, admin",
  },
  {
    title: "Disputas y cambios",
    icon: ShieldCheck,
    summary: "Si hay desacuerdo, SEMSE muestra contrato, evidencia, mensajes, hitos y pagos relacionados.",
    interaction: "El sistema ayuda a resolver con datos: qué se pidió, qué se entregó y qué falta.",
    users: "Cliente, profesional, soporte, compliance",
  },
  {
    title: "Intelligence y Prometeo",
    icon: Bot,
    summary: "La IA lee contexto operativo, detecta riesgos, resume señales y sugiere próximos pasos.",
    interaction: "Los agentes proponen; el humano decide acciones sensibles como pagos, rechazos o cambios.",
    users: "Admin, PMO, cliente, agentes IA",
  },
  {
    title: "Trust y reputación",
    icon: BadgeCheck,
    summary: "Cada cierre alimenta historial, reviews, cumplimiento, calidad y confiabilidad.",
    interaction: "La reputación real ayuda a elegir mejor en futuros trabajos y reduce riesgo operativo.",
    users: "Cliente, profesional, marketplace",
  },
  {
    title: "Mission Control",
    icon: Activity,
    summary: "El admin ve salud del ecosistema, alertas, pagos bloqueados, evidencia pendiente y módulos.",
    interaction: "Desde ahí se navega a WorkOps, Finance, Trust, Intelligence, Tool Hub y verticales.",
    users: "Admin, operator, support, leadership",
  },
];

const roles = [
  {
    title: "Cliente",
    icon: Building2,
    items: ["Publica necesidades", "Compara propuestas", "Aprueba hitos", "Autoriza liberación de pagos"],
  },
  {
    title: "Profesional o contratista",
    icon: HardHat,
    items: ["Envía propuestas", "Ejecuta tareas", "Sube evidencia", "Solicita revisión y pago"],
  },
  {
    title: "Admin operativo",
    icon: Layers3,
    items: ["Monitorea riesgos", "Coordina operaciones", "Resuelve bloqueos", "Mantiene calidad del sistema"],
  },
  {
    title: "Agentes IA",
    icon: Sparkles,
    items: ["Resumen contexto", "Detectan gaps", "Sugieren acciones", "Escalan decisiones sensibles"],
  },
];

const flow = [
  "Intake del proyecto",
  "Clasificación y resumen IA",
  "Propuestas verificadas",
  "Selección y contrato",
  "Milestones y escrow",
  "Ejecución en campo",
  "Evidencia y QA",
  "Aprobación y pago",
  "Cierre, review y aprendizaje",
];

const checkpoints = [
  "El proyecto tiene alcance claro y fotos o documentos iniciales.",
  "La propuesta explica precio, tiempo, exclusiones y requisitos.",
  "Cada hito tiene monto, evidencia esperada y criterio de aprobación.",
  "El pago está protegido antes de iniciar trabajos sensibles.",
  "La evidencia se sube dentro del hito correcto, no solo por chat.",
  "Los cambios de alcance se documentan antes de ejecutarse.",
  "La aprobación del cliente libera pagos; las disputas congelan decisiones de riesgo.",
  "El cierre genera historial, reputación y datos para futuros proyectos.",
];

export default function HowItWorksPage() {
  return (
    <main className="bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="relative overflow-hidden border-b border-slate-200 bg-white px-4 py-16 dark:border-slate-800 dark:bg-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
              <Sparkles size={14} />
              Guía operativa
            </span>
            <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
              Cómo se usa SEMSE Project, servicio por servicio
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              SEMSE Project no es solo una página para publicar trabajos. Es un sistema operativo para llevar un
              proyecto desde la solicitud inicial hasta el cierre, con propuestas, hitos, evidencia, pagos protegidos,
              IA operativa y reputación verificable.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/client/jobs/new"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
              >
                Publicar proyecto
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/register"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                Crear cuenta
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {roles.map((role) => {
              const Icon = role.icon;
              return (
                <article key={role.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                      <Icon size={20} />
                    </span>
                    <h2 className="text-lg font-extrabold">{role.title}</h2>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {role.items.map((item) => (
                      <li key={item} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="flujo" className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">Flujo completo</p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">De una necesidad a un cierre verificable</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Cada etapa deja datos útiles para la siguiente. Si falta evidencia, presupuesto, aprobación o contexto,
              SEMSE lo muestra antes de que el proyecto avance a una decisión sensible.
            </p>
          </div>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {flow.map((step, index) => (
              <div key={step} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <span className="text-xs font-black text-blue-600 dark:text-blue-300">{String(index + 1).padStart(2, "0")}</span>
                <p className="mt-2 text-sm font-bold">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="servicios-detalle" className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">Servicios</p>
            <h2 className="mt-2 text-3xl font-black">Qué hace cada servicio y cómo interactúa</h2>
            <p className="mt-4 text-slate-600 dark:text-slate-300">
              Estas son las piezas principales del sistema. Puedes entrar por una necesidad sencilla, pero el sistema
              conecta marketplace, operación, finanzas, evidencia y confianza para que el trabajo sea trazable.
            </p>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <article key={service.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                      <Icon size={22} />
                    </span>
                    <div>
                      <h3 className="text-xl font-black">{service.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{service.summary}</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_220px]">
                    <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950/70">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Interacción</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{service.interaction}</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-4 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
                      <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">Usuarios</p>
                      <p className="mt-2 text-sm font-semibold leading-6">{service.users}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">Interacción real</p>
            <h2 className="mt-2 text-3xl font-black">Cómo se conectan las decisiones</h2>
            <div className="mt-6 space-y-4">
              {[
                ["Cliente aprueba", "Cuando la evidencia cumple, el cliente aprueba el hito y Finance puede liberar el pago."],
                ["Profesional corrige", "Si QA detecta faltantes, el profesional recibe una acción clara antes de solicitar pago."],
                ["Admin desbloquea", "Si hay disputa, cambio de alcance o pago retenido, el admin ve el historial completo."],
                ["IA recomienda", "Prometeo resume señales, detecta riesgos y sugiere el siguiente paso sin ejecutar decisiones críticas solo."],
              ].map(([title, text]) => (
                <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <h3 className="font-extrabold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p>
                </div>
              ))}
            </div>
          </div>
          <aside className="rounded-2xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-900/60 dark:bg-blue-950/30">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">Checklist para usarlo bien</p>
            <ul className="mt-5 space-y-3">
              {checkpoints.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-blue-950 dark:text-blue-100">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
                  {item}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>
    </main>
  );
}
