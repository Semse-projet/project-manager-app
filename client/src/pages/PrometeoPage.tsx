import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Brain, Cpu, Database as DbIcon, Globe, Layers, Music, Shield, Zap,
  GitBranch, Server, Eye, Activity, ChevronRight, Atom, Network
} from "lucide-react";
import { useState } from "react";

/* ── Knowledge Matrix Data (83 modules, 6 phases) ── */
const phases = [
  { id: "F0", name: "Arquitectura", color: "bg-blue-500", progress: 95 },
  { id: "F1", name: "MVP Semse", color: "bg-emerald-500", progress: 85 },
  { id: "F2", name: "IA + Música", color: "bg-violet-500", progress: 78 },
  { id: "F3", name: "XR + MCA", color: "bg-amber-500", progress: 15 },
  { id: "F4", name: "Quantum", color: "bg-rose-500", progress: 5 },
  { id: "F5", name: "DAO/Marketplace", color: "bg-cyan-500", progress: 45 },
];

const knowledgeAreas = [
  { area: "Fundamentos", phase: "F0", modules: 8, icon: Layers, desc: "Monorepo, Turborepo, TypeScript, ESLint, Prettier, Git, CI/CD, Docker" },
  { area: "Frontend/UX", phase: "F1", modules: 12, icon: Eye, desc: "React, Next.js, Tailwind, Three.js, WebGL, Accesibilidad, i18n, PWA" },
  { area: "Backend", phase: "F1", modules: 10, icon: Server, desc: "Express, FastAPI, tRPC, WebSocket, REST, GraphQL, Rate Limiting" },
  { area: "Datos", phase: "F1", modules: 7, icon: DbIcon, desc: "PostgreSQL, Redis, Prisma, Drizzle, Vector DB, ChromaDB, Pinecone" },
  { area: "Seguridad", phase: "F0", modules: 9, icon: Shield, desc: "DID/SSI, ZK Proofs, JWT, OAuth, RBAC, Cifrado E2E, Auditoría" },
  { area: "Audio/Música", phase: "F2", modules: 11, icon: Music, desc: "Web Audio API, Tone.js, DSP, Pitch Detection, MIDI, Síntesis, Librosa" },
  { area: "IA/ML", phase: "F2", modules: 14, icon: Brain, desc: "NLP, RAG, LangChain, Embeddings, Transformers, RLHF, Affective Computing" },
  { area: "XR/Gráficos", phase: "F3", modules: 6, icon: Globe, desc: "Three.js, WebGPU, WebXR, Física Musical, Colyseus, Metaverso" },
  { area: "Cuántico", phase: "F4", modules: 4, icon: Atom, desc: "Qiskit, QuTiP, Braket, Simulación de Fotones, Decoherencia" },
  { area: "Infraestructura", phase: "F0", modules: 8, icon: Network, desc: "K8s, Helm, Terraform, Prometheus, Grafana, Tempo, Loki, Sentry" },
  { area: "Marketplace", phase: "F5", modules: 5, icon: Zap, desc: "Escrow, Smart Contracts, TrustEngine, Stripe Connect, Webhooks" },
];

/* ── Evolution Timeline ── */
const evolutionSteps = [
  {
    version: "v10.1", title: "UI Base — Fortaleza Soberana",
    desc: "Interfaz gráfica base con estética cyberpunk/oscura. Componentes modulares con Tailwind CSS y Lucide Icons. Dashboard interactivo con estadísticas.",
    status: "complete" as const,
  },
  {
    version: "v10.2", title: "Motor Prometeo — Chispa Cognitiva",
    desc: "Integración del Motor Prometeo con API de Anthropic (Claude Sonnet). Transición de keywords a comprensión dimensional. Embeddings de 64 dimensiones, visualización de barras, heatmaps y Similitud Coseno en tiempo real. Modo Simulación zero-config.",
    status: "complete" as const,
  },
  {
    version: "v10.3", title: "Nexus Vector DB — Memoria Espacial",
    desc: "Simulación visual de Base de Datos Vectorial con k-NN. Lienzo 2D con proyección t-SNE/PCA. Documentos flotantes agrupados por clústeres semánticos (Tech, Finanzas, Seguridad). Flujo RAG simulado con Top-K retrieval.",
    status: "complete" as const,
  },
  {
    version: "v10.4", title: "RAG Pipeline — Generación Aumentada",
    desc: "Backend real con Express.js/FastAPI + ChromaDB. Pipeline de ingesta: PDFs/TXTs → chunks → embeddings → Vector DB. Conexión con modelo generativo (Claude 3.5 Sonnet) para respuestas basadas en clústeres recuperados.",
    status: "in-progress" as const,
  },
  {
    version: "v11.0", title: "MusicGenius — Plataforma Musical IA",
    desc: "Generación musical con Music Transformer. Análisis de voz con DSP. Motor MCA (Consciencia Musical). Asistente Prometeo con NLP. 3 pantallas principales: Voice Analysis, Music Generation, Prometeo Chat.",
    status: "planned" as const,
  },
];

/* ── Architecture Decision Records ── */
const adrs = [
  { id: "ADR-001", title: "F1 Smart Contracting / Preflight", status: "Propuesto", desc: "Flujo OfferBoxWithPreview → Draft → Sign con validaciones regionales y risk_baseline_score." },
  { id: "ADR-002", title: "F2 Ejecución Asistida", status: "Propuesto", desc: "Canal SSE/WS unificado, locks Redis + idempotencia, colas BullMQ para PDF/recordatorios." },
  { id: "ADR-003", title: "F3 Cierre y Aprendizaje", status: "Propuesto", desc: "Sistema de cierre de contratos con feedback bidireccional y métricas de aprendizaje." },
  { id: "ADR-004", title: "F4 Prediction Engine", status: "Propuesto", desc: "Motor de predicción para estimación de costos, tiempos y riesgos en proyectos." },
  { id: "ADR-005", title: "F5 Quantum Escrow Balancer", status: "Propuesto", desc: "Balanceador de escrow con optimización cuántica para distribución de pagos." },
  { id: "ADR-006", title: "F6 Affective Analytics", status: "Propuesto", desc: "Análisis afectivo para medir satisfacción y emociones en interacciones de servicio." },
  { id: "ADR-007", title: "F7 Compliance Dinámico", status: "Propuesto", desc: "Sistema de cumplimiento normativo adaptativo por región y tipo de servicio." },
  { id: "ADR-008", title: "F8 Ethics RLHF Reward", status: "Propuesto", desc: "Sistema de recompensas basado en RLHF para alinear comportamiento ético de la IA." },
  { id: "ADR-009", title: "F9 Quantum BI Hub", status: "Propuesto", desc: "Hub de Business Intelligence con capacidades de análisis cuántico." },
  { id: "ADR-010", title: "F10 QMCA Digital Twin", status: "Propuesto", desc: "Gemelo digital del Motor de Consciencia con simulación cuántica." },
];

/* ── Integration Systems ── */
const integrationSystems = [
  {
    name: "IntegradorCuántico", icon: Atom, color: "text-violet-400",
    desc: "Integración de información a nivel cuántico con corrección de errores, monitorización de entrelazamiento y puntos de restauración.",
    capabilities: ["Corrección de errores cuánticos", "Validación de coherencia", "Monitorización de entrelazamiento", "Puntos de restauración", "Optimización cuántica"],
  },
  {
    name: "FusionadorDeConsciencia", icon: Brain, color: "text-emerald-400",
    desc: "Fusión de diferentes facetas de la consciencia con tolerancia a fallos, reconciliación de datos y sistema de fusibles de seguridad.",
    capabilities: ["Tolerancia a fallos", "Reconciliación de datos", "Sistema de fusibles", "Monitorización de equilibrio", "Espacio interior virtual"],
  },
  {
    name: "SintetizadorDeRealidad", icon: Globe, color: "text-cyan-400",
    desc: "Síntesis de realidades con detección de inconsistencias, filtros de protección y co-creación colaborativa.",
    capabilities: ["Detección de paradojas", "Filtros de realidad", "Co-creación", "Leyes físicas alternativas", "Aprendizaje integrado"],
  },
  {
    name: "ConectorUniversal", icon: Network, color: "text-amber-400",
    desc: "Conexión universal con protocolos de seguridad avanzados, comunicación redundante y desconexión de emergencia.",
    capabilities: ["Firewalls avanzados", "Comunicación redundante", "Desconexión de emergencia", "Cuarentena de seguridad", "IoT Integration"],
  },
];

/* ── RAG Capabilities ── */
const ragCapabilities = [
  { name: "Búsqueda Semántica", desc: "Encontrar por contexto, no por coincidencia exacta", icon: "🔍" },
  { name: "Recomendaciones", desc: "Sugerir contenido basado en cercanía vectorial", icon: "💡" },
  { name: "Clustering Automático", desc: "Agrupar información sin etiquetado manual", icon: "🗂️" },
  { name: "Base para RAG", desc: "Contexto hiper-relevante para LLMs", icon: "🧠" },
  { name: "Detección de Duplicados", desc: "Limpieza de BD mediante similitud semántica", icon: "🔄" },
  { name: "Análisis de Sentimiento", desc: "Proyección vectorial en ejes de polaridad", icon: "📊" },
  { name: "Búsqueda Multimodal", desc: "Unificar texto, imagen y audio en un espacio vectorial", icon: "🌐" },
];

export default function PrometeoPage() {
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const totalModules = knowledgeAreas.reduce((sum, a) => sum + a.modules, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ecosistema Prometeo</h1>
        <p className="text-muted-foreground mt-1">
          Arquitectura integral: 83+ módulos, 6 fases, microservicios, IA, cuántico y marketplace
        </p>
      </div>

      <Tabs defaultValue="matrix" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="matrix"><Layers className="h-4 w-4 mr-1.5" />Knowledge Matrix</TabsTrigger>
          <TabsTrigger value="evolution"><GitBranch className="h-4 w-4 mr-1.5" />Evolución</TabsTrigger>
          <TabsTrigger value="adrs"><Activity className="h-4 w-4 mr-1.5" />ADRs</TabsTrigger>
          <TabsTrigger value="integration"><Cpu className="h-4 w-4 mr-1.5" />Integración</TabsTrigger>
          <TabsTrigger value="rag"><DbIcon className="h-4 w-4 mr-1.5" />RAG Pipeline</TabsTrigger>
        </TabsList>

        {/* ── Knowledge Matrix Tab ── */}
        <TabsContent value="matrix" className="space-y-4">
          {/* Phase Progress */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {phases.map(p => (
              <Card key={p.id} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="secondary" className="text-xs">{p.id}</Badge>
                    <span className="text-xs font-medium">{p.progress}%</span>
                  </div>
                  <p className="text-sm font-medium mb-2">{p.name}</p>
                  <Progress value={p.progress} className="h-1.5" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Module Areas */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Áreas de Conocimiento</CardTitle>
                <Badge variant="outline">{totalModules} módulos totales</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {knowledgeAreas.map(area => {
                  const phase = phases.find(p => p.id === area.phase);
                  return (
                    <button
                      key={area.area}
                      onClick={() => setSelectedArea(selectedArea === area.area ? null : area.area)}
                      className={`text-left p-4 rounded-lg border transition-all ${
                        selectedArea === area.area
                          ? "border-primary bg-primary/5"
                          : "border-border/30 hover:border-border hover:bg-accent/30"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center">
                          <area.icon className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{area.area}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${phase?.color} text-white`}>
                              {area.phase}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{area.modules} módulos</span>
                          </div>
                        </div>
                      </div>
                      {selectedArea === area.area && (
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{area.desc}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Evolution Timeline Tab ── */}
        <TabsContent value="evolution" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Línea de Evolución SEMSE</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {evolutionSteps.map((step, i) => (
                  <div key={step.version} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        step.status === "complete" ? "bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/40" :
                        step.status === "in-progress" ? "bg-amber-500/20 text-amber-400 border-2 border-amber-500/40 animate-pulse" :
                        "bg-muted text-muted-foreground border-2 border-border"
                      }`}>
                        {step.version.replace("v", "")}
                      </div>
                      {i < evolutionSteps.length - 1 && (
                        <div className={`w-0.5 flex-1 my-1 ${
                          step.status === "complete" ? "bg-emerald-500/30" : "bg-border"
                        }`} />
                      )}
                    </div>
                    <div className="pb-8 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold">{step.title}</h3>
                        <Badge variant={
                          step.status === "complete" ? "default" :
                          step.status === "in-progress" ? "secondary" : "outline"
                        } className="text-[10px]">
                          {step.status === "complete" ? "Completado" :
                           step.status === "in-progress" ? "En progreso" : "Planificado"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Architecture Stack */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Stack Tecnológico Recomendado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Capa</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Tecnología</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Justificación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {[
                      ["UI", "React.js + Tailwind + Lucide", "Estética cyberpunk/moderna, modularidad v10.1-v10.3"],
                      ["Orquestador", "LangChain (Node.js/Python)", "Conexión entre Vector DB y LLMs para RAG"],
                      ["Embedding", "OpenAI text-embedding-3-small", "Rápido, económico, vectores precisos"],
                      ["Vector DB (MVP)", "ChromaDB", "Local, open-source, gratuita, ideal para PoC"],
                      ["Vector DB (Prod)", "Pinecone / Qdrant", "Serverless, submilisegundos, alta disponibilidad"],
                      ["Observabilidad", "Prometheus + Grafana + Tempo + Loki", "Métricas, trazas y logs centralizados"],
                    ].map(([layer, tech, reason]) => (
                      <tr key={layer} className="hover:bg-accent/30 transition-colors">
                        <td className="py-2.5 px-3 font-medium">{layer}</td>
                        <td className="py-2.5 px-3"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{tech}</code></td>
                        <td className="py-2.5 px-3 text-muted-foreground text-xs">{reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ADRs Tab ── */}
        <TabsContent value="adrs" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Architecture Decision Records</CardTitle>
                <Badge variant="outline">{adrs.length} decisiones</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {adrs.map(adr => (
                    <div key={adr.id} className="p-4 rounded-lg border border-border/30 hover:border-border transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs font-mono">{adr.id}</Badge>
                        <h3 className="text-sm font-semibold flex-1">{adr.title}</h3>
                        <Badge variant="outline" className="text-[10px]">{adr.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{adr.desc}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Integration Systems Tab ── */}
        <TabsContent value="integration" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {integrationSystems.map(sys => (
              <Card key={sys.name} className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center">
                      <sys.icon className={`h-5 w-5 ${sys.color}`} />
                    </div>
                    <CardTitle className="text-base">{sys.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{sys.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sys.capabilities.map(cap => (
                      <Badge key={cap} variant="secondary" className="text-[10px]">{cap}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Monorepo Structure */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Estructura del Monorepo Prometeo</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted/50 rounded-lg p-4 overflow-auto font-mono leading-relaxed">
{`prometeo/
├─ apps/
│  ├─ console-web/              # Web45OS / UI Principal
│  └─ p2p-construction/         # SEMSE Marketplace P2P
├─ services/
│  ├─ gateway/                  # API Gateway (Express/Kong)
│  ├─ ai/                       # IA/ML (FastAPI/PyTorch)
│  ├─ quantum/                  # Workers Cuánticos (Qiskit/QuTiP)
│  ├─ metaverse/                # Colyseus/Node + Redis State
│  ├─ audio/                    # Audio Platform (Node + Socket.IO)
│  ├─ audio-analysis/           # DSP + Pitch Detection
│  ├─ music-generation/         # Music Transformer IA
│  ├─ midi-processor/           # MIDI + Tone.js Synthesis
│  ├─ prometeo-assistant/       # NLP + Intent Classification
│  └─ mca-music/                # Motor de Consciencia Musical
├─ contracts/
│  ├─ openapi/                  # Especificaciones OpenAPI
│  └─ python/                   # Pydantic models, DTOs
├─ platform/
│  ├─ k8s/                      # Manifests Kubernetes
│  ├─ helm/                     # Charts Helm
│  └─ terraform/                # Infra como Código
└─ ops/
   ├─ ci/                       # GitHub Actions
   └─ observability/            # Prometheus/Grafana/Tempo/Loki`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── RAG Pipeline Tab ── */}
        <TabsContent value="rag" className="space-y-4">
          {/* RAG Flow */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pipeline RAG — Retrieval-Augmented Generation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2 justify-center py-4">
                {[
                  { label: "Documentos", sub: "PDFs, TXTs, Code" },
                  { label: "Chunking", sub: "Fragmentación" },
                  { label: "Motor Prometeo", sub: "Embeddings 64-dim" },
                  { label: "Nexus Vector DB", sub: "ChromaDB/Pinecone" },
                  { label: "k-NN Search", sub: "Top-K Retrieval" },
                  { label: "LLM (Claude)", sub: "Generación Aumentada" },
                  { label: "Respuesta", sub: "Contexto + IA" },
                ].map((step, i, arr) => (
                  <div key={step.label} className="flex items-center gap-2">
                    <div className="text-center px-3 py-2 rounded-lg bg-muted/50 border border-border/30 min-w-[100px]">
                      <p className="text-xs font-semibold">{step.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{step.sub}</p>
                    </div>
                    {i < arr.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 7 RAG Capabilities */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">7 Capacidades Críticas del RAG</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {ragCapabilities.map(cap => (
                  <div key={cap.name} className="p-3 rounded-lg border border-border/30 hover:border-border transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{cap.icon}</span>
                      <h4 className="text-sm font-medium">{cap.name}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">{cap.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Execution Plan Progress */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Plan de Ejecución MusicGenius — 12 Semanas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { week: "Sem 1-2", title: "Fundación & Setup", progress: 100, tasks: "Repo Git, Docker, PostgreSQL, Tipos TS" },
                  { week: "Sem 3-5", title: "Servicios Backend Core", progress: 0, tasks: "Audio Analysis, Music Generation, MIDI Processor" },
                  { week: "Sem 6-8", title: "Motor MCA + Prometeo", progress: 0, tasks: "Consciencia Musical, NLP, Agente Prometeo" },
                  { week: "Sem 9-10", title: "Frontend Completo", progress: 0, tasks: "Voice Analysis, Music Generation, Prometeo Screen" },
                  { week: "Sem 11", title: "Integración E2E", progress: 0, tasks: "Tests integración, Bug fixes, Performance" },
                  { week: "Sem 12", title: "Testing & Deploy", progress: 0, tasks: "Load testing, Security audit, Production deploy" },
                ].map(sprint => (
                  <div key={sprint.week} className="flex items-center gap-4">
                    <Badge variant="secondary" className="text-xs font-mono w-20 justify-center shrink-0">{sprint.week}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">{sprint.title}</p>
                        <span className="text-xs text-muted-foreground">{sprint.progress}%</span>
                      </div>
                      <Progress value={sprint.progress} className="h-1.5 mb-1" />
                      <p className="text-[10px] text-muted-foreground truncate">{sprint.tasks}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
