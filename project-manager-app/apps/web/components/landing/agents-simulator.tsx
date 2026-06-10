"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  GitBranch,
  Wrench,
  Fingerprint,
  DollarSign,
  Sparkles,
  Terminal,
  ShieldAlert,
  RefreshCw,
  MessageSquare,
  Send,
  User,
  Bot
} from "lucide-react";

interface AgentDef {
  id: string;
  displayName: string;
  role: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  color: string;
  capabilities: string[];
  forbiddenActions: string[];
  modules: string[];
  integratesWith: string[];
  logs: string[];
}

const AGENTS_DATA: AgentDef[] = [
  {
    id: "marketplace",
    displayName: "Marketplace Agent",
    role: "Inteligencia comercial — conecta demanda con oferta y escala el ecosistema",
    icon: Users,
    color: "from-blue-500 to-indigo-500",
    capabilities: [
      "Clasificar y publicar proyectos",
      "Matching cliente-profesional por oficio, zona y reputación",
      "Ranking y disponibilidad de contratistas",
      "Routing de leads por categoría y geografía",
      "Gestionar reviews y reputación"
    ],
    forbiddenActions: [
      "Gestionar ejecución del proyecto después de asignado",
      "Calcular materiales o costos detallados",
      "Manejar pagos o disputas directamente"
    ],
    modules: ["ServiceCatalog", "ContractorMatcher", "LeadRouter", "ReputationEngine"],
    integratesWith: ["protools", "buildops", "evidence", "prometeo"],
    logs: [
      "[Marketplace] Analizando solicitud entrante: 'Remodelación de baño principal'.",
      "[Marketplace] Oficio clasificado: Albañilería / Plomería técnica.",
      "[Marketplace] Filtrando contratistas disponibles en zona de servicio...",
      "[Marketplace] Candidatos encontrados: 3 profesionales verificados con Trust Score > 90.",
      "[Marketplace] Solicitando estimación de alcance preliminar a ProTools..."
    ]
  },
  {
    id: "buildops",
    displayName: "BuildOps Agent",
    role: "Inteligencia operativa — convierte trabajos en flujos coordinados",
    icon: GitBranch,
    color: "from-purple-500 to-violet-500",
    capabilities: [
      "Crear plan de proyecto con fases y tareas",
      "Gestionar milestones y sus dependencias",
      "Asignar responsables y fechas",
      "Monitorear estado y avance del proyecto",
      "Detectar retrasos y replanificar"
    ],
    forbiddenActions: [
      "Calcular costos detallados de materiales",
      "Decidir de forma autónoma sobre disputas",
      "Liberar pagos sin evidencia verificada"
    ],
    modules: ["ProjectPlanner", "MilestoneManager", "CrewCoordination", "DelayDetector"],
    integratesWith: ["protools", "evidence", "prometeo", "crowd"],
    logs: [
      "[BuildOps] Contrato asignado. Generando plan operativo de 4 fases.",
      "[BuildOps] Hito 1: Demolición y tuberías (Criterio: pruebas de presión).",
      "[BuildOps] Hito 2: Acabados de loseta (Criterio: fotos de juntas uniformes).",
      "[BuildOps] Asignando agenda en campo: Inicio programado para lunes 8:00 AM.",
      "[BuildOps] Vinculando checklists de aceptación a Evidence Agent."
    ]
  },
  {
    id: "protools",
    displayName: "ProTools Agent",
    role: "Inteligencia técnica — materiales, herramientas, costos y ejecución de obra",
    icon: Wrench,
    color: "from-amber-500 to-orange-500",
    capabilities: [
      "Calcular materiales y cantidades por oficio",
      "Estimar mano de obra, tiempo y costos",
      "Detectar riesgos técnicos (permisos, licencias, condiciones ocultas)",
      "Generar checklists de preparación y ejecución de obra",
      "Comparar opciones: básico / estándar / premium"
    ],
    forbiddenActions: [
      "Manejar flujos de pagos ni cuentas escrow",
      "Asignar tareas operacionales a cuadrillas",
      "Generar contratos ni documentos legales"
    ],
    modules: ["MaterialCalculator", "LaborEstimator", "ChecklistGenerator", "RiskDetector"],
    integratesWith: ["buildops", "marketplace", "evidence"],
    logs: [
      "[ProTools] Ejecutando cubicación para 12m2 de loseta cerámica.",
      "[ProTools] Lista generada: 14 cajas de loseta, 4 sacos de adhesivo, 2 de boquilla.",
      "[ProTools] Costo estimado de materiales: $3,400 MXN · Mano de obra: 18 horas.",
      "[ProTools] Alerta de riesgo: Se detectó tubería antigua de cobre sin llave de paso.",
      "[ProTools] Enviando checklist de seguridad a contratista antes del inicio."
    ]
  },
  {
    id: "evidence",
    displayName: "Evidence Agent",
    role: "Inteligencia legal/protectora — pruebas, documentos y trazabilidad",
    icon: Fingerprint,
    color: "from-pink-500 to-rose-500",
    capabilities: [
      "Gestionar fotos (before/during/after) con GPS + timestamp",
      "Validar metadatos de imágenes para prevenir fraudes",
      "Registrar cambios de alcance aprobados",
      "Bloquear hitos si la evidencia es incompleta o inválida",
      "Generar paquetes de evidencias consolidadas para disputas"
    ],
    forbiddenActions: [
      "Liberar fondos directamente por sí solo",
      "Modificar el cronograma del proyecto",
      "Alterar registros de logs históricos"
    ],
    modules: ["EvidenceVault", "PhotoTimeline", "ChangeOrderLog", "DisputePacketGenerator"],
    integratesWith: ["buildops", "crowd", "prometeo"],
    logs: [
      "[Evidence] Solicitud de cierre de Hito 1 recibida de contratista.",
      "[Evidence] Analizando 3 fotos cargadas... Metadatos de geolocalización validados.",
      "[Evidence] Verificación visual de tubería nueva: APROBADA.",
      "[Evidence] Registrando acuerdo de cambio de alcance #2 (cople extra de latón).",
      "[Evidence] Enviando confirmación de hito verificado a Crowd Agent."
    ]
  },
  {
    id: "crowd",
    displayName: "Crowd Agent",
    role: "Inteligencia financiera — pagos, escrow y liberación de fondos",
    icon: DollarSign,
    color: "from-emerald-500 to-teal-500",
    capabilities: [
      "Crear estructura de escrow (depósito en garantía) por proyecto",
      "Procesar pagos y retenciones seguros (Stripe Connect)",
      "Liberar fondos al completarse hitos aprobados por Evidence",
      "Gestionar retenciones de seguridad por riesgo financiero",
      "Mantener ledger financiero transparente y auditable"
    ],
    forbiddenActions: [
      "Aprobar trabajos sin evidencia técnica verificada",
      "Determinar avances físicos en campo",
      "Modificar cotizaciones acordadas por el cliente"
    ],
    modules: ["EscrowEngine", "MilestonePaymentEngine", "PayoutScheduler", "FinancialLedger"],
    integratesWith: ["evidence", "buildops", "prometeo"],
    logs: [
      "[Crowd] Hito 1 fondeado por cliente ($4,200 MXN) y bloqueado en escrow.",
      "[Crowd] Estado del ledger del proyecto #8912: Fondeado y Seguro.",
      "[Crowd] Confirmación de verificación recibida de Evidence Agent.",
      "[Crowd] Liberando pago de Hito 1 a contratista. Transacción en curso.",
      "[Crowd] Deduciendo comisión SEMSE (0.75%) y programando payout a banco."
    ]
  },
  {
    id: "prometeo",
    displayName: "Prometeo Agent",
    role: "Inteligencia cognitiva y explicativa — la voz visible del sistema",
    icon: Sparkles,
    color: "from-indigo-500 to-cyan-500",
    capabilities: [
      "Explicar estado del proyecto en lenguaje natural y simple",
      "Interpretar riesgos operativos y recomendar decisiones",
      "Enrutar consultas de usuarios al agente adecuado",
      "Consultar RAG (documentos técnicos, contratos, historial)",
      "Responder qué falta, por qué está bloqueado y qué sigue"
    ],
    forbiddenActions: [
      "Ejecutar pagos de forma directa",
      "Crear ni modificar tareas en la base de datos",
      "Tomar decisiones por sí solo (solo asesora y recomienda)"
    ],
    modules: ["NLExplainer", "RiskInterpreter", "AgentRouter", "RagAssistant"],
    integratesWith: ["marketplace", "buildops", "protools", "evidence", "crowd"],
    logs: [
      "[Prometeo] Cliente pregunta: '¿Cuándo se libera el pago del plomero?'",
      "[Prometeo] Analizando contexto de obra y logs de los demás agentes...",
      "[Prometeo] Explicación generada: 'El Hito 1 está listo. El pago se liberará automáticamente en cuanto el plomero suba la foto de la prueba de presión en la tubería.'",
      "[Prometeo] Recomendación: 'Enviar recordatorio amigable al profesional desde la app.'",
      "[Prometeo] Consulta enrutada a canal de notificaciones."
    ]
  }
];

interface ChatQuestion {
  question: string;
  steps: string[];
  answer: string;
}

const CHAT_QUESTIONS: ChatQuestion[] = [
  {
    question: "¿Por qué está retenido el pago de mi Hito 2?",
    steps: [
      "[Prometeo] Recibiendo consulta sobre retención del Hito 2.",
      "[Prometeo] Consultando estado de fondos con @crowd Agent...",
      "[Crowd] Fondos del Hito 2 ($5,800 MXN) resguardados de forma segura en Escrow.",
      "[Prometeo] Consultando evidencias operativas con @evidence Agent...",
      "[Evidence] Alerta: Falta la foto de verificación ('Tubería de desagüe instalada'). El hito permanece BLOQUEADO.",
      "[Prometeo] Compilando respuesta explicativa..."
    ],
    answer: "El pago de tu Hito 2 ('Instalación sanitaria') está retenido en depósito de garantía (escrow) porque el contratista aún no ha cargado la foto de evidencia obligatoria ('Tubería de desagüe instalada'). En cuanto el profesional suba la imagen y @evidence la valide con GPS y hora, el pago se liberará de inmediato."
  },
  {
    question: "¿Cuánto cuesta pintar un departamento de 70m²?",
    steps: [
      "[Prometeo] Recibiendo consulta de estimación de costos.",
      "[Prometeo] Consultando base de precios históricos con @protools Agent...",
      "[ProTools] Calculando materiales y mano de obra para Pintura Interior en departamento de 70m².",
      "[ProTools] Rango base estimado: $5,200 MXN a $7,500 MXN (incluye preparación de muros, sellador y 2 manos de pintura).",
      "[Prometeo] Consultando disponibilidad local con @marketplace Agent...",
      "[Marketplace] 5 pintores verificados y activos en tu delegación listos para ofertar.",
      "[Prometeo] Compilando respuesta explicativa..."
    ],
    answer: "Pintar un departamento de 70m² oscila entre **$5,200 MXN y $7,500 MXN** en promedio. Esto incluye resanar imperfecciones menores, sellado y la aplicación de dos manos de pintura vinílica. Actualmente contamos con 5 pintores comerciales verificados en tu zona disponibles para enviarte cotizaciones exactas."
  },
  {
    question: "¿Qué pasa si el contratista abandona el proyecto?",
    steps: [
      "[Prometeo] Recibiendo consulta sobre abandono o incumplimiento.",
      "[Prometeo] Consultando reglas de garantía con @crowd Agent...",
      "[Crowd] Los fondos no liberados del hito activo y futuros permanecen congelados en Escrow.",
      "[Prometeo] Consultando política de resolución de disputas con @evidence...",
      "[Evidence] AI dispute packet habilitado. Guardando bitácora fotográfica de avance como prueba legal.",
      "[Prometeo] Compilando respuesta explicativa..."
    ],
    answer: "Tu dinero está completamente protegido. Al trabajar por hitos en escrow, los fondos solo se liberan tras tu aprobación explícita. Si el contratista incumple, el dinero no se le entrega. Iniciamos un proceso de disputa asistido por @evidence (que recopila fotos y chats inmutables) para devolverte tus fondos o reasignar tu proyecto."
  }
];

export function AgentsSimulator() {
  const [activeId, setActiveId] = useState("marketplace");
  const [activeTab, setActiveTab] = useState<"logs" | "chat">("logs");
  
  // Logs simulator state
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [logIndex, setLogIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const logTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Chat simulator state
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>([
    { sender: "bot", text: "Hola, soy Prometeo, el copiloto cognitivo de SEMSE. ¿Qué duda operativa o técnica te gustaría resolver sobre tu proyecto?" }
  ]);
  const [chatSteps, setChatSteps] = useState<string[]>([]);
  const [chatStepsIndex, setChatStepsIndex] = useState(0);
  const [selectedQuestion, setSelectedQuestion] = useState<ChatQuestion | null>(null);
  const [chatTyping, setChatTyping] = useState(false);
  const chatTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeAgent = AGENTS_DATA.find((a) => a.id === activeId) || AGENTS_DATA[0];
  const AgentIcon = activeAgent.icon;

  // Handles active agent log simulations
  useEffect(() => {
    if (activeTab !== "logs") return;
    if (logTimerRef.current) clearInterval(logTimerRef.current);
    setConsoleLogs([]);
    setLogIndex(0);
    setIsTyping(true);
  }, [activeId, activeTab]);

  useEffect(() => {
    if (activeTab !== "logs" || !isTyping) return;

    if (logIndex < activeAgent.logs.length) {
      const delay = logIndex === 0 ? 100 : 1200;
      logTimerRef.current = setTimeout(() => {
        setConsoleLogs((prev) => [...prev, activeAgent.logs[logIndex]]);
        setLogIndex((prev) => prev + 1);
      }, delay);
    } else {
      setIsTyping(false);
    }

    return () => {
      if (logTimerRef.current) clearTimeout(logTimerRef.current);
    };
  }, [isTyping, logIndex, activeAgent.logs, activeTab]);

  // Handles Chat Demo question triggers
  const handleQuestionClick = (q: ChatQuestion) => {
    if (chatTyping) return;

    // Reset simulator states for chat
    setSelectedQuestion(q);
    setChatMessages((prev) => [...prev, { sender: "user", text: q.question }]);
    setChatSteps([]);
    setChatStepsIndex(0);
    setChatTyping(true);
  };

  useEffect(() => {
    if (!chatTyping || !selectedQuestion) return;

    if (chatStepsIndex < selectedQuestion.steps.length) {
      chatTimerRef.current = setTimeout(() => {
        setChatSteps((prev) => [...prev, selectedQuestion.steps[chatStepsIndex]]);
        setChatStepsIndex((prev) => prev + 1);
      }, 1000);
    } else {
      chatTimerRef.current = setTimeout(() => {
        setChatMessages((prev) => [...prev, { sender: "bot", text: selectedQuestion.answer }]);
        setChatTyping(false);
        setSelectedQuestion(null);
      }, 800);
    }

    return () => {
      if (chatTimerRef.current) clearTimeout(chatTimerRef.current);
    };
  }, [chatTyping, chatStepsIndex, selectedQuestion]);

  return (
    <div className="max-w-6xl mx-auto bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-2xl p-6 sm:p-10 relative overflow-hidden">
      
      {/* Background decorations */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-gradient-to-br ${activeAgent.color} blur-[120px] transition-all duration-700`} />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px]" />
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        
        {/* Left column: Agent selectors (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-bold text-indigo-400 mb-4 uppercase tracking-wider">
              Controlador Multi-Agente
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2 leading-tight">
              Ecosistema de Agentes de IA en Acción
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              El motor de SEMSE está compuesto por agentes de IA especializados con responsabilidades y límites operativos delimitados en el backend.
            </p>
          </div>

          {/* Buttons select grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
            {AGENTS_DATA.map((agent) => {
              const Icon = agent.icon;
              const isActive = agent.id === activeId;
              return (
                <button
                  key={agent.id}
                  onClick={() => {
                    setActiveId(agent.id);
                    // Force switch to logs tab if selecting non-prometeo agent
                    if (agent.id !== "prometeo") {
                      setActiveTab("logs");
                    }
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left cursor-pointer transition-all duration-300 ${
                    isActive
                      ? `bg-slate-800 border-indigo-500 text-white shadow-lg`
                      : "border-slate-800 hover:border-slate-700 bg-slate-900/50 hover:bg-slate-800/50 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${agent.color} text-white shadow-sm`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate leading-tight">{agent.displayName}</div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">Definición activa</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column: Simulator console & Details (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6 bg-slate-950/80 border border-slate-850 rounded-2xl p-6 sm:p-8 backdrop-blur-md">
          
          {/* Tab selector */}
          <div className="flex gap-2 p-1 bg-slate-900/80 border border-slate-850 rounded-xl relative z-20">
            <button
              onClick={() => setActiveTab("logs")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeTab === "logs"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-250"
              }`}
            >
              <Terminal size={14} />
              <span>Logs del Sistema</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("chat");
                setActiveId("prometeo"); // Auto select prometeo when opening chat
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeTab === "chat"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-250"
              }`}
            >
              <MessageSquare size={14} />
              <span>Chatea con Prometeo (AI Demo)</span>
            </button>
          </div>

          {activeTab === "logs" ? (
            /* Tab 1: System logs (Original view) */
            <>
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4 border-b border-slate-850 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${activeAgent.color} text-white flex items-center justify-center shadow-md`}>
                      <AgentIcon size={20} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white">{activeAgent.displayName}</h4>
                      <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest">Definición de rol</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Rol principal</div>
                    <p className="text-sm text-slate-200 leading-relaxed font-medium">{activeAgent.role}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Capacidades (Llamadas de Backend)
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-400 pl-0 list-none">
                        {activeAgent.capabilities.map((c, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-emerald-500 shrink-0">✓</span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                        <ShieldAlert size={12} className="text-red-400" />
                        Límites de Seguridad (Forbidden)
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-400 pl-0 list-none">
                        {activeAgent.forbiddenActions.map((f, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-red-400 shrink-0">✕</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-3 pt-3 border-t border-slate-900">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Módulos activos</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {activeAgent.modules.map((mod) => (
                          <span key={mod} className="text-[9px] font-mono font-bold bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
                            {mod}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Integración directa</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {activeAgent.integratesWith.map((int) => (
                          <span key={int} className="text-[9px] font-mono font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-md uppercase">
                            @{int}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Console logs box */}
              <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 font-mono text-xs overflow-hidden relative min-h-[160px] flex flex-col justify-between mt-6">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-3 text-[10px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Terminal size={12} className="text-indigo-500" />
                    <span>LOGS DE INTEGRACIÓN DE AGENTES</span>
                  </div>
                  <span className="animate-pulse text-emerald-500">● LIVE CONSOLE</span>
                </div>
                
                <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[120px] scrollbar-none">
                  {consoleLogs.map((log, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-slate-300 leading-relaxed break-words"
                    >
                      <span className="text-slate-600 select-none">&gt;</span> {log}
                    </motion.div>
                  ))}
                  {isTyping && (
                    <div className="flex items-center gap-1 text-slate-600 mt-1">
                      <span>&gt;</span>
                      <span className="w-1.5 h-3 bg-slate-500 animate-pulse" />
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-900 text-[10px] text-slate-600">
                  <span>SIMULADOR OPERATIVO DE EVENTOS</span>
                  <button
                    onClick={() => {
                      setConsoleLogs([]);
                      setLogIndex(0);
                      setIsTyping(true);
                    }}
                    disabled={isTyping}
                    className={`flex items-center gap-1 hover:text-indigo-400 cursor-pointer transition-colors ${isTyping ? "opacity-45" : ""}`}
                  >
                    <RefreshCw size={10} className={isTyping ? "animate-spin" : ""} />
                    <span>Reiniciar secuencia</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Tab 2: Chat demo with Prometeo */
            <div className="flex flex-col justify-between h-full min-h-[380px]">
              {/* Chat screen */}
              <div className="flex-1 overflow-y-auto max-h-[260px] space-y-4 pr-1 scrollbar-none">
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-2.5 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white ${
                      msg.sender === "user"
                        ? "bg-indigo-600"
                        : "bg-gradient-to-br from-indigo-500 to-cyan-500"
                    }`}>
                      {msg.sender === "user" ? <User size={12} /> : <Bot size={12} />}
                    </div>
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[80%] ${
                      msg.sender === "user"
                        ? "bg-indigo-600 text-white rounded-tr-none"
                        : "bg-slate-900 border border-slate-850 text-slate-200 rounded-tl-none"
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}

                {/* Simulated background RAG processing panel */}
                {chatSteps.length > 0 && (
                  <div className="bg-slate-950 border border-slate-900 rounded-xl p-3 font-mono text-[10px] space-y-1 mt-4">
                    <div className="text-slate-500 font-bold border-b border-slate-900 pb-1 mb-2 flex items-center gap-1">
                      <Terminal size={10} />
                      PROCESO COGNITIVO RAG DE PROMETEO
                    </div>
                    {chatSteps.map((step, index) => (
                      <div key={index} className="text-slate-400">
                        <span className="text-slate-700">&gt;</span> {step}
                      </div>
                    ))}
                    {chatTyping && chatStepsIndex < (selectedQuestion?.steps.length ?? 0) && (
                      <div className="flex items-center gap-0.5 text-slate-700 animate-pulse">
                        <span>&gt;</span>
                        <span className="w-1.5 h-2.5 bg-slate-500" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Fixed presets box */}
              <div className="border-t border-slate-900 pt-4 mt-4 space-y-2.5 relative z-10">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Preguntas sugeridas a Prometeo:</span>
                <div className="flex flex-col gap-2">
                  {CHAT_QUESTIONS.map((q) => (
                    <button
                      key={q.question}
                      onClick={() => handleQuestionClick(q)}
                      disabled={chatTyping}
                      className="px-3 py-2 rounded-xl border border-slate-850 bg-slate-900/60 hover:bg-slate-800 text-left text-xs font-semibold text-slate-300 hover:text-white cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed leading-snug flex justify-between items-center group/chatbtn"
                    >
                      <span>{q.question}</span>
                      <Send size={12} className="text-slate-500 group-hover/chatbtn:text-indigo-400 group-hover/chatbtn:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
