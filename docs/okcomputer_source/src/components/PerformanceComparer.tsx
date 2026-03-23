import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingDown,
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap
} from 'lucide-react';

interface Metric {
  label: string;
  withoutCache: number;
  withCache: number;
  unit: string;
  lowerIsBetter: boolean;
}

const metrics: Metric[] = [
  { label: 'Tiempo de carga', withoutCache: 3200, withCache: 150, unit: 'ms', lowerIsBetter: true },
  { label: 'Tokens consumidos', withoutCache: 45000, withCache: 0, unit: 'tokens', lowerIsBetter: true },
  { label: 'Costo estimado', withoutCache: 0.045, withCache: 0, unit: '$', lowerIsBetter: true },
  { label: 'Memoria usada', withoutCache: 512, withCache: 512, unit: 'MB', lowerIsBetter: true },
];

export function PerformanceComparer() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentScenario, setCurrentScenario] = useState<'none' | 'without' | 'with'>('none');
  const [showResults, setShowResults] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [message, ...prev].slice(0, 8));
  };

  const simulateWithoutCache = async () => {
    setIsSimulating(true);
    setCurrentScenario('without');
    setProgress(0);
    setLogs([]);
    setShowResults(false);

    const steps = [
      { message: 'Cargando PDF desde disco...', progress: 10, delay: 300 },
      { message: 'Extrayendo texto del PDF...', progress: 25, delay: 400 },
      { message: 'Dividiendo en chunks (1000 chars)...', progress: 40, delay: 500 },
      { message: 'Inicializando OpenAI Embeddings...', progress: 55, delay: 300 },
      { message: 'Generando embeddings (~45k tokens)...', progress: 75, delay: 1200 },
      { message: 'Construyendo vector store Chroma...', progress: 90, delay: 600 },
      { message: '¡Procesamiento completo!', progress: 100, delay: 200 },
    ];

    for (const step of steps) {
      setProgress(step.progress);
      addLog(step.message);
      await new Promise(resolve => setTimeout(resolve, step.delay));
    }

    setShowResults(true);
    setIsSimulating(false);
  };

  const simulateWithCache = async () => {
    setIsSimulating(true);
    setCurrentScenario('with');
    setProgress(0);
    setLogs([]);
    setShowResults(false);

    const steps = [
      { message: 'Verificando caché...', progress: 30, delay: 100 },
      { message: '¡Cache hit! Recuperando datos...', progress: 60, delay: 50 },
      { message: 'Vector store cargado desde caché', progress: 100, delay: 50 },
    ];

    for (const step of steps) {
      setProgress(step.progress);
      addLog(step.message);
      await new Promise(resolve => setTimeout(resolve, step.delay));
    }

    setShowResults(true);
    setIsSimulating(false);
  };

  const reset = () => {
    setIsSimulating(false);
    setProgress(0);
    setCurrentScenario('none');
    setShowResults(false);
    setLogs([]);
  };

  const getImprovement = (metric: Metric) => {
    if (metric.withoutCache === 0) return 0;
    const improvement = ((metric.withoutCache - metric.withCache) / metric.withoutCache) * 100;
    return Math.round(improvement);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Comparador de Rendimiento</h2>
        <p className="text-muted-foreground">
          Compara el impacto real de usar caché vs no usarlo
        </p>
      </div>

      {/* Simulation Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <XCircle className="w-5 h-5" />
              Sin Caché
            </CardTitle>
            <CardDescription>
              Re-procesa todo en cada interacción
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tiempo estimado</span>
                <span className="text-red-400 font-mono">~3.2 segundos</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tokens API</span>
                <span className="text-red-400 font-mono">~45,000</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Costo</span>
                <span className="text-red-400 font-mono">~$0.045</span>
              </div>
            </div>
            <Button 
              variant="destructive" 
              className="w-full"
              onClick={simulateWithoutCache}
              disabled={isSimulating}
            >
              {isSimulating && currentScenario === 'without' ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Simulando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Simular Sin Caché
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-green-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              Con Caché
            </CardTitle>
            <CardDescription>
              Reutiliza resultados procesados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tiempo estimado</span>
                <span className="text-green-400 font-mono">~150ms</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tokens API</span>
                <span className="text-green-400 font-mono">0</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Costo</span>
                <span className="text-green-400 font-mono">$0</span>
              </div>
            </div>
            <Button 
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={simulateWithCache}
              disabled={isSimulating}
            >
              {isSimulating && currentScenario === 'with' ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Simulando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Simular Con Caché
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Progress & Logs */}
      {(isSimulating || logs.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Progreso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress} className="h-2" />
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {logs.map((log, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-2 text-sm animate-slide-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <span className="text-muted-foreground font-mono text-xs">
                    {new Date().toLocaleTimeString()}
                  </span>
                  <span className={currentScenario === 'with' ? 'text-green-400' : 'text-orange-400'}>
                    {log}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {showResults && (
        <Card className={currentScenario === 'with' ? 'border-green-500/30' : 'border-red-500/30'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {currentScenario === 'with' ? (
                <>
                  <Zap className="w-5 h-5 text-green-400" />
                  <span className="text-green-400">¡Mejora significativa!</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <span className="text-red-400">Rendimiento subóptimo</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {metrics.map((metric) => {
                const value = currentScenario === 'with' ? metric.withCache : metric.withoutCache;
                const improvement = getImprovement(metric);
                
                return (
                  <div key={metric.label} className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
                    <p className={`text-2xl font-bold font-mono ${
                      currentScenario === 'with' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {metric.unit === '$' ? `$${value.toFixed(3)}` : `${value}${metric.unit}`}
                    </p>
                    {currentScenario === 'with' && improvement > 0 && (
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <TrendingDown className="w-3 h-3 text-green-400" />
                        <span className="text-xs text-green-400">-{improvement}%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {currentScenario === 'without' && (
              <div className="mt-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-300">
                      Problema identificado
                    </p>
                    <p className="text-xs text-yellow-300/70 mt-1">
                      Sin caché, cada interacción recalcula todo desde cero, 
                      desperdiciando tiempo y tokens de API.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {currentScenario === 'with' && (
              <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-300">
                      Solución aplicada
                    </p>
                    <p className="text-xs text-green-300/70 mt-1">
                      El caché almacena resultados pesados, reduciendo el tiempo 
                      de carga en un 95% y eliminando costos de API.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reset */}
      {(showResults || logs.length > 0) && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reiniciar Comparación
          </Button>
        </div>
      )}
    </div>
  );
}
