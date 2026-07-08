import Link from "next/link";
import { Suspense } from "react";
import { fetchPublicLandingOverviewServer } from "../../lib/public-landing";
import { LandingIntake } from "../../components/landing/landing-intake";
import { StepsCarousel } from "../../components/landing/steps-carousel";
import { TestimonialsCarousel } from "../../components/landing/testimonials-carousel";
import { ProfessionalsCarousel } from "../../components/landing/professionals-carousel";
import { ScrollReveal } from "../../components/landing/scroll-reveal";
import { FeaturedJobsFeed } from "../../components/landing/featured-jobs-feed";
import { AgentsSimulator } from "../../components/landing/agents-simulator";
import { RolesDashboard } from "../../components/landing/roles-dashboard";
import { AnimatedCounter } from "../../components/landing/animated-counter";
import { PricingEstimator } from "../../components/landing/pricing-estimator";
import { EcosystemModules } from "../../components/landing/ecosystem-modules";
import { OperationalRoutesGrid } from "../../components/landing/operational-routes-grid";
import { PersonaSelector } from "../../components/landing/persona-selector";
import { UsageGuideContent } from "../como-funciona/page";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  DollarSign,
  Layers,
  Scale,
  Star,
  Users,
  CheckCircle2,
  Briefcase,
  TrendingUp,
  PlusCircle,
} from "lucide-react";

const HOW_IT_WORKS = [
  {
    num: "01",
    title: "Publica tu proyecto",
    desc: "Describe qué necesitas: construcción, remodelación, mantenimiento, reparación o soporte administrativo.",
    icon: Briefcase,
  },
  {
    num: "02",
    title: "Prometeo analiza la solicitud",
    desc: "La IA clasifica el tipo de trabajo, detecta urgencia, resume la necesidad y sugiere próximos pasos.",
    icon: Sparkles,
  },
  {
    num: "03",
    title: "Recibe propuestas",
    desc: "Profesionales verificados envían propuestas con precio, tiempo estimado, experiencia y disponibilidad.",
    icon: Users,
  },
  {
    num: "04",
    title: "Elige con confianza",
    desc: "Compara propuestas, revisa reputación, historial y evidencias de trabajos anteriores.",
    icon: ShieldCheck,
  },
  {
    num: "05",
    title: "Crea hitos y acuerdo",
    desc: "El proyecto se organiza por etapas claras: inicio, avance, revisión y entrega.",
    icon: Layers,
  },
  {
    num: "06",
    title: "Protege el pago en escrow",
    desc: "El dinero queda bloqueado y se libera solo cuando apruebas cada hito completado.",
    icon: DollarSign,
  },
  {
    num: "07",
    title: "Documenta evidencias",
    desc: "Fotos, videos, contratos, acuerdos y chats quedan guardados dentro del proyecto.",
    icon: CheckCircle2,
  },
  {
    num: "08",
    title: "Cierra con historial completo",
    desc: "SEMSE genera reporte final, historial del trabajo y soporte asistido si hay disputa.",
    icon: Scale,
  },
];

const SERVICES = [
  {
    icon: "🏗️",
    title: "Construcción y Remodelación",
    color: "from-blue-500 to-cyan-500",
    textColor: "text-blue-600 dark:text-blue-400",
    bulletColor: "bg-blue-500",
    bg: "bg-blue-50/50 dark:bg-blue-950/20",
    items: [
      "Drywall / Sheetrock",
      "Parches y resane blend to match",
      "Instalación y reparación",
      "Pintura residencial y comercial",
      "Remodelación residencial",
      "Remodelación comercial",
    ],
  },
  {
    icon: "🔧",
    title: "Mantenimiento",
    color: "from-emerald-500 to-teal-500",
    textColor: "text-emerald-600 dark:text-emerald-400",
    bulletColor: "bg-emerald-500",
    bg: "bg-emerald-50/50 dark:bg-emerald-950/20",
    items: [
      "Mantenimiento preventivo",
      "Reparaciones menores",
      "Instalaciones técnicas",
      "Turnovers de propiedades",
      "Inspecciones",
      "Mantenimiento comercial",
    ],
  },
  {
    icon: "📋",
    title: "Servicios Administrativos",
    color: "from-amber-500 to-orange-500",
    textColor: "text-amber-600 dark:text-amber-400",
    bulletColor: "bg-amber-500",
    bg: "bg-amber-50/50 dark:bg-amber-950/20",
    items: [
      "Cotizaciones y facturas",
      "Organización de contratos",
      "Reportes de avance",
      "Seguimiento de acuerdos",
      "Documentación de proyectos",
      "Recibos y pagos",
    ],
  },
  {
    icon: "✦",
    title: "Servicios con Prometeo IA",
    color: "from-violet-500 to-purple-500",
    textColor: "text-violet-600 dark:text-violet-400",
    bulletColor: "bg-violet-500",
    bg: "bg-violet-50/50 dark:bg-violet-950/20",
    items: [
      "Resumen automático de proyectos",
      "Clasificación de solicitudes",
      "Generación de checklists",
      "Revisión de evidencias",
      "Reportes de avance",
      "Soporte en disputas",
    ],
  },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Pagos en Escrow",
    desc: "Tus fondos quedan protegidos hasta aprobar cada entrega. Menos riesgo y menos fricción.",
    color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30",
  },
  {
    icon: Sparkles,
    title: "Prometeo + Agentes",
    desc: "Presupuesto, riesgo, finanzas y seguimiento operativo con contexto real del proyecto.",
    color: "text-violet-500 bg-violet-50 dark:bg-violet-950/30",
  },
  {
    icon: Zap,
    title: "Operación en Campo",
    desc: "Evidencia, hitos, avances y control diario conectados al mismo sistema.",
    color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
  },
  {
    icon: Scale,
    title: "Disputas y Cumplimiento",
    desc: "Workflows asistidos para contratos, desacuerdos y decisiones con trazabilidad.",
    color: "text-amber-500 bg-amber-50 dark:bg-amber-950/30",
  },
  {
    icon: Activity,
    title: "Finanzas Vivas",
    desc: "Facturas, gastos, margen y señales operativas sin salir del flujo del proyecto.",
    color: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950/30",
  },
  {
    icon: Users,
    title: "Confianza Verificada",
    desc: "Trust score, historial real y credenciales compartibles para elegir mejor.",
    color: "text-red-500 bg-red-50 dark:bg-red-950/30",
  },
];


function formatRating(value: number) {
  return value > 0 ? `${value.toFixed(1)}/5` : "—";
}

function compactScope(value: string) {
  return value.length > 132 ? `${value.slice(0, 129)}...` : value;
}

function jobStatusLabel(status: string) {
  const map: Record<string, string> = {
    POSTED: "Publicado",
    PUBLISHED: "Publicado",
    IN_PROGRESS: "En ejecución",
    REVIEW: "En revisión",
    COMPLETED: "Completado",
    AWARDED: "Asignado",
  };
  return map[status] ?? status;
}

type LandingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LandingPage({ searchParams }: LandingPageProps) {
  const params = await searchParams;
  if (params?.semse_usage_guide === "1") {
    return <UsageGuideContent />;
  }

  const overview = await fetchPublicLandingOverviewServer();
  const stats: {
    numValue: number;
    label: string;
    icon: React.ComponentType<any>;
    decimals?: number;
    suffix?: string;
  }[] = [
    { numValue: 13, label: "Oficios soportados", icon: Briefcase, suffix: "+" },
    { numValue: 8, label: "Hitos de flujo", icon: Layers },
    { numValue: 3, label: "Portales de rol", icon: Users },
    { numValue: 7, label: "Módulos operativos", icon: CheckCircle2 },
  ];

  return (
    <main className="overflow-hidden bg-[var(--bg)] text-[var(--ink)] transition-colors duration-300">
      
      {/* ── BACKGROUND DECORATIONS ── */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[60%] rounded-full bg-blue-400/10 dark:bg-blue-600/5 blur-[120px]" />
        <div className="absolute top-[10%] -right-[10%] w-[45%] h-[55%] rounded-full bg-indigo-400/10 dark:bg-indigo-600/5 blur-[120px]" />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[linear-gradient(to_right,rgba(51,65,85,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(51,65,85,0.05)_1px,transparent_1px)]" />
      </div>

      {/* ── HERO ── */}
      <section className="relative z-10 pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center animate-fade-up">
        
        {/* Glowing Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-200 dark:border-blue-900/40 text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400 mb-8 shadow-sm backdrop-blur-sm animate-pulse-dot">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          SEMSE Project — Ecosistema digital para servicios reales
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1] mb-6">
          No pagues por promesas.{" "}
          <span className="block mt-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
            Paga por avances verificados.
          </span>
        </h1>

        {/* Subhead */}
        <p className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed mb-4">
          SEMSEproject conecta clientes, contratistas y profesionales en un flujo completo para publicar trabajos, recibir propuestas, crear hitos, documentar evidencias y liberar pagos de forma segura.
        </p>

        {/* Meta badges */}
        <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 font-semibold tracking-wider uppercase mb-10 flex flex-wrap justify-center gap-x-4 gap-y-2">
          <span>Construcción</span>
          <span className="text-slate-300 dark:text-slate-800">•</span>
          <span>Remodelación</span>
          <span className="text-slate-300 dark:text-slate-800">•</span>
          <span>Mantenimiento</span>
          <span className="text-slate-300 dark:text-slate-800">•</span>
          <span>Servicios especializados</span>
          <span className="text-slate-300 dark:text-slate-800">•</span>
          <span>Asistencia con IA</span>
        </p>

        {/* Hero CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/client/jobs/new"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 active:scale-98 transition-all duration-200"
          >
            <PlusCircle className="w-5 h-5" />
            Publicar mi proyecto
          </Link>
          <Link
            href="/login?from=/worker/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] font-semibold text-base hover:bg-[var(--raised)] active:scale-98 transition-all duration-200"
          >
            Unirme como profesional
          </Link>
          <a
            href="#como-funciona"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-slate-500/10 hover:bg-slate-500/20 border border-slate-200/50 dark:border-slate-800/35 text-[var(--ink)] font-semibold text-base active:scale-98 transition-all duration-200 no-underline"
          >
            Ver cómo funciona
          </a>
        </div>
      </section>

      {/* ── HORIZONTAL TRUST BAR ── */}
      <section className="relative z-10 py-6 border-t border-b border-slate-250/50 dark:border-slate-850 bg-white/40 dark:bg-slate-900/10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-3 text-[11px] sm:text-xs font-black tracking-wider uppercase text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              IA Conectada
            </span>
            <span className="text-slate-300 dark:text-slate-800">•</span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Pagos por Hitos
            </span>
            <span className="text-slate-300 dark:text-slate-800">•</span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              Evidencia Verificable
            </span>
            <span className="text-slate-300 dark:text-slate-800">•</span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              Profesionales por Reputación
            </span>
            <span className="text-slate-300 dark:text-slate-800">•</span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Soporte en Disputas
            </span>
          </div>
        </div>
      </section>

      {/* ── INTAKE WIZARD CONTAINER ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-24">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
            Cuéntanos qué necesitas hacer
          </h2>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">
            Describe el trabajo, elige la categoría y SEMSEproject te guía hacia el flujo correcto.
          </p>
        </div>
        <div className="bg-[var(--surface)]/80 backdrop-blur-md rounded-3xl border border-[var(--border)] shadow-2xl p-1 sm:p-2 overflow-hidden transition-all duration-300">
          <LandingIntake />
        </div>
      </section>

      {/* ── ¿QUÉ QUIERES HACER HOY? (PERSONAS) ── */}
      <section
        id="ecosistema"
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t border-slate-200/50 dark:border-slate-900/50"
      >
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-200/50 dark:border-blue-900/30 text-xs font-bold text-blue-600 dark:text-blue-400 mb-4 uppercase tracking-wider">
            Ecosistema SEMSE
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            ¿Qué quieres hacer hoy?
          </h2>
        </div>
        <Suspense>
          <PersonaSelector />
        </Suspense>
      </section>

      {/* ── ELIGE TU RUTA DE TRABAJO ── */}
      <section className="relative z-10 py-24 border-t border-slate-200/50 dark:border-slate-900/50 bg-slate-50/25 dark:bg-slate-950/5">
        <div className="text-center max-w-3xl mx-auto mb-16 px-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-200/50 dark:border-blue-900/30 text-xs font-bold text-blue-600 dark:text-blue-400 mb-4 uppercase tracking-wider">
            Caminos Guiados
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            Elige tu ruta de trabajo
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            SEMSEproject te guía según lo que necesitas hacer: publicar, estimar, ejecutar, documentar, aprobar o pagar.
          </p>
        </div>
        <ScrollReveal>
          <OperationalRoutesGrid />
        </ScrollReveal>
      </section>

      {/* ── CÓMO FUNCIONA (INTERACTIVO) ── */}
      <section id="como-funciona" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t border-slate-200/50 dark:border-slate-900/50">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-900/30 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-4 uppercase tracking-wider">
            Flujo completo de principio a fin
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            Cómo funciona SEMSE Project
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            Desde publicar hasta cobrar — todo en un solo ecosistema, sin saltar entre sistemas ni perder el contexto operacional.
          </p>
        </div>

        {/* Steps Carousel Component */}
        <StepsCarousel />
      </section>

      {/* ── SERVICIOS ── */}
      <section id="servicios" className="relative z-10 bg-white dark:bg-slate-900/40 border-t border-b border-slate-200/50 dark:border-slate-900/50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-200/50 dark:border-purple-900/30 text-xs font-bold text-purple-600 dark:text-purple-400 mb-4 uppercase tracking-wider">
              Cobertura completa del ecosistema
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              Servicios que gestiona la plataforma
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400">
              No es solo construcción. Es la capa operativa para cualquier servicio que necesite confianza, pagos seguros y documentación digital.
            </p>
          </div>

          {/* Services Grid */}
          <ScrollReveal>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {SERVICES.map((service) => (
                <div
                  key={service.title}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col group"
                >
                  {/* Header block with gradient border-bottom */}
                  <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800/60 relative">
                    <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-200 inline-block">{service.icon}</div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {service.title}
                    </h3>
                    <div className={`absolute bottom-0 left-0 h-0.5 w-12 bg-gradient-to-r ${service.color}`} />
                  </div>
                  {/* Items list */}
                  <div className="p-6 flex-1 bg-slate-50/30 dark:bg-slate-900/20">
                    <ul className="space-y-3.5 list-none p-0 m-0">
                      {service.items.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400 leading-normal">
                          <span className={`w-1.5 h-1.5 rounded-full ${service.bulletColor} mt-2 flex-shrink-0`} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="relative z-10 bg-white dark:bg-slate-950 py-16 border-b border-slate-200/50 dark:border-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {stats.map((stat) => {
                const StatIcon = stat.icon;
                return (
                  <div key={stat.label} className="text-center p-4 relative group">
                    <div className="mx-auto w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-400 group-hover:text-blue-500 flex items-center justify-center mb-3 transition-colors duration-200">
                      <StatIcon size={18} />
                    </div>
                    <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {stat.numValue > 0 ? (
                        <AnimatedCounter
                          value={stat.numValue}
                          decimals={stat.decimals ?? 0}
                          suffix={stat.suffix ?? ""}
                        />
                      ) : (
                        "—"
                      )}
                    </div>
                    <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-semibold tracking-wide mt-1.5 uppercase">
                      {stat.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── ROLES SELECTION ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            Elige cómo quieres usar SEMSEproject
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            Cliente, profesional y contratista comparten el mismo ecosistema conectado en vez de vivir en herramientas fragmentadas.
          </p>
        </div>

        <ScrollReveal>
          <RolesDashboard />
        </ScrollReveal>
      </section>

      {/* ── MÓDULOS DEL ECOSISTEMA ── */}
      <section className="relative z-10 py-24 bg-slate-550/5 dark:bg-slate-950/20 border-t border-b border-slate-200/50 dark:border-slate-900/50">
        <div className="text-center max-w-3xl mx-auto mb-16 px-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-200/50 dark:border-indigo-900/30 text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-4 uppercase tracking-wider">
            Arquitectura del Producto
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            Módulos del ecosistema
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            Siete capas operativas diseñadas para dar claridad, confianza y rapidez a proyectos reales de construcción y servicios.
          </p>
        </div>
        <ScrollReveal>
          <EcosystemModules />
        </ScrollReveal>
      </section>

      {/* ── TESTIMONIALS (PASARELA INTERACTIVA) ── */}
      <section className="relative z-10 bg-white dark:bg-slate-900/30 py-24 border-t border-b border-slate-200/50 dark:border-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-200/50 dark:border-amber-900/30 text-xs font-bold text-amber-600 dark:text-amber-400 mb-4 uppercase tracking-wider">
              Reseñas reales del sistema
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              Valoraciones registradas en la plataforma
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400">
              Transparencia total. Calificaciones y comentarios guardados sobre transacciones e hitos reales completados.
            </p>
          </div>

          <TestimonialsCarousel testimonials={overview.testimonials} />
        </div>
      </section>

      {/* ── FEATURED JOBS (FEED DINÁMICO) ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-200/50 dark:border-blue-900/30 text-xs font-bold text-blue-600 dark:text-blue-400 mb-4 uppercase tracking-wider">
            Actividad viva
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            Trabajo real moviéndose en la plataforma
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            Visualiza las solicitudes recientes ingresadas por clientes en la plataforma.
          </p>
        </div>

        <ScrollReveal>
          <FeaturedJobsFeed jobs={overview.featuredJobs} />
        </ScrollReveal>
      </section>

      {/* ── PROFESSIONALS (CARRUSEL MÓVIL/DESLIZABLE) ── */}
      <section id="profesionales" className="relative z-10 bg-white dark:bg-slate-900/30 py-24 border-t border-b border-slate-200/50 dark:border-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16 px-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-900/30 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-4 uppercase tracking-wider">
              Historial verificado
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
              Profesionales verificados del ecosistema
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400">
              Ranking alimentado por credenciales validadas, trust score e historial operativo real.
            </p>
          </div>

          <ProfessionalsCarousel professionals={overview.topProfessionals} />
        </div>
      </section>

      {/* ── NO ES SOLO UN MARKETPLACE ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            No es solo un marketplace más
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            Es la capa operativa que conecta contratación, ejecución en campo, evidencias verificadas, finanzas y decisión asistida por IA.
          </p>
        </div>

        <ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((feature) => {
              const FeatureIcon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-205"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${feature.color}`}>
                    <FeatureIcon size={22} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </ScrollReveal>
      </section>

      {/* ── PAGOS PROTEGIDOS (ENTRADAS POR ROL) ── */}
      <section id="pagos" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t border-slate-200/50 dark:border-slate-900/50">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-xs font-bold text-blue-500 mb-6 uppercase tracking-wider">
            <ShieldCheck size={12} />
            Pagos protegidos por escrow
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            El dinero se mueve cuando el trabajo está hecho
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            Fondeas el escrow, el profesional trabaja con la garantía de cobro, y los fondos se liberan por hitos aprobados. Con Stripe y trazabilidad completa.
          </p>
        </div>

        <ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex flex-col">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Soy cliente</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6 flex-1">
                Deposita el presupuesto en escrow y libera pagos solo al aprobar cada hito. Tu dinero protegido de inicio a fin.
              </p>
              <Link
                href="/login?from=/client/payments"
                data-testid="landing-payments-client-cta"
                className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors duration-200"
              >
                Fondear mi proyecto
              </Link>
            </div>
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex flex-col">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Soy profesional</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6 flex-1">
                Conecta tu cuenta de cobro con Stripe, mira tu escrow asegurado antes de empezar y recibe liberaciones automáticas por hito.
              </p>
              <Link
                href="/login?from=/worker/payments"
                data-testid="landing-payments-worker-cta"
                className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors duration-200"
              >
                Configurar mis cobros
              </Link>
            </div>
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex flex-col">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Administro la operación</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6 flex-1">
                Facturas, gastos, escrows activos y reembolsos en un panel financiero único con trazabilidad por proyecto.
              </p>
              <Link
                href="/login?from=/admin/finance"
                data-testid="landing-payments-admin-cta"
                className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-sm transition-colors duration-200"
              >
                Abrir panel financiero
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ── PROMETEO IA PROMO (SIMULADOR DE AGENTES DE IA) ── */}
      <section id="prometeo" className="relative z-10 py-24 overflow-hidden border-t border-slate-800 bg-slate-950">
        <ScrollReveal>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-xs font-bold text-violet-400 mb-6 uppercase tracking-wider">
              <Sparkles size={12} className="animate-spin-slow" />
              Copiloto operativo visible
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-6 leading-tight">
              Prometeo aparece donde la operación se complica
            </h2>
            <p className="text-lg text-slate-400 max-w-3xl mx-auto leading-relaxed">
              Presupuesto inteligente, análisis de riesgos, lectura de facturas, PMO automático y contexto total del proyecto. La landing ahora refleja el motor real de agentes autónomos corriendo en el backend.
            </p>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <AgentsSimulator />
          </div>
        </ScrollReveal>
      </section>

      {/* ── PRICING ESTIMATOR ── */}
      <section id="cotizador" className="relative z-10 py-24 border-t border-slate-200/50 dark:border-slate-900/50">
        <ScrollReveal>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <PricingEstimator />
          </div>
        </ScrollReveal>
      </section>

      {/* ── CONTACTO / LEAD CAPTURE ── */}
      <section id="contacto" className="relative z-10 bg-white dark:bg-slate-900/20 py-24 border-t border-slate-200/50 dark:border-slate-900/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-200/50 dark:border-blue-900/30 text-xs font-bold text-blue-600 dark:text-blue-400 mb-6 uppercase tracking-wider">
            Empieza hoy
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            ¿Tienes un proyecto en mente?
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-12">
            Publica tu proyecto gratis, recibe propuestas comparativas de profesionales verificados y gestiona todo de principio a fin de manera segura.
          </p>

          {/* Badges categories block */}
          <ScrollReveal>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12 max-w-3xl mx-auto">
              {[
                { icon: "🏗️", label: "Construcción y drywall" },
                { icon: "🔧", label: "Mantenimiento y reparaciones" },
                { icon: "⚡", label: "Electricidad e instalaciones" },
                { icon: "🏠", label: "Remodelación residencial" },
                { icon: "🏢", label: "Proyectos comerciales" },
                { icon: "📋", label: "Soporte administrativo" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 text-left hover:border-blue-500/40 hover:shadow-sm transition-all duration-200"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 leading-tight">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/client/jobs/new"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg shadow-blue-500/20 active:scale-98 transition-all duration-200"
              >
                Publicar mi proyecto gratis
              </Link>
              <Link
                href="/login?from=/worker/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-base active:scale-98 transition-all duration-200"
              >
                Soy profesional
              </Link>
            </div>
          </ScrollReveal>
          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            Sin costo de publicación · Pagos protegidos por escrow · Prometeo IA incluido
          </p>
        </div>
      </section>

      {/* ── FINAL BANNER ── */}
      <section className="relative z-10 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white py-20 border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Entra al flujo correcto desde el primer clic
          </h2>
          <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto leading-relaxed mb-8">
            Ya no te mandamos a un dashboard genérico. Si vienes a publicar, vuelves al wizard. Si vienes a operar, aterrizas directamente en tu panel.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/login?from=/client/jobs/new"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-md shadow-blue-900/35 transition-colors duration-200"
            >
              Publicar trabajo
            </Link>
            <Link
              href="/login?from=/worker/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-base transition-colors duration-200"
            >
              Entrar como profesional
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
