"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Sparkles,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  AlertTriangle,
  FileText,
  UserCheck,
  Wrench,
  ChevronRight,
  TrendingUp,
  Brain
} from "lucide-react";

interface JobDef {
  id: string;
  title: string;
  category: string;
  scope: string;
  budgetMin: number;
  budgetMax: number;
  location: string;
  urgency: string;
}

const JOBS: JobDef[] = [
  {
    id: "job-1",
    title: "Pintura de departamento completo",
    category: "Pintura",
    scope: "Se requiere pintar paredes y techos de un departamento de 80m2. Incluye sala, cocina, pasillo y 2 recámaras. Se proporciona pintura vinílica mate de primera calidad.",
    budgetMin: 3500,
    budgetMax: 5000,
    location: "Naucalpan, Mex.",
    urgency: "urgente",
  },
  {
    id: "job-2",
    title: "Reparación de plafón de tablaroca dañado por humedad",
    category: "Drywall",
    scope: "Reparación de sección de 1.5 x 2 metros en plafón de cocina. Requires cambio de placas, encintado, compuesto y preparación final para pintura.",
    budgetMin: 1800,
    budgetMax: 2600,
    location: "Benito Juárez, CDMX",
    urgency: "alta",
  },
  {
    id: "job-3",
    title: "Remodelación de baño de visitas",
    category: "Remodelación",
    scope: "Instalación de nueva loseta cerámica en muros y piso, cambio de taza de baño, lavamanos y colocación de accesorios de grifería.",
    budgetMin: 8500,
    budgetMax: 12000,
    location: "San Pedro Garza, NL",
    urgency: "estándar",
  },
  {
    id: "job-4",
    title: "Mantenimiento preventivo de aire acondicionado",
    category: "Mantenimiento",
    scope: "Servicio de limpieza y recarga de refrigerante para 3 equipos minisplit inverter de 1.5 toneladas.",
    budgetMin: 1500,
    budgetMax: 2200,
    location: "Mérida, Yuc.",
    urgency: "estándar",
  },
  {
    id: "job-5",
    title: "Instalación de piso laminado residencial",
    category: "Pisos",
    scope: "Colocación de piso laminado de 8mm sobre superficie nivelada en recámara principal y vestidor. Aprox 30m2.",
    budgetMin: 4000,
    budgetMax: 5500,
    location: "Zapopan, Jal.",
    urgency: "alta",
  }
];

export default function ApplyPage() {
  const { id } = useParams() as { id: string };
  const [activeTab, setActiveTab] = useState<"analysis" | "materials">("analysis");
  const [step, setStep] = useState<"workspace" | "register" | "submitted">("workspace");

  // Counter-bid Sliders
  const [laborPrice, setLaborPrice] = useState(2000);
  const [materialsPrice, setMaterialsPrice] = useState(1500);
  const [marginPercent, setMarginPercent] = useState(15);
  const [proposalLetter, setProposalLetter] = useState("");

  // Account creation fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const job = useMemo(() => {
    return JOBS.find((j) => j.id === id) || JOBS[0]!;
  }, [id]);

  // Adjust sliders to match the job budget initially
  useEffect(() => {
    const totalMid = (job.budgetMin + job.budgetMax) / 2;
    setLaborPrice(Math.round(totalMid * 0.55));
    setMaterialsPrice(Math.round(totalMid * 0.35));
    setMarginPercent(15);
    setProposalLetter(
      `Estimado cliente,\n\nCuento con la experiencia necesaria en trabajos de ${job.category}. He analizado el proyecto y le adjunto mi propuesta detallada con hitos claros y evidencias para su tranquilidad. Quedo a sus órdenes.`
    );
  }, [job]);

  // Real-time counter bid calculations
  const subtotal = laborPrice + materialsPrice;
  const marginValue = Math.round((subtotal * marginPercent) / 100);
  const totalBid = subtotal + marginValue;

  const isBiggerThanBudget = totalBid > job.budgetMax;
  const isSlightlyBigger = totalBid > job.budgetMin && totalBid <= job.budgetMax;
  const isCompetitive = totalBid <= job.budgetMin;

  // Mock Prometeo intelligence breakdown
  const prometeoAnalysis = useMemo(() => {
    let risks: string[] = [];
    let tools: string[] = [];
    let tips: string[] = [];

    if (job.category === "Pintura") {
      risks = [
        "Posibles filtraciones o humedad en esquinas superiores (revisar antes de aplicar primera mano).",
        "Áreas altas requieren andamios o rodillos de extensión de 3 metros."
      ];
      tools = ["Rodillos de felpa media", "Cinta azul de pintor (3M)", "Plásticos protectores de alta densidad"];
      tips = [
        "Cotizar pintura lavable satinada para mayor durabilidad comercial.",
        "Sugerir un hito de preparación de muros para asegurar buena adherencia."
      ];
    } else if (job.category === "Drywall") {
      risks = [
        "Estructura metálica interna dañada por filtración hidráulica.",
        "Diferencia de textura entre muro existente y parche nuevo (blend-to-match)."
      ];
      tools = ["Compuesto Ready-Mix", "Cinta de fibra de vidrio", "Lijadora orbital con aspiración"];
      tips = [
        "Aplicar tres manos de compuesto ultra-fino lijando en seco entre cada una.",
        "Utilizar un hito exclusivo para secado de yeso antes de pintar."
      ];
    } else if (job.category === "Remodelación") {
      risks = [
        "Tuberías de cobre antiguas con riesgo de corrosión interna.",
        "Nivelación del firme o solera de concreto insuficiente para loseta porcelánica de gran formato."
      ];
      tools = ["Cortadora de azulejo manual", "Adhesivo cerámico de alto desempeño", "Nivel láser autonivelante"];
      tips = [
        "Asegurar impermeabilización elastomérica en área de regadera (hito obligatorio).",
        "Sugerir nicho empotrado para optimizar espacios de almacenamiento."
      ];
    } else {
      risks = [
        "Especificaciones del fabricante o certificados de materiales vencidos.",
        "Ajuste inadecuado de uniones mecánicas bajo carga."
      ];
      tools = ["Juego de llaves torque", "Multímetro digital calibrado", "Arnés de seguridad anticaídas"];
      tips = [
        "Sugerir un mantenimiento programado semestral con descuento en escrow.",
        "Tomar fotos detalladas de placas de datos técnicos antes de desmontar."
      ];
    }

    return { risks, tools, tips };
  }, [job]);

  const handleSubmitCounterBid = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("register");
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("submitted");
  };

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)] py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300">
      
      {/* Background decorations */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-blue-500/5 blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10 space-y-8">
        
        {/* Navigation / Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-550 dark:text-slate-400 hover:text-[var(--brand)] transition-colors no-underline"
          >
            <ArrowLeft size={16} />
            Volver a SEMSEproject
          </Link>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-bold text-blue-600 dark:text-blue-400">
            <Brain size={12} className="animate-pulse" />
            <span>Workspace de Postulación Asistida con IA</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === "workspace" && (
            <motion.div
              key="workspace-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch"
            >
              
              {/* Left Panel: Proposal Details (4 cols) */}
              <div className="lg:col-span-4 bg-white/40 dark:bg-slate-900/10 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-lg flex flex-col justify-between">
                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest block">
                      Solicitud del Cliente
                    </span>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                      {job.title}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold text-slate-450">
                    <span className="bg-slate-100 dark:bg-slate-850 px-2.5 py-1 rounded-lg uppercase">
                      {job.category}
                    </span>
                    <span className="text-slate-300 dark:text-slate-800">•</span>
                    <span>📍 {job.location}</span>
                    <span className="text-slate-300 dark:text-slate-800">•</span>
                    <span className={`capitalize ${job.urgency === "urgente" ? "text-red-500 font-extrabold" : "text-amber-500"}`}>
                      Urgencia: {job.urgency}
                    </span>
                  </div>

                  <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-5 space-y-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest block">
                      Presupuesto de Referencia
                    </span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white block">
                      ${job.budgetMin.toLocaleString("es-MX")} - ${job.budgetMax.toLocaleString("es-MX")} MXN
                    </span>
                  </div>

                  <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-5">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest block mb-2.5">
                      Descripción del Trabajo
                    </span>
                    <p className="text-sm text-slate-650 dark:text-slate-400 leading-relaxed">
                      {job.scope}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-6 mt-8 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    <span>Contrato protegido por Escrow</span>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">
                    Tus fondos están seguros. El cliente deposita la garantía antes del inicio de obra y se libera automáticamente al entregar evidencias validadas por hito.
                  </p>
                </div>

              </div>

              {/* Center Panel: Prometeo Workspace (4 cols) */}
              <div className="lg:col-span-4 bg-white/40 dark:bg-slate-900/10 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 border-b border-slate-200/50 dark:border-slate-800/50 pb-4 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-none">
                        Prometeo IA Co-pilot
                      </h3>
                      <span className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">
                        Auditor de Presupuestos
                      </span>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-slate-200/50 dark:border-slate-800/50 mb-5">
                    <button
                      onClick={() => setActiveTab("analysis")}
                      className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all ${
                        activeTab === "analysis"
                          ? "border-purple-500 text-purple-600 dark:text-purple-400"
                          : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600"
                      }`}
                    >
                      Diagnóstico de Riesgos
                    </button>
                    <button
                      onClick={() => setActiveTab("materials")}
                      className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all ${
                        activeTab === "materials"
                          ? "border-purple-500 text-purple-600 dark:text-purple-400"
                          : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600"
                      }`}
                    >
                      Herramientas Sugeridas
                    </button>
                  </div>

                  <div className="space-y-5">
                    {activeTab === "analysis" ? (
                      <div className="space-y-4">
                        {/* Risks Block */}
                        <div className="space-y-2.5">
                          <span className="text-[10px] text-red-500 font-black uppercase tracking-wider flex items-center gap-1.5">
                            <AlertTriangle size={12} />
                            Señales de Alerta de Obra
                          </span>
                          <div className="space-y-2">
                            {prometeoAnalysis.risks.map((risk, index) => (
                              <div key={index} className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                                <span className="leading-relaxed">{risk}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Estimations Advice */}
                        <div className="space-y-2.5 pt-2">
                          <span className="text-[10px] text-purple-500 font-black uppercase tracking-wider flex items-center gap-1.5">
                            <Brain size={12} />
                            Recomendaciones de Cotización
                          </span>
                          <div className="space-y-2">
                            {prometeoAnalysis.tips.map((tip, index) => (
                              <div key={index} className="p-3 bg-purple-550/5 border border-purple-500/10 rounded-xl flex items-start gap-2.5 text-xs text-purple-700 dark:text-purple-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                                <span className="leading-relaxed">{tip}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2.5">
                          <span className="text-[10px] text-blue-500 font-black uppercase tracking-wider flex items-center gap-1.5">
                            <Wrench size={12} />
                            Equipo y Material Requerido
                          </span>
                          <div className="space-y-2">
                            {prometeoAnalysis.tools.map((tool, index) => (
                              <div key={index} className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                  <span>{tool}</span>
                                </div>
                                <span className="text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded uppercase">
                                  Esencial
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">
                          *El contratista debe proveer estas herramientas de manera obligatoria bajo las normativas del ecosistema SEMSE.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-850 p-4 rounded-2xl mt-8">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest block mb-1">
                    Análisis RAG del Pliego
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed block">
                    Prometeo ha indexado la descripción del trabajo contra 43 proyectos similares completados en la zona para calibrar el algoritmo de estimación.
                  </span>
                </div>

              </div>

              {/* Right Panel: Counter-Bidding (4 cols) */}
              <div className="lg:col-span-4 bg-white/40 dark:bg-slate-900/10 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-lg flex flex-col justify-between">
                
                <form onSubmit={handleSubmitCounterBid} className="space-y-6 flex-1 flex flex-col justify-between">
                  <div className="space-y-5">
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest block">
                        Crea tu Presupuesto Personalizado
                      </span>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                        Ajusta tu Propuesta
                      </h3>
                    </div>

                    {/* Labor Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-655 dark:text-slate-355">
                        <span>Mano de Obra</span>
                        <span>${laborPrice.toLocaleString("es-MX")} MXN</span>
                      </div>
                      <input
                        type="range"
                        min={500}
                        max={15000}
                        step={100}
                        value={laborPrice}
                        onChange={(e) => setLaborPrice(parseInt(e.target.value))}
                        className="w-full accent-blue-600 dark:accent-blue-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none"
                      />
                    </div>

                    {/* Materials Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-655 dark:text-slate-355">
                        <span>Materiales & Consumibles</span>
                        <span>${materialsPrice.toLocaleString("es-MX")} MXN</span>
                      </div>
                      <input
                        type="range"
                        min={300}
                        max={10000}
                        step={100}
                        value={materialsPrice}
                        onChange={(e) => setMaterialsPrice(parseInt(e.target.value))}
                        className="w-full accent-blue-600 dark:accent-blue-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none"
                      />
                    </div>

                    {/* Profit Margin Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-655 dark:text-slate-355">
                        <span>Margen de Ganancia ({marginPercent}%)</span>
                        <span>${marginValue.toLocaleString("es-MX")} MXN</span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={40}
                        value={marginPercent}
                        onChange={(e) => setMarginPercent(parseInt(e.target.value))}
                        className="w-full accent-blue-600 dark:accent-blue-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none"
                      />
                    </div>

                    {/* Proposal Letter */}
                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest block">
                        Carta de Presentación
                      </label>
                      <textarea
                        value={proposalLetter}
                        onChange={(e) => setProposalLetter(e.target.value)}
                        className="w-full min-h-[90px] text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/40 text-[var(--ink)] focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Calculated Output & Submit */}
                  <div className="mt-8 pt-5 border-t border-slate-200/50 dark:border-slate-800/50 space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none">
                          Total de tu Propuesta
                        </span>
                        <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                          ${totalBid.toLocaleString("es-MX")} <span className="text-xs font-bold text-slate-400">MXN</span>
                        </div>
                      </div>

                      {/* Status indicator */}
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-black uppercase shrink-0 ${
                        isCompetitive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                        isSlightlyBigger ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                        "bg-red-500/10 text-red-655"
                      }`}>
                        {isCompetitive ? "Muy Competitiva" : isSlightlyBigger ? "En Rango" : "Sobre Presupuesto"}
                      </span>
                    </div>

                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 active:scale-98 transition-all duration-200 cursor-pointer"
                    >
                      Enviar Contraoferta en Escrow
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </form>

              </div>

            </motion.div>
          )}

          {step === "register" && (
            <motion.div
              key="register-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto bg-white/40 dark:bg-slate-900/10 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-xl"
            >
              <div className="text-center mb-6">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                  <UserCheck size={22} />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Crea tu Cuenta en SEMSE Project
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  Para registrar tu contraoferta de <strong>${totalBid.toLocaleString("es-MX")} MXN</strong> en el escrow de este proyecto, crea tus credenciales profesionales.
                </p>
              </div>

              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest block">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej: Adrián Reyes"
                    className="w-full text-sm p-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/40 text-[var(--ink)] focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest block">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="reyes.electricos@gmail.com"
                    className="w-full text-sm p-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/40 text-[var(--ink)] focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest block">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-sm p-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/40 text-[var(--ink)] focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/10 hover:shadow-lg active:scale-98 transition-all duration-200 cursor-pointer"
                  >
                    Crear Cuenta y Enviar Propuesta
                  </button>
                </div>
              </form>

              <div className="text-center mt-4">
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  ¿Ya tienes cuenta? <Link href="/login" className="text-blue-500 hover:underline">Inicia sesión aquí</Link>
                </span>
              </div>
            </motion.div>
          )}

          {step === "submitted" && (
            <motion.div
              key="submitted-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-lg mx-auto bg-white/40 dark:bg-slate-900/10 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-8 sm:p-10 backdrop-blur-md shadow-2xl text-center space-y-6"
            >
              <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 size={32} />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  ¡Contraoferta Enviada en Escrow!
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Felicidades, <strong>{fullName}</strong>. Tu propuesta para el trabajo de <em>"{job.title}"</em> por <strong>${totalBid.toLocaleString("es-MX")} MXN</strong> ha sido registrada exitosamente.
                </p>
              </div>

              <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-xs text-emerald-600 dark:text-emerald-400 space-y-2 text-left">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck size={14} />
                  Estado del Flujo Seguro SEMSE:
                </div>
                <ul className="list-disc list-inside space-y-1 p-0 m-0">
                  <li>El cliente ha sido notificado mediante RAG matching.</li>
                  <li>Los fondos del presupuesto serán retenidos en Escrow temporal.</li>
                  <li>Prometeo IA auditará las fotos cargadas para liberar cada hito.</li>
                </ul>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md active:scale-98 transition-all duration-200"
                >
                  Volver al Ecosistema
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[var(--ink)] border border-slate-200 dark:border-slate-700 font-semibold text-sm active:scale-98 transition-all duration-200"
                >
                  Ir al Workspace Personal
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </main>
  );
}
