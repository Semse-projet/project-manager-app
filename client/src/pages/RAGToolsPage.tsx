import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, Scissors, Brain, Database, MessageSquare, User,
  ArrowRight, Play, RotateCcw, CheckCircle2, Clock, XCircle,
  Zap, AlertTriangle, Layers, Hash, Copy, RefreshCw,
  FolderOpen, Send, Bot, Terminal, CheckCircle
} from "lucide-react";

// ==================== RAG VISUALIZER ====================

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  duration: number;
  color: string;
}

const ingestionSteps: Step[] = [
  { id: "upload", title: "PDF Upload", description: "Usuario sube documento", icon: FileText, duration: 500, color: "blue" },
  { id: "chunk", title: "Chunking", description: "Divide en fragmentos de 1000 chars", icon: Scissors, duration: 800, color: "purple" },
  { id: "embed", title: "Embeddings", description: "OpenAI convierte a vectores", icon: Brain, duration: 1500, color: "pink" },
  { id: "store", title: "Vector Store", description: "Almacena en ChromaDB", icon: Database, duration: 600, color: "green" },
];

const querySteps: Step[] = [
  { id: "query", title: "Pregunta", description: "Usuario consulta", icon: User, duration: 200, color: "blue" },
  { id: "retrieve", title: "Retrieval", description: "Busca chunks similares (k=4)", icon: Database, duration: 400, color: "purple" },
  { id: "llm", title: "LLM", description: "GPT-4 genera respuesta", icon: Brain, duration: 2000, color: "pink" },
  { id: "response", title: "Respuesta", description: "Con fuentes citadas", icon: MessageSquare, duration: 300, color: "green" },
];

function RAGVisualizer() {
  const [activeFlow, setActiveFlow] = useState<"ingestion" | "query">("ingestion");
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);

  const steps = activeFlow === "ingestion" ? ingestionSteps : querySteps;

  const runSimulation = async () => {
    setIsRunning(true);
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setProgress(0);
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      setProgress(((i + 1) / steps.length) * 100);
      await new Promise(resolve => setTimeout(resolve, steps[i].duration));
      setCompletedSteps(prev => { const next = new Set(Array.from(prev)); next.add(steps[i].id); return next; });
    }
    setCurrentStep(-1);
    setIsRunning(false);
    setProgress(100);
  };

  const reset = () => { setCurrentStep(-1); setIsRunning(false); setCompletedSteps(new Set()); setProgress(0); };

  const getStepStatus = (index: number) => {
    if (completedSteps.has(steps[index].id)) return "completed";
    if (currentStep === index) return "active";
    return "pending";
  };

  const getColorClass = (color: string) => {
    const colors: Record<string, { bg: string; border: string; text: string }> = {
      blue: { bg: "bg-blue-500/20", border: "border-blue-500/50", text: "text-blue-400" },
      purple: { bg: "bg-purple-500/20", border: "border-purple-500/50", text: "text-purple-400" },
      pink: { bg: "bg-pink-500/20", border: "border-pink-500/50", text: "text-pink-400" },
      green: { bg: "bg-green-500/20", border: "border-green-500/50", text: "text-green-400" },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold">Visualizador de Flujo RAG</h3>
          <p className="text-sm text-muted-foreground">Observa paso a paso cómo fluye la información en el sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={activeFlow === "ingestion" ? "default" : "outline"} size="sm" onClick={() => { setActiveFlow("ingestion"); reset(); }}>
            <FileText className="w-4 h-4 mr-2" />Ingesta
          </Button>
          <Button variant={activeFlow === "query" ? "default" : "outline"} size="sm" onClick={() => { setActiveFlow("query"); reset(); }}>
            <MessageSquare className="w-4 h-4 mr-2" />Consulta
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progreso</span>
          <span className="font-mono">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="relative">
            <div className="hidden md:block absolute top-12 left-0 right-0 h-1 bg-muted rounded-full">
              <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 transition-all duration-500 rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
              {steps.map((step, index) => {
                const status = getStepStatus(index);
                const colors = getColorClass(step.color);
                const Icon = step.icon;
                return (
                  <div key={step.id} className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-300 ${
                    status === "completed" ? `${colors.bg} ${colors.border}` : status === "active" ? "bg-yellow-500/10 border-yellow-500/50 scale-105" : "bg-muted/30 border-border/30"
                  }`}>
                    <div className={`p-3 rounded-full mb-3 ${status === "completed" ? colors.bg : status === "active" ? "bg-yellow-500/20 animate-pulse" : "bg-muted"}`}>
                      {status === "completed" ? <CheckCircle2 className={`w-6 h-6 ${colors.text}`} /> : status === "active" ? <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" /> : <Icon className="w-6 h-6 text-muted-foreground" />}
                    </div>
                    <h4 className={`font-semibold text-center text-sm ${status !== "pending" ? "text-foreground" : "text-muted-foreground"}`}>{step.title}</h4>
                    <p className="text-xs text-center text-muted-foreground mt-1">{step.description}</p>
                    {status === "active" && (
                      <Badge variant="outline" className="mt-2 bg-yellow-500/10 text-yellow-300 border-yellow-500/30">
                        <Clock className="w-3 h-3 mr-1" />{Math.round(step.duration / 100) / 10}s
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {currentStep >= 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-500/20 animate-pulse">
                {(() => { const Icon = steps[currentStep].icon; return <Icon className="w-5 h-5 text-yellow-400" />; })()}
              </div>
              <div>
                <p className="text-sm font-medium text-yellow-300">Ejecutando: {steps[currentStep].title}</p>
                <p className="text-xs text-yellow-300/70">{steps[currentStep].description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-center gap-4">
        <Button size="lg" onClick={runSimulation} disabled={isRunning} className="min-w-[150px]">
          {isRunning ? (<><div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />Ejecutando...</>) : (<><Play className="w-4 h-4 mr-2" />{progress === 100 ? "Repetir" : "Iniciar"} Simulación</>)}
        </Button>
        <Button variant="outline" size="lg" onClick={reset} disabled={isRunning}>
          <RotateCcw className="w-4 h-4 mr-2" />Reiniciar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-blue-500/20">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2 text-blue-400"><FileText className="w-4 h-4" />Flujo de Ingesta</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><ArrowRight className="w-3 h-3 text-blue-400" />Procesa el PDF una sola vez</li>
              <li className="flex items-center gap-2"><ArrowRight className="w-3 h-3 text-blue-400" />Crea embeddings con OpenAI</li>
              <li className="flex items-center gap-2"><ArrowRight className="w-3 h-3 text-blue-400" />Almacena en ChromaDB</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="border-green-500/20">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2 text-green-400"><MessageSquare className="w-4 h-4" />Flujo de Consulta</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><ArrowRight className="w-3 h-3 text-green-400" />Recibe pregunta del usuario</li>
              <li className="flex items-center gap-2"><ArrowRight className="w-3 h-3 text-green-400" />Busca chunks similares (top-k)</li>
              <li className="flex items-center gap-2"><ArrowRight className="w-3 h-3 text-green-400" />Genera respuesta con contexto</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ==================== CACHE SIMULATOR ====================

interface Execution {
  id: number;
  timestamp: number;
  cached: boolean;
  duration: number;
  type: "data" | "resource";
}

function CacheSimulator() {
  const [useCache, setUseCache] = useState(false);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cacheData, setCacheData] = useState<Map<string, unknown>>(new Map());
  const [cacheResource, setCacheResource] = useState<Map<string, unknown>>(new Map());
  const [currentStepLabel, setCurrentStepLabel] = useState("");

  const simulateProcessing = useCallback(async (type: "data" | "resource") => {
    setIsProcessing(true);
    const stepsArr = type === "data"
      ? ["Leyendo PDF...", "Extrayendo texto...", "Dividiendo chunks...", "Procesando..."]
      : ["Inicializando embeddings...", "Conectando a OpenAI...", "Generando vectores...", "Almacenando..."];
    for (const s of stepsArr) { setCurrentStepLabel(s); await new Promise(r => setTimeout(r, 400)); }
    setCurrentStepLabel("");
    setIsProcessing(false);
  }, []);

  const handleExecute = async (type: "data" | "resource") => {
    const cacheKey = type === "data" ? "pdf_data" : "embeddings";
    const cache = type === "data" ? cacheData : cacheResource;
    const setCache = type === "data" ? setCacheData : setCacheResource;
    const startTime = Date.now();
    if (useCache && cache.has(cacheKey)) {
      setExecutions(prev => [{ id: Date.now(), timestamp: Date.now(), cached: true, duration: 50, type }, ...prev].slice(0, 10));
    } else {
      await simulateProcessing(type);
      const duration = Date.now() - startTime;
      if (useCache) setCache(new Map(cache.set(cacheKey, { timestamp: Date.now() })));
      setExecutions(prev => [{ id: Date.now(), timestamp: Date.now(), cached: false, duration, type }, ...prev].slice(0, 10));
    }
  };

  const clearCache = () => { setCacheData(new Map()); setCacheResource(new Map()); setExecutions([]); };
  const getCacheHits = () => executions.filter(e => e.cached).length;
  const getCacheMisses = () => executions.filter(e => !e.cached).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold">Simulador de Caché</h3>
          <p className="text-sm text-muted-foreground">Experimenta cómo @st.cache_data y @st.cache_resource mejoran el rendimiento</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="cache-mode" checked={useCache} onCheckedChange={setUseCache} />
            <Label htmlFor="cache-mode" className={useCache ? "text-green-400" : "text-red-400"}>{useCache ? "Caché ACTIVADO" : "Caché DESACTIVADO"}</Label>
          </div>
          <Button variant="outline" size="sm" onClick={clearCache}><RotateCcw className="w-4 h-4 mr-2" />Limpiar</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={`border ${useCache ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Estado</span>{useCache ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}</div>
            <p className={`text-lg font-semibold mt-1 ${useCache ? "text-green-400" : "text-red-400"}`}>{useCache ? "Activado" : "Desactivado"}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Cache Hits</span><Zap className="w-5 h-5 text-yellow-400" /></div><p className="text-lg font-semibold mt-1">{getCacheHits()}</p></CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Cache Misses</span><Clock className="w-5 h-5 text-orange-400" /></div><p className="text-lg font-semibold mt-1">{getCacheMisses()}</p></CardContent></Card>
        <Card className="border-border/50"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Ahorro</span><Database className="w-5 h-5 text-purple-400" /></div><p className="text-lg font-semibold mt-1">{getCacheHits() > 0 ? `${Math.round((getCacheHits() / executions.length) * 100)}%` : "0%"}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-blue-500/20">
          <CardHeader><CardTitle className="flex items-center gap-2 text-blue-400"><FileText className="w-5 h-5" />@st.cache_data</CardTitle><CardDescription>Para datos y resultados de procesamiento de PDFs</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm"><Badge variant="outline" className="bg-blue-500/10 text-blue-300">PDF → Chunks</Badge><span className="text-muted-foreground">~800ms sin caché</span></div>
            <Button onClick={() => handleExecute("data")} disabled={isProcessing} className="w-full" variant={useCache ? "default" : "destructive"}>
              {isProcessing && currentStepLabel ? (<><div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />{currentStepLabel}</>) : (<><Play className="w-4 h-4 mr-2" />Procesar PDF</>)}
            </Button>
          </CardContent>
        </Card>
        <Card className="border-purple-500/20">
          <CardHeader><CardTitle className="flex items-center gap-2 text-purple-400"><Brain className="w-5 h-5" />@st.cache_resource</CardTitle><CardDescription>Para objetos pesados como embeddings y vector stores</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm"><Badge variant="outline" className="bg-purple-500/10 text-purple-300">Chunks → Embeddings</Badge><span className="text-muted-foreground">~1200ms sin caché</span></div>
            <Button onClick={() => handleExecute("resource")} disabled={isProcessing} className="w-full" variant={useCache ? "default" : "destructive"}>
              {isProcessing && currentStepLabel ? (<><div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />{currentStepLabel}</>) : (<><Play className="w-4 h-4 mr-2" />Generar Embeddings</>)}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader><CardTitle className="flex items-center gap-2"><Layers className="w-5 h-5" />Registro de Ejecuciones</CardTitle></CardHeader>
        <CardContent>
          {executions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground"><Play className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>Ejecuta alguna operación para ver los resultados</p></div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {executions.map((exec) => (
                <div key={exec.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    {exec.cached ? <div className="p-2 rounded-full bg-green-500/20"><Zap className="w-4 h-4 text-green-400" /></div> : <div className="p-2 rounded-full bg-orange-500/20"><Clock className="w-4 h-4 text-orange-400" /></div>}
                    <div><p className="text-sm font-medium">{exec.type === "data" ? "Procesar PDF" : "Generar Embeddings"}</p><p className="text-xs text-muted-foreground">{new Date(exec.timestamp).toLocaleTimeString()}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={exec.cached ? "default" : "secondary"} className={exec.cached ? "bg-green-500/20 text-green-300" : ""}>{exec.cached ? "CACHE HIT" : "CACHE MISS"}</Badge>
                    <span className={`text-sm font-mono ${exec.cached ? "text-green-400" : "text-orange-400"}`}>{exec.duration}ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!useCache && executions.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div><p className="text-sm font-medium text-yellow-300">Sin caché estás desperdiciando recursos</p><p className="text-xs text-yellow-300/70 mt-1">Cada ejecución recalcula todo desde cero. Activa el caché para ver la diferencia.</p></div>
        </div>
      )}
    </div>
  );
}

// ==================== PERFORMANCE COMPARER ====================

interface Metric { label: string; withoutCache: number; withCache: number; unit: string; }

const metrics: Metric[] = [
  { label: "Tiempo de carga", withoutCache: 3200, withCache: 150, unit: "ms" },
  { label: "Tokens consumidos", withoutCache: 45000, withCache: 0, unit: "tokens" },
  { label: "Costo estimado", withoutCache: 0.045, withCache: 0, unit: "$" },
  { label: "Memoria usada", withoutCache: 512, withCache: 512, unit: "MB" },
];

function PerformanceComparer() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentScenario, setCurrentScenario] = useState<"none" | "without" | "with">("none");
  const [showResults, setShowResults] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => setLogs(prev => [message, ...prev].slice(0, 8));

  const simulateWithoutCache = async () => {
    setIsSimulating(true); setCurrentScenario("without"); setProgress(0); setLogs([]); setShowResults(false);
    const stepsArr = [
      { message: "Cargando PDF desde disco...", progress: 10, delay: 300 },
      { message: "Extrayendo texto del PDF...", progress: 25, delay: 400 },
      { message: "Dividiendo en chunks (1000 chars)...", progress: 40, delay: 500 },
      { message: "Inicializando OpenAI Embeddings...", progress: 55, delay: 300 },
      { message: "Generando embeddings (~45k tokens)...", progress: 75, delay: 1200 },
      { message: "Construyendo vector store Chroma...", progress: 90, delay: 600 },
      { message: "Procesamiento completo!", progress: 100, delay: 200 },
    ];
    for (const s of stepsArr) { setProgress(s.progress); addLog(s.message); await new Promise(r => setTimeout(r, s.delay)); }
    setShowResults(true); setIsSimulating(false);
  };

  const simulateWithCache = async () => {
    setIsSimulating(true); setCurrentScenario("with"); setProgress(0); setLogs([]); setShowResults(false);
    const stepsArr = [
      { message: "Verificando caché...", progress: 30, delay: 100 },
      { message: "Cache hit! Recuperando datos...", progress: 60, delay: 50 },
      { message: "Vector store cargado desde caché", progress: 100, delay: 50 },
    ];
    for (const s of stepsArr) { setProgress(s.progress); addLog(s.message); await new Promise(r => setTimeout(r, s.delay)); }
    setShowResults(true); setIsSimulating(false);
  };

  const reset = () => { setIsSimulating(false); setProgress(0); setCurrentScenario("none"); setShowResults(false); setLogs([]); };

  const getImprovement = (metric: Metric) => {
    if (metric.withoutCache === 0) return 0;
    return Math.round(((metric.withoutCache - metric.withCache) / metric.withoutCache) * 100);
  };

  return (
    <div className="space-y-6">
      <div><h3 className="text-xl font-bold">Comparador de Rendimiento</h3><p className="text-sm text-muted-foreground">Compara el impacto real de usar caché vs no usarlo</p></div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-red-500/20">
          <CardHeader><CardTitle className="flex items-center gap-2 text-red-400"><XCircle className="w-5 h-5" />Sin Caché</CardTitle><CardDescription>Re-procesa todo en cada interacción</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Tiempo estimado</span><span className="text-red-400 font-mono">~3.2 segundos</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tokens API</span><span className="text-red-400 font-mono">~45,000</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Costo</span><span className="text-red-400 font-mono">~$0.045</span></div>
            </div>
            <Button variant="destructive" className="w-full" onClick={simulateWithoutCache} disabled={isSimulating}>
              {isSimulating && currentScenario === "without" ? (<><div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />Simulando...</>) : (<><Play className="w-4 h-4 mr-2" />Simular Sin Caché</>)}
            </Button>
          </CardContent>
        </Card>
        <Card className="border-green-500/20">
          <CardHeader><CardTitle className="flex items-center gap-2 text-green-400"><CheckCircle2 className="w-5 h-5" />Con Caché</CardTitle><CardDescription>Reutiliza resultados procesados</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Tiempo estimado</span><span className="text-green-400 font-mono">~150ms</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tokens API</span><span className="text-green-400 font-mono">0</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Costo</span><span className="text-green-400 font-mono">$0</span></div>
            </div>
            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={simulateWithCache} disabled={isSimulating}>
              {isSimulating && currentScenario === "with" ? (<><div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />Simulando...</>) : (<><Play className="w-4 h-4 mr-2" />Simular Con Caché</>)}
            </Button>
          </CardContent>
        </Card>
      </div>

      {(isSimulating || logs.length > 0) && (
        <Card className="border-border/50"><CardHeader className="pb-3"><CardTitle className="text-sm">Progreso</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-2" />
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground font-mono text-xs">{new Date().toLocaleTimeString()}</span>
                  <span className={currentScenario === "with" ? "text-green-400" : "text-orange-400"}>{log}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showResults && (
        <Card className={currentScenario === "with" ? "border-green-500/30" : "border-red-500/30"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {currentScenario === "with" ? (<><Zap className="w-5 h-5 text-green-400" /><span className="text-green-400">Mejora significativa!</span></>) : (<><AlertTriangle className="w-5 h-5 text-red-400" /><span className="text-red-400">Rendimiento subóptimo</span></>)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {metrics.map((metric) => {
                const value = currentScenario === "with" ? metric.withCache : metric.withoutCache;
                const improvement = getImprovement(metric);
                return (
                  <div key={metric.label} className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
                    <p className={`text-2xl font-bold font-mono ${currentScenario === "with" ? "text-green-400" : "text-red-400"}`}>
                      {metric.unit === "$" ? `$${value.toFixed(3)}` : `${value}${metric.unit}`}
                    </p>
                    {currentScenario === "with" && improvement > 0 && (
                      <div className="flex items-center justify-center gap-1 mt-1"><ArrowRight className="w-3 h-3 text-green-400 rotate-[-90deg]" /><span className="text-xs text-green-400">-{improvement}%</span></div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {(showResults || logs.length > 0) && (
        <div className="flex justify-center"><Button variant="outline" onClick={reset}><RotateCcw className="w-4 h-4 mr-2" />Reiniciar Comparación</Button></div>
      )}
    </div>
  );
}

// ==================== HASH GENERATOR ====================

interface FileEntry { id: string; name: string; hash: string; timestamp: number; }

function HashGenerator() {
  const [filename, setFilename] = useState("");
  const [generatedHash, setGeneratedHash] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [showCollisionWarning, setShowCollisionWarning] = useState(false);

  const generateHash = (input: string) => {
    let hash = 0;
    for (let i = 0; i < input.length; i++) { const char = input.charCodeAt(i); hash = ((hash << 5) - hash) + char; hash = hash & hash; }
    return Math.abs(hash).toString(16).padStart(12, "0").slice(0, 12);
  };

  const handleGenerate = () => {
    if (!filename.trim()) return;
    const hash = generateHash(filename + Date.now());
    setGeneratedHash(hash);
    const collision = files.find(f => f.name === filename);
    if (collision) { setShowCollisionWarning(true); } else {
      setShowCollisionWarning(false);
      setFiles(prev => [{ id: Date.now().toString(), name: filename, hash, timestamp: Date.now() }, ...prev].slice(0, 10));
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`temp_${filename.replace(/\s+/g, "_")}_${generatedHash}.pdf`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const generateSafeName = (name: string, hash: string) => {
    const safeName = name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
    return `temp_${safeName}_${hash}.pdf`;
  };

  return (
    <div className="space-y-6">
      <div><h3 className="text-xl font-bold">Generador de Hash Único</h3><p className="text-sm text-muted-foreground">Crea nombres de archivo únicos usando hash para evitar colisiones</p></div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-red-500/20 bg-red-500/5"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2 text-red-400"><XCircle className="w-4 h-4" />Problema: temp.pdf fijo</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Usar <code className="bg-red-500/20 px-1 rounded text-red-300">"temp.pdf"</code> como nombre fijo causa colisiones cuando múltiples usuarios suben archivos simultáneamente.</p></CardContent></Card>
        <Card className="border-green-500/20 bg-green-500/5"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2 text-green-400"><CheckCircle2 className="w-4 h-4" />Solución: Hash único</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Usar <code className="bg-green-500/20 px-1 rounded text-green-300">hashlib.sha256</code> genera un identificador único por archivo, eliminando colisiones.</p></CardContent></Card>
      </div>

      <Card className="border-border/50">
        <CardHeader><CardTitle className="flex items-center gap-2"><Hash className="w-5 h-5" />Generar Nombre de Archivo</CardTitle><CardDescription>Ingresa el nombre original del PDF para generar un nombre único</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1"><FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="mi_documento.pdf" value={filename} onChange={(e) => setFilename(e.target.value)} className="pl-10" onKeyDown={(e) => e.key === "Enter" && handleGenerate()} /></div>
            <Button onClick={handleGenerate} disabled={!filename.trim()}><RefreshCw className="w-4 h-4 mr-2" />Generar</Button>
          </div>
          {generatedHash && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground mb-1">Nombre generado:</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-lg font-mono text-green-400 break-all">{generateSafeName(filename, generatedHash)}</code>
                  <Button variant="outline" size="sm" onClick={copyToClipboard}>{copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10"><p className="text-xs text-blue-400 mb-1">Hash (12 chars)</p><code className="font-mono">{generatedHash}</code></div>
                <div className="p-3 rounded-lg bg-purple-500/10"><p className="text-xs text-purple-400 mb-1">Nombre seguro</p><code className="font-mono">{filename.replace(/\s+/g, "_")}</code></div>
              </div>
              {showCollisionWarning && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                  <div><p className="text-sm font-medium text-yellow-300">Colisión detectada!</p><p className="text-xs text-yellow-300/70 mt-1">Este nombre de archivo ya existe. El hash único evita que se sobrescriba.</p></div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle className="flex items-center gap-2"><FolderOpen className="w-5 h-5" />Archivos Generados</CardTitle><CardDescription>Historial de nombres únicos generados</CardDescription></div>
          {files.length > 0 && <Button variant="outline" size="sm" onClick={() => { setFiles([]); setGeneratedHash(""); setFilename(""); setShowCollisionWarning(false); }}><XCircle className="w-4 h-4 mr-2" />Limpiar</Button>}
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground"><FileText className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>No hay archivos generados aún</p></div>
          ) : (
            <div className="space-y-2">{files.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-500/20"><FileText className="w-4 h-4 text-green-400" /></div>
                  <div><code className="text-sm">{generateSafeName(file.name, file.hash)}</code><p className="text-xs text-muted-foreground">Original: {file.name}</p></div>
                </div>
                <Badge variant="outline" className="text-xs">{new Date(file.timestamp).toLocaleTimeString()}</Badge>
              </div>
            ))}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== SESSION STATE DEMO ====================

interface ChatMessage { id: string; role: "user" | "assistant"; content: string; timestamp: number; }
interface MemoryEntry { question: string; answer: string; timestamp: number; }

function SessionStateDemo() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationMemory, setConversationMemory] = useState<MemoryEntry[]>([]);
  const [isSimulatingResponse, setIsSimulatingResponse] = useState(false);

  const simulateResponse = async (userMessage: string) => {
    setIsSimulatingResponse(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    let response = "";
    if (conversationMemory.length === 0) {
      response = `Entiendo tu pregunta sobre "${userMessage}". Como es nuestra primera interacción, no tengo contexto previo.`;
    } else {
      const lastTopic = conversationMemory[conversationMemory.length - 1];
      response = `Basándome en nuestra conversación anterior sobre "${lastTopic.question}", puedo responder sobre "${userMessage}" con ese contexto.`;
    }
    setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: response, timestamp: Date.now() }]);
    setConversationMemory(prev => [...prev, { question: userMessage, answer: response, timestamp: Date.now() }]);
    setIsSimulatingResponse(false);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: input, timestamp: Date.now() }]);
    simulateResponse(input);
    setInput("");
  };

  return (
    <div className="space-y-6">
      <div><h3 className="text-xl font-bold">Demo de Session State</h3><p className="text-sm text-muted-foreground">Observa cómo st.session_state preserva la memoria conversacional entre reruns</p></div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-red-500/20 bg-red-500/5"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2 text-red-400"><XCircle className="w-4 h-4" />Sin Session State</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">El <code className="bg-red-500/20 px-1 rounded text-red-300">ConversationBufferMemory</code> se recrea en cada rerun. El historial visual permanece, pero la memoria interna se pierde.</p></CardContent></Card>
        <Card className="border-green-500/20 bg-green-500/5"><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2 text-green-400"><CheckCircle2 className="w-4 h-4" />Con Session State</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Guardar el chain en <code className="bg-green-500/20 px-1 rounded text-green-300">st.session_state</code> preserva la memoria interna entre interacciones.</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5" />Chat Simulado</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => { setConversationMemory([]); }}><RotateCcw className="w-4 h-4 mr-2" />Simular Rerun</Button>
                <Button variant="destructive" size="sm" onClick={() => { setMessages([]); setConversationMemory([]); }}><XCircle className="w-4 h-4 mr-2" />Reset</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-64 overflow-y-auto space-y-3 p-4 rounded-lg bg-muted/30">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground"><Bot className="w-12 h-12 mb-4 opacity-50" /><p className="text-sm">Inicia una conversación para ver el demo</p></div>
              ) : messages.map((msg) => (
                <div key={msg.id} className={`flex items-start gap-3 ${msg.role === "user" ? "" : "flex-row-reverse"}`}>
                  <div className={`p-2 rounded-full ${msg.role === "user" ? "bg-blue-500/20" : "bg-purple-500/20"}`}>
                    {msg.role === "user" ? <User className="w-4 h-4 text-blue-400" /> : <Bot className="w-4 h-4 text-purple-400" />}
                  </div>
                  <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === "user" ? "bg-blue-500/10" : "bg-purple-500/10"}`}>
                    <p className="text-sm">{msg.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
              {isSimulatingResponse && (
                <div className="flex items-center gap-2 text-muted-foreground"><div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /><span className="text-sm">El asistente está escribiendo...</span></div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input placeholder="Escribe un mensaje..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} disabled={isSimulatingResponse} />
              <Button onClick={handleSend} disabled={isSimulatingResponse || !input.trim()}><Send className="w-4 h-4" /></Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm"><Brain className="w-4 h-4" />Memoria del Chain</CardTitle>
              <Badge variant={conversationMemory.length > 0 ? "default" : "secondary"} className={conversationMemory.length > 0 ? "bg-green-500/20 text-green-300" : ""}>{conversationMemory.length} entradas</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {conversationMemory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><Database className="w-10 h-10 mx-auto mb-3 opacity-50" /><p className="text-sm">Memoria vacía</p><p className="text-xs mt-1">La memoria se reinició</p></div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">{conversationMemory.map((entry, index) => (
                <div key={index} className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-xs text-green-400 font-medium mb-1">Pregunta {index + 1}</p>
                  <p className="text-sm mb-2">{entry.question}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{entry.answer}</p>
                </div>
              ))}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ==================== CODE PLAYGROUND ====================

const optimizedCodeSnippet = `import os
import hashlib
import tempfile
from pathlib import Path

import streamlit as st
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory

# CONFIG UI
st.set_page_config(page_title="SEMSEproject - AI Knowledge", page_icon="🧠", layout="wide")
st.title("SEMSEproject: Chat Semántico")

# HELPERS CON CACHÉ
def file_hash(file_bytes: bytes) -> str:
    return hashlib.sha256(file_bytes).hexdigest()

@st.cache_data(show_spinner=False)
def save_temp_pdf(file_bytes: bytes, original_name: str) -> str:
    safe_name = Path(original_name).stem.replace(" ", "_")
    digest = hashlib.sha256(file_bytes).hexdigest()[:12]
    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{safe_name}_{digest}.pdf") as tmp:
        tmp.write(file_bytes)
        return tmp.name

@st.cache_data(show_spinner=False)
def load_and_split_pdf(pdf_path: str):
    loader = PyPDFLoader(pdf_path)
    docs = loader.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    return splitter.split_documents(docs)

@st.cache_resource(show_spinner=False)
def build_vectorstore(_chunks, api_key: str):
    os.environ["OPENAI_API_KEY"] = api_key
    embeddings = OpenAIEmbeddings()
    return Chroma.from_documents(_chunks, embeddings)`;

const problematicCodeSnippet = `# PROBLEMAS EN ESTA VERSIÓN

def process_pdf():
    # Se ejecuta en CADA rerun
    loader = PyPDFLoader("temp.pdf")  # Nombre fijo
    docs = loader.load()
    chunks = splitter.split_documents(docs)
    
    # Recrea embeddings cada vez
    embeddings = OpenAIEmbeddings()
    vector_db = Chroma.from_documents(chunks, embeddings)
    
    return vector_db

# Cada pregunta = reprocesar todo
# Memoria no persiste
# API key expuesta en UI
# Sin botón de reset`;

function CodePlayground() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("optimized");

  const copyCode = () => {
    const code = activeTab === "optimized" ? optimizedCodeSnippet : problematicCodeSnippet;
    navigator.clipboard.writeText(code);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div><h3 className="text-xl font-bold">Playground de Código</h3><p className="text-sm text-muted-foreground">Copia y usa el código optimizado en tu proyecto</p></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Zap, label: "@st.cache_data", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
          { icon: Zap, label: "@st.cache_resource", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
          { icon: CheckCircle, label: "st.session_state", color: "bg-green-500/10 text-green-400 border-green-500/30" },
          { icon: CheckCircle, label: "Hash único", color: "bg-pink-500/10 text-pink-400 border-pink-500/30" },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className={`flex items-center gap-2 p-3 rounded-lg border ${color}`}><Icon className="w-4 h-4" /><span className="text-xs font-medium">{label}</span></div>
        ))}
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="optimized" className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" />Versión Optimizada</TabsTrigger>
                <TabsTrigger value="problematic" className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" />Problemas</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={copyCode}>
              {copied ? (<><CheckCircle2 className="w-4 h-4 mr-2 text-green-400" />Copiado</>) : (<><Copy className="w-4 h-4 mr-2" />Copiar</>)}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs value={activeTab}>
            <TabsContent value="optimized" className="mt-0">
              <pre className="text-sm font-mono text-muted-foreground overflow-x-auto p-4 rounded-lg bg-muted max-h-[500px] overflow-y-auto"><code>{optimizedCodeSnippet}</code></pre>
            </TabsContent>
            <TabsContent value="problematic" className="mt-0">
              <pre className="text-sm font-mono text-red-300/80 overflow-x-auto p-4 rounded-lg bg-red-950/10 border border-red-500/20 max-h-[500px] overflow-y-auto"><code>{problematicCodeSnippet}</code></pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-green-500/20">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2 text-green-400"><CheckCircle2 className="w-4 h-4" />Qué incluye la versión optimizada</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {["Caché de datos con @st.cache_data", "Caché de recursos con @st.cache_resource", "Session state para memoria persistente", "Hash único por archivo", "Botón para reiniciar conversación", "Visualización de documento activo"].map(item => (
                <li key={item} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2 text-blue-400"><Terminal className="w-4 h-4" />Requisitos</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs font-mono text-muted-foreground"><code>{`pip install streamlit langchain langchain-openai langchain-community chromadb pypdf\n\n# Variables de entorno\nexport OPENAI_API_KEY="sk-..."`}</code></pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ==================== MAIN PAGE ====================

const ragTabs = [
  { id: "visualizer", label: "Flujo RAG", icon: Database },
  { id: "cache", label: "Simulador Caché", icon: Zap },
  { id: "performance", label: "Rendimiento", icon: Clock },
  { id: "hash", label: "Hash Generator", icon: Hash },
  { id: "session", label: "Session State", icon: Brain },
  { id: "code", label: "Playground", icon: Terminal },
];

export default function RAGToolsPage() {
  const [activeTab, setActiveTab] = useState("visualizer");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">RAG Architect Tools</h1>
        <p className="text-muted-foreground mt-1">
          Herramientas interactivas para entender y construir sistemas RAG (Retrieval-Augmented Generation)
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ragTabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className="gap-2"
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      <div>
        {activeTab === "visualizer" && <RAGVisualizer />}
        {activeTab === "cache" && <CacheSimulator />}
        {activeTab === "performance" && <PerformanceComparer />}
        {activeTab === "hash" && <HashGenerator />}
        {activeTab === "session" && <SessionStateDemo />}
        {activeTab === "code" && <CodePlayground />}
      </div>
    </div>
  );
}
