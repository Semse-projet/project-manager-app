"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Calculator,
  Zap,
  Camera,
  Lock,
  ArrowLeftRight,
  Sparkles,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Play,
  Check,
  UserCheck,
  Calendar,
  LockKeyhole,
  Unlock,
  ShieldCheck,
  CheckSquare,
  Square,
  MessageSquare
} from "lucide-react";

interface ModuleDetail {
  id: string;
  title: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  color: string;
  features: { title: string; desc: string }[];
}

const MODULES_DATA: Record<string, ModuleDetail> = {
  protools: {
    id: "protools",
    title: "ProTools",
    tagline: "El motor de presupuestos paramétricos de SEMSE",
    description: "Calculadoras automáticas que analizan rendimientos, precios de insumos por zona geográfica y mano de obra para que cotizar no sea un juego de adivinanza.",
    icon: Calculator,
    color: "from-blue-500 to-indigo-600",
    features: [
      { title: "Estimaciones por metro cuadrado", desc: "Formularios dinámicos que calculan material y mano de obra según la superficie exacta." },
      { title: "Bases de precios regionales", desc: "Ajuste automático de precios según la oferta y demanda de la ciudad o zona de la obra." },
      { title: "Catálogo de conceptos estandarizados", desc: "Conceptos claros que evitan malentendidos en el alcance del trabajo." }
    ]
  },
  buildops: {
    id: "buildops",
    title: "BuildOps",
    tagline: "Control total de la ejecución diaria en campo",
    description: "La capa operativa que conecta el calendario, las tareas críticas y la supervisión del contratista en una sola fuente de verdad.",
    icon: Zap,
    color: "from-amber-500 to-orange-600",
    features: [
      { title: "Checklists dinámicos por Hito", desc: "Tareas granulares asociadas a cada entrega financiera para asegurar la calidad." },
      { title: "Reporte diario digital", desc: "Bitácora en tiempo real donde los profesionales reportan incidencias o avances." },
      { title: "Control de cronograma", desc: "Líneas de tiempo que se actualizan solas y alertan al cliente sobre posibles desviaciones." }
    ]
  },
  evidence: {
    id: "evidence",
    title: "Evidence Vault",
    tagline: "Transparencia absoluta con evidencias inmutables",
    description: "Bóveda digital para el registro fotográfico y documental de cada etapa. Protege a ambas partes y sirve como testigo objetivo del trabajo.",
    icon: Camera,
    color: "from-cyan-500 to-blue-600",
    features: [
      { title: "Registro fotográfico indexado", desc: "Fotos tomadas en la app con sello de fecha, hora y coordenadas GPS (evita suplantaciones)." },
      { title: "Contrato firmado en Escrow", desc: "Resumen de acuerdos y pliegos técnicos guardados como anexo contractual." },
      { title: "Auditoría de entregables", desc: "Espacio de revisión visual interactivo para aprobar o solicitar correcciones." }
    ]
  },
  escrow: {
    id: "escrow",
    title: "Escrow & Payments",
    tagline: "Depósito en garantía que elimina el riesgo financiero",
    description: "SEMSE retiene los fondos correspondientes a cada hito. El profesional sabe que el dinero existe, y el cliente sabe que solo se libera si aprueba el avance.",
    icon: Lock,
    color: "from-emerald-500 to-teal-600",
    features: [
      { title: "Pagos protegidos por Hito", desc: "Estructura de pagos por avance, evitando adelantos del 50% sin garantías." },
      { title: "Bóveda de liberación automática", desc: "Desbloqueo seguro de fondos en 24h tras la aprobación del cliente." },
      { title: "Conciliación de disputas", desc: "Depósitos asegurados que no se pueden retirar unilateralmente si hay conflicto." }
    ]
  },
  marketplace: {
    id: "marketplace",
    title: "Marketplace Operativo",
    tagline: "Encuentra al profesional ideal con datos, no con promesas",
    description: "Un ecosistema de profesionales verificados. Olvídate de perfiles falsos; aquí eliges por historial operativo, trust score y calificaciones reales.",
    icon: ArrowLeftRight,
    color: "from-orange-500 to-red-600",
    features: [
      { title: "Matching algorítmico", desc: "Sugerencia automática de profesionales basados en la especialidad y cercanía del brief." },
      { title: "Propuestas comparativas", desc: "Vista unificada para contrastar precios, tiempos e historial de candidatos." },
      { title: "Directorio verificado", desc: "Credenciales de identidad, antecedentes penales e impuestos validados." }
    ]
  },
  prometeo: {
    id: "prometeo",
    title: "Prometeo IA",
    tagline: "El motor de agentes autónomos inteligentes",
    description: "Tu copiloto inteligente en obra. Analiza pliegos técnicos, detecta riesgos financieros, sugiere hitos y revisa fotos de avance automáticamente.",
    icon: Sparkles,
    color: "from-purple-500 to-violet-600",
    features: [
      { title: "Análisis RAG de contratos", desc: "IA que extrae cláusulas de riesgo y sugiere mejoras en la redacción." },
      { title: "Auditoría visual automática", desc: "Análisis de imágenes cargadas para corroborar que la tarea (ej. drywall encintado) se completó." },
      { title: "PMO Predictivo", desc: "Detección temprana de retrasos operativos cruzando reportes diarios con el cronograma." }
    ]
  },
  trust: {
    id: "trust",
    title: "Trust & Governance",
    tagline: "Seguridad legal y reputacional en cada transacción",
    description: "La capa que garantiza el orden y las reglas del ecosistema. Desde la resolución imparcial de disputas hasta las licencias validadas.",
    icon: Scale,
    color: "from-rose-500 to-pink-600",
    features: [
      { title: "Trust Score dinámico", desc: "Puntuación de reputación que sube con hitos bien entregados y baja con disputas perdidas." },
      { title: "Intermediación de disputas", desc: "Proceso justo asistido por árbitros reales ante discrepancias en la calidad." },
      { title: "Verificación KYC avanzada", desc: "Doble factor de identidad y validación oficial de licencias profesionales." }
    ]
  }
};

export default function ModulePage() {
  const { id } = useParams() as { id: string };
  const data = useMemo(() => MODULES_DATA[id] || MODULES_DATA.protools!, [id]);

  // Interactive widget states
  const [calcArea, setCalcArea] = useState(60);
  const [calcQuality, setCalcQuality] = useState<"standard" | "premium">("standard");

  const [tasks, setTasks] = useState([
    { id: 1, text: "Demolición y limpieza del baño", checked: true, hito: "Hito 1" },
    { id: 2, text: "Instalación de tubería hidráulica de cobre", checked: false, hito: "Hito 2" },
    { id: 3, text: "Colocación de azulejo porcelánico", checked: false, hito: "Hito 2" },
    { id: 4, text: "Montaje de sanitario y grifería final", checked: false, hito: "Hito 3" }
  ]);

  const [sliderPos, setSliderPos] = useState(50);

  const [escrowStep, setEscrowStep] = useState<1 | 2 | 3 | 4>(1);

  const [matchFilter, setMatchFilter] = useState("all");

  const [promptInput, setPromptInput] = useState("Analiza los riesgos de pintar un depto de 80m²");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const handleTaskToggle = (tid: number) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === tid ? { ...t, checked: !t.checked } : t))
    );
  };

  const handleRunAi = () => {
    setAiLoading(true);
    setAiResponse("");
    setTimeout(() => {
      if (promptInput.toLowerCase().includes("riesgos")) {
        setAiResponse(
          "Prometeo IA:\n- **Riesgo Detectado**: Humedad preexistente en el muro colindante al baño. Sugiero hito de sellado acrílico antes de pintar.\n- **Altura**: 2.8m requiere andamios estándar (cumplimiento de seguridad obligatorio).\n- **Presupuesto**: El costo de pintura premium Sherwin-Williams aumentará un 22% los materiales."
        );
      } else {
        setAiResponse(
          "Prometeo IA:\n- **Alcance**: Se requiere preparar superficies, resanar fisuras menores y aplicar 2 manos de pintura.\n- **Hitos Recomendados**: Hito 1: Preparación (20%), Hito 2: Pintura de muros (50%), Hito 3: Acabado y limpieza (30%)."
        );
      }
      setAiLoading(false);
    }, 1200);
  };

  const IconComponent = data.icon;

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)] py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300">
      
      {/* Background radial highlights */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[60%] rounded-full bg-blue-400/5 dark:bg-blue-600/5 blur-[120px]" />
        <div className="absolute top-[30%] -right-[10%] w-[45%] h-[55%] rounded-full bg-indigo-400/5 dark:bg-indigo-600/5 blur-[120px]" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10 space-y-12">
        
        {/* Navigation & Header */}
        <div className="flex justify-between items-center pb-6 border-b border-slate-200/50 dark:border-slate-800/60">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-550 dark:text-slate-400 hover:text-[var(--brand)] transition-colors no-underline"
          >
            <ArrowLeft size={16} />
            Volver a SEMSEproject
          </Link>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Detalle de Módulo
          </span>
        </div>

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className={`mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br ${data.color} text-white flex items-center justify-center shadow-lg`}>
            <IconComponent size={32} />
          </div>
          <span className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 block pt-2">
            {data.tagline}
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white leading-[1.1] tracking-tight">
            Módulo {data.title}
          </h1>
          <p className="text-sm sm:text-base text-slate-550 dark:text-slate-450 leading-relaxed">
            {data.description}
          </p>
        </div>

        {/* Grid of Sub-features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {data.features.map((f, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 p-6 rounded-2xl flex flex-col justify-between"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 font-bold text-sm">
                0{i + 1}
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white mb-2">
                  {f.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Interactive Showcase Box */}
        <div className="bg-white/40 dark:bg-slate-900/10 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-6 sm:p-8 md:p-10 backdrop-blur-md shadow-xl relative overflow-hidden">
          
          <div className="flex items-center gap-2 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[10px] text-slate-450 font-black uppercase tracking-widest">
              Simulador Interactivo del Módulo
            </span>
          </div>

          {/* ──────────────── WIDGET: PROTOOLS ──────────────── */}
          {id === "protools" && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-6 space-y-5">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Calculador Paramétrico de Pintura
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Modifica los controles a continuación para ver cómo ProTools estima costos instantáneamente cruzando rendimientos de mano de obra y materiales.
                </p>

                <div className="space-y-4">
                  {/* Slider Area */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-655">
                      <span>Superficie de Muro</span>
                      <span>{calcArea} m²</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={200}
                      value={calcArea}
                      onChange={(e) => setCalcArea(parseInt(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none"
                    />
                  </div>

                  {/* Quality Buttons */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Acabado</span>
                    <div className="flex gap-3">
                      {(["standard", "premium"] as const).map((q) => (
                        <button
                          key={q}
                          onClick={() => setCalcQuality(q)}
                          className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                            calcQuality === q
                              ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                              : "bg-white/40 dark:bg-slate-900/20 border-slate-200/50 dark:border-slate-800/40 text-slate-500 hover:bg-white"
                          }`}
                        >
                          {q === "standard" ? "Vinílica Estándar" : "Sherwin Premium"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Output */}
              <div className="md:col-span-6 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-850 p-6 rounded-2xl space-y-4 text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">Presupuesto Estimado</span>
                <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                  ${(calcArea * (calcQuality === "standard" ? 120 : 260)).toLocaleString("es-MX")} MXN
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-slate-200/40 dark:border-slate-800/60 pt-4 text-left">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-semibold">Materiales</span>
                    <span className="text-xs font-bold block">${Math.round(calcArea * (calcQuality === "standard" ? 48 : 110)).toLocaleString("es-MX")} MXN</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-semibold">Mano de Obra</span>
                    <span className="text-xs font-bold block">${Math.round(calcArea * (calcQuality === "standard" ? 72 : 150)).toLocaleString("es-MX")} MXN</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 leading-relaxed pt-1 block">
                  *Valores estimados con un margen de confianza del 94% basados en la plaza de CDMX.
                </div>
              </div>
            </div>
          )}

          {/* ──────────────── WIDGET: BUILDOPS ──────────────── */}
          {id === "buildops" && (
            <div className="space-y-6">
              <div className="max-w-2xl">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Tablero de Tareas de Obra
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                  BuildOps organiza las entregas en micro-tareas asociadas a hitos del contrato. Marca una tarea como completada para ver cómo avanza el proyecto en tiempo real.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                <div className="md:col-span-7 space-y-3 bg-white dark:bg-slate-950 p-4 border border-slate-200/50 dark:border-slate-850 rounded-2xl">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2">Checklist de Hito Activo</span>
                  <div className="space-y-2.5">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => handleTaskToggle(task.id)}
                        className="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200/40 dark:border-slate-800/60 rounded-xl cursor-pointer select-none transition-colors duration-150"
                      >
                        {task.checked ? (
                          <CheckSquare size={16} className="text-emerald-500 shrink-0" />
                        ) : (
                          <Square size={16} className="text-slate-400 shrink-0" />
                        )}
                        <div className="flex-1 flex justify-between items-center gap-2">
                          <span className={`text-xs ${task.checked ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-250 font-bold"}`}>
                            {task.text}
                          </span>
                          <span className="text-[9px] font-black uppercase tracking-wider bg-slate-200/40 dark:bg-slate-800 text-slate-450 px-2 py-0.5 rounded shrink-0">
                            {task.hito}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-5 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-850 p-6 rounded-2xl space-y-4">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block text-center">Estado del Proyecto</span>
                  
                  <div className="space-y-1.5 text-center">
                    <div className="text-3xl font-black text-slate-900 dark:text-white">
                      {Math.round((tasks.filter((t) => t.checked).length / tasks.length) * 100)}%
                    </div>
                    <span className="text-[10px] text-slate-450 uppercase font-bold">Tareas completadas</span>
                  </div>

                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                      style={{ width: `${(tasks.filter((t) => t.checked).length / tasks.length) * 100}%` }}
                    />
                  </div>

                  <div className="border-t border-slate-200/40 dark:border-slate-800/60 pt-4 text-xs text-slate-400 leading-relaxed">
                    Las tareas del <strong>Hito 2</strong> deben completarse al 100% para poder solicitar la liberación del segundo pago de depósito.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────── WIDGET: EVIDENCE ──────────────── */}
          {id === "evidence" && (
            <div className="space-y-6">
              <div className="max-w-2xl">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Comparador Visual de Avance (Antes y Después)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                  Evidence Vault aloja registros visuales auditados. Usa el deslizador para comparar el estado inicial del espacio frente al trabajo de loseta cerámico finalizado.
                </p>
              </div>

              <div className="relative w-full max-w-2xl h-[300px] rounded-2xl overflow-hidden shadow-lg border border-slate-200/50 dark:border-slate-850 select-none">
                
                {/* Before Image (Background) */}
                <div className="absolute inset-0 bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-sm bg-[url('https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=800')] bg-cover bg-center">
                  <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded-lg text-white font-bold text-xs uppercase">
                    Antes (Demolición)
                  </div>
                </div>

                {/* After Image (Foreground, clipped) */}
                <div
                  className="absolute inset-y-0 left-0 bg-slate-700 bg-[url('https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&q=80&w=800')] bg-cover bg-center"
                  style={{ width: `${sliderPos}%` }}
                >
                  <div className="absolute top-4 right-4 bg-blue-600/80 px-3 py-1 rounded-lg text-white font-bold text-xs uppercase shrink-0">
                    Después (Terminado)
                  </div>
                </div>

                {/* Vertical Divider & Slider handle */}
                <div
                  className="absolute inset-y-0 w-1 bg-white cursor-ew-resize flex items-center justify-center"
                  style={{ left: `${sliderPos}%` }}
                >
                  <div className="w-8 h-8 rounded-full bg-white text-slate-800 shadow-md border border-slate-200 flex items-center justify-center -ml-3.5 select-none font-bold text-xs">
                    ↔
                  </div>
                </div>

                {/* Invisible drag overlay */}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sliderPos}
                  onChange={(e) => setSliderPos(parseInt(e.target.value))}
                  className="absolute inset-0 opacity-0 cursor-ew-resize z-20 w-full h-full"
                />

              </div>
              <div className="text-[10px] text-slate-400 leading-relaxed block max-w-2xl">
                *Cada imagen cuenta con cifrado SHA-256 e información EXIF no modificable para certificar la veracidad de la entrega visual.
              </div>
            </div>
          )}

          {/* ──────────────── WIDGET: ESCROW ──────────────── */}
          {id === "escrow" && (
            <div className="space-y-8">
              <div className="max-w-2xl">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Simulador de Flujo de Pago en Escrow
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                  Haz clic en las etapas inferiores para ver cómo funciona el flujo de protección y liberación del dinero en la bóveda de SEMSEproject.
                </p>
              </div>

              {/* Vault Visualization */}
              <div className="bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-850 p-8 rounded-3xl max-w-2xl mx-auto flex flex-col items-center justify-center text-center space-y-4 min-h-[200px]">
                
                <AnimatePresence mode="wait">
                  {escrowStep === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="space-y-3"
                    >
                      <div className="w-14 h-14 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                        <LockKeyhole size={28} />
                      </div>
                      <h4 className="font-bold text-sm text-slate-850">Etapa 1: Hito Creado y Pendiente</h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        El proyecto se desglosa por etapas claras. El dinero de este hito ($4,500 MXN) está en manos del cliente. Aún no se ha realizado depósito.
                      </p>
                    </motion.div>
                  )}

                  {escrowStep === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="space-y-3"
                    >
                      <div className="w-14 h-14 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                        <LockKeyhole size={28} />
                      </div>
                      <h4 className="font-bold text-sm text-blue-600 dark:text-blue-400">Etapa 2: Garantía Protegida (Locked)</h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        El cliente deposita el monto en la bóveda de escrow de SEMSE. El contratista ve los fondos validados y protegidos, por lo que inicia la obra con confianza.
                      </p>
                    </motion.div>
                  )}

                  {escrowStep === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="space-y-3"
                    >
                      <div className="w-14 h-14 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                        <ShieldCheck size={28} className="animate-bounce" />
                      </div>
                      <h4 className="font-bold text-sm text-amber-600 dark:text-amber-400">Etapa 3: Evidencia Enviada y en Aprobación</h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        El profesional sube fotos del hito finalizado. Prometeo IA audita las imágenes. El cliente recibe la notificación de revisión de avance.
                      </p>
                    </motion.div>
                  )}

                  {escrowStep === 4 && (
                    <motion.div
                      key="step4"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="space-y-3"
                    >
                      <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                        <Unlock size={28} />
                      </div>
                      <h4 className="font-bold text-sm text-emerald-600 dark:text-emerald-400">Etapa 4: Fondos Liberados al Profesional</h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        El cliente aprueba la entrega (o Prometeo valida sin objeción). La bóveda se desbloquea y el dinero es transferido instantáneamente a la cuenta del profesional.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>

              {/* Steps buttons control */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                {([1, 2, 3, 4] as const).map((stepNum) => {
                  const label = ["Hito Creado", "Pago en Escrow", "Revisión", "Liberado"][stepNum - 1];
                  return (
                    <button
                      key={stepNum}
                      onClick={() => setEscrowStep(stepNum)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                        escrowStep === stepNum
                          ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                          : "bg-white/40 dark:bg-slate-900/20 border-slate-200/50 dark:border-slate-800/40 text-slate-500 hover:bg-white"
                      }`}
                    >
                      {stepNum}. {label}
                    </button>
                  );
                })}
              </div>

            </div>
          )}

          {/* ──────────────── WIDGET: MARKETPLACE ──────────────── */}
          {id === "marketplace" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Matching Inteligente de Contratistas
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                    El marketplace clasifica a los candidatos en base a coincidencia geográfica y reputación. Filtra por Trust Score.
                  </p>
                </div>
                {/* Filters */}
                <div className="flex gap-2">
                  {[
                    { id: "all", name: "Todos" },
                    { id: "high", name: "Trust > 90" }
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setMatchFilter(f.id)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                        matchFilter === f.id
                          ? "bg-slate-900 border-slate-900 text-white dark:bg-slate-100 dark:border-slate-100 dark:text-slate-900"
                          : "bg-white/40 dark:bg-slate-900/20 border-slate-200/50 dark:border-slate-800/40 text-slate-500"
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid matching */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
                {[
                  { name: "Adrián Reyes", score: 96, trust: 96, jobs: 48, specialty: "Electricidad", status: "Disponible" },
                  { name: "Ing. Carlos Mendieta", score: 92, trust: 94, jobs: 120, specialty: "Remodelaciones", status: "Disponible" },
                  { name: "Marcos Torres", score: 85, trust: 88, jobs: 12, specialty: "Pintura", status: "Disponible" }
                ]
                  .filter((c) => matchFilter === "all" || c.trust >= 90)
                  .map((candidate, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-slate-950 p-5 border border-slate-200/60 dark:border-slate-850 rounded-2xl flex justify-between items-start"
                    >
                      <div className="space-y-2">
                        <div>
                          <span className="text-[10px] text-blue-500 font-extrabold uppercase bg-blue-500/10 px-2 py-0.5 rounded">
                            {candidate.specialty}
                          </span>
                          <h4 className="font-extrabold text-sm text-slate-850 mt-1.5">{candidate.name}</h4>
                        </div>
                        <div className="flex gap-3 text-[10px] text-slate-400 font-semibold">
                          <span>{candidate.jobs} obras</span>
                          <span>{candidate.trust} trust score</span>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <span className="text-[10px] text-slate-450 uppercase font-bold block">Compatibilidad</span>
                        <span className="text-base font-black text-slate-900 dark:text-white block">
                          {candidate.score}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ──────────────── WIDGET: PROMETEO IA ──────────────── */}
          {id === "prometeo" && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
              <div className="md:col-span-6 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Análisis de Riesgos con Prometeo
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Escribe o selecciona una consulta de obra para ver cómo el agente inteligente procesa el contexto en tiempo real utilizando RAG.
                  </p>

                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Elige un prompt de prueba</span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Analiza los riesgos de pintar un depto de 80m²",
                        "Hitos recomendados para carpintería de clósets"
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => setPromptInput(prompt)}
                          className="text-[10px] font-bold py-1.5 px-3 rounded-lg bg-purple-500/10 border border-purple-500/15 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Prompt del Usuario</span>
                    <input
                      type="text"
                      value={promptInput}
                      onChange={(e) => setPromptInput(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/40 text-[var(--ink)] focus:outline-none focus:border-purple-550"
                    />
                  </div>
                </div>

                <button
                  onClick={handleRunAi}
                  disabled={aiLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/10 cursor-pointer transition-colors duration-150"
                >
                  <Sparkles size={14} className={aiLoading ? "animate-spin" : ""} />
                  {aiLoading ? "Analizando pliegos..." : "Analizar con Prometeo"}
                </button>
              </div>

              {/* Output */}
              <div className="md:col-span-6 bg-slate-950 border border-slate-850 p-6 rounded-2xl flex flex-col justify-between min-h-[220px] font-mono relative">
                <div className="absolute top-4 right-4 pointer-events-none">
                  <span className="text-[8px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded tracking-widest uppercase">
                    RAG Runtime
                  </span>
                </div>
                
                <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap flex-1">
                  {aiLoading ? (
                    <span className="text-purple-400 animate-pulse block pt-1">
                      [INFO] Cargando contexto del mercado...
                      <br />
                      [RAG] Recuperando pliegos de drywall y acabados...
                      <br />
                      [PROMETEO] Ejecutando análisis de riesgos...
                    </span>
                  ) : aiResponse ? (
                    aiResponse
                  ) : (
                    <span className="text-slate-500">
                      Haz clic en "Analizar con Prometeo" para disparar la consulta asistida con agentes de inteligencia...
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ──────────────── WIDGET: TRUST ──────────────── */}
          {id === "trust" && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-6 space-y-5">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Credencial Profesional Verificada
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Trust & Governance audita la identidad y licencias de los técnicos. Mira el diseño de una credencial del sistema que cuenta con verificación activa en tiempo real.
                </p>

                <div className="space-y-3 border-t border-slate-200/50 dark:border-slate-800/60 pt-4">
                  <div className="flex items-center gap-2 text-xs text-slate-550">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    <span>Identidad KYC aprobada con biometría facial.</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-550">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    <span>Antecedentes penales y fiscales validados.</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-550">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    <span>Licencias y certificaciones activas de plomería y gas.</span>
                  </div>
                </div>
              </div>

              {/* Credential Badge */}
              <div className="md:col-span-6 bg-slate-50/50 dark:bg-slate-950/40 border-2 border-emerald-500/20 p-6 rounded-2xl space-y-5 max-w-sm mx-auto relative overflow-hidden shadow-md">
                {/* Glow accent */}
                <div className="absolute -right-8 -top-8 w-20 h-20 rounded-full bg-emerald-500/10 blur-xl pointer-events-none" />

                <div className="flex justify-between items-start border-b border-slate-200/40 dark:border-slate-800/60 pb-4">
                  <div>
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest leading-none">Ecosistema SEMSE</span>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-none mt-1">Adrián Reyes</h4>
                    <span className="text-[10px] text-slate-400 mt-1 block">Técnico Electricista</span>
                  </div>
                  <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0">
                    <UserCheck size={10} />
                    Activo
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-left">
                  <div>
                    <span className="text-[8px] text-slate-400 uppercase font-semibold">Trust Score</span>
                    <span className="text-base font-black text-slate-800 dark:text-white block">96 / 100</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-400 uppercase font-semibold">Obras Listas</span>
                    <span className="text-base font-black text-slate-800 dark:text-white block">48 completadas</span>
                  </div>
                </div>

                <div className="border-t border-slate-200/40 dark:border-slate-800/60 pt-4 flex items-center justify-between text-[10px] text-slate-400 font-bold">
                  <span>Licencia: #ELE-2026-9912</span>
                  <span>Verificación: 09 Jun 2026</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Action Bottom */}
        <div className="text-center pt-8 border-t border-slate-200/50 dark:border-slate-800/60">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 active:scale-98 transition-all duration-200 no-underline"
          >
            Empezar hoy mismo con SEMSEproject
          </Link>
        </div>

      </div>
    </main>
  );
}
