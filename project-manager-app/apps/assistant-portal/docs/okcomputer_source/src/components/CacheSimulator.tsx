import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Database, 
  Clock, 
  Zap, 
  CheckCircle2, 
  XCircle, 
  RotateCcw,
  AlertTriangle,
  Play,
  FileText,
  Brain,
  Layers
} from 'lucide-react';

interface Execution {
  id: number;
  timestamp: number;
  cached: boolean;
  duration: number;
  type: 'data' | 'resource';
}

export function CacheSimulator() {
  const [useCache, setUseCache] = useState(false);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cacheData, setCacheData] = useState<Map<string, any>>(new Map());
  const [cacheResource, setCacheResource] = useState<Map<string, any>>(new Map());
  const [currentStep, setCurrentStep] = useState<string>('');

  const simulateProcessing = useCallback(async (type: 'data' | 'resource') => {
    setIsProcessing(true);
    const steps = type === 'data' 
      ? ['Leyendo PDF...', 'Extrayendo texto...', 'Dividiendo chunks...', 'Procesando...']
      : ['Inicializando embeddings...', 'Conectando a OpenAI...', 'Generando vectores...', 'Almacenando...'];
    
    for (const step of steps) {
      setCurrentStep(step);
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    setCurrentStep('');
    setIsProcessing(false);
  }, []);

  const handleExecute = async (type: 'data' | 'resource') => {
    const cacheKey = type === 'data' ? 'pdf_data' : 'embeddings';
    const cache = type === 'data' ? cacheData : cacheResource;
    const setCache = type === 'data' ? setCacheData : setCacheResource;

    const startTime = Date.now();
    
    if (useCache && cache.has(cacheKey)) {
      // Cache hit - instant
      const execution: Execution = {
        id: Date.now(),
        timestamp: Date.now(),
        cached: true,
        duration: 50,
        type
      };
      setExecutions(prev => [execution, ...prev].slice(0, 10));
    } else {
      // Cache miss - simulate processing
      await simulateProcessing(type);
      const duration = Date.now() - startTime;
      
      if (useCache) {
        setCache(new Map(cache.set(cacheKey, { timestamp: Date.now() })));
      }
      
      const execution: Execution = {
        id: Date.now(),
        timestamp: Date.now(),
        cached: false,
        duration,
        type
      };
      setExecutions(prev => [execution, ...prev].slice(0, 10));
    }
  };

  const clearCache = () => {
    setCacheData(new Map());
    setCacheResource(new Map());
    setExecutions([]);
  };

  const getCacheHits = () => executions.filter(e => e.cached).length;
  const getCacheMisses = () => executions.filter(e => !e.cached).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Simulador de Caché</h2>
          <p className="text-muted-foreground">
            Experimenta cómo @st.cache_data y @st.cache_resource mejoran el rendimiento
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="cache-mode"
              checked={useCache}
              onCheckedChange={setUseCache}
            />
            <Label htmlFor="cache-mode" className={useCache ? 'text-green-400' : 'text-red-400'}>
              {useCache ? 'Caché ACTIVADO' : 'Caché DESACTIVADO'}
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={clearCache}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Limpiar
          </Button>
        </div>
      </div>

      {/* Cache Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={`border ${useCache ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Estado</span>
              {useCache ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
            </div>
            <p className={`text-lg font-semibold mt-1 ${useCache ? 'text-green-400' : 'text-red-400'}`}>
              {useCache ? 'Activado' : 'Desactivado'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cache Hits</span>
              <Zap className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-lg font-semibold text-white mt-1">{getCacheHits()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cache Misses</span>
              <Clock className="w-5 h-5 text-orange-400" />
            </div>
            <p className="text-lg font-semibold text-white mt-1">{getCacheMisses()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ahorro de tiempo</span>
              <Database className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-lg font-semibold text-white mt-1">
              {getCacheHits() > 0 ? `${Math.round((getCacheHits() / executions.length) * 100)}%` : '0%'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-blue-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-400">
              <FileText className="w-5 h-5" />
              @st.cache_data
            </CardTitle>
            <CardDescription>
              Para datos y resultados de procesamiento de PDFs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="bg-blue-500/10 text-blue-300">
                PDF → Chunks
              </Badge>
              <span className="text-muted-foreground">~800ms sin caché</span>
            </div>
            <Button 
              onClick={() => handleExecute('data')} 
              disabled={isProcessing}
              className="w-full"
              variant={useCache ? 'default' : 'destructive'}
            >
              {isProcessing && currentStep ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {currentStep}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Procesar PDF
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-400">
              <Brain className="w-5 h-5" />
              @st.cache_resource
            </CardTitle>
            <CardDescription>
              Para objetos pesados como embeddings y vector stores
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="bg-purple-500/10 text-purple-300">
                Chunks → Embeddings
              </Badge>
              <span className="text-muted-foreground">~1200ms sin caché</span>
            </div>
            <Button 
              onClick={() => handleExecute('resource')} 
              disabled={isProcessing}
              className="w-full"
              variant={useCache ? 'default' : 'destructive'}
            >
              {isProcessing && currentStep ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {currentStep}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Generar Embeddings
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Execution Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Registro de Ejecuciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {executions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Ejecuta alguna operación para ver los resultados</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {executions.map((exec, index) => (
                <div 
                  key={exec.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 animate-slide-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    {exec.cached ? (
                      <div className="p-2 rounded-full bg-green-500/20">
                        <Zap className="w-4 h-4 text-green-400" />
                      </div>
                    ) : (
                      <div className="p-2 rounded-full bg-orange-500/20">
                        <Clock className="w-4 h-4 text-orange-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-white">
                        {exec.type === 'data' ? 'Procesar PDF' : 'Generar Embeddings'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(exec.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={exec.cached ? 'default' : 'secondary'} className={exec.cached ? 'bg-green-500/20 text-green-300' : ''}>
                      {exec.cached ? 'CACHE HIT' : 'CACHE MISS'}
                    </Badge>
                    <span className={`text-sm font-mono ${exec.cached ? 'text-green-400' : 'text-orange-400'}`}>
                      {exec.duration}ms
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warning */}
      {!useCache && executions.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-300">Sin caché estás desperdiciando recursos</p>
            <p className="text-xs text-yellow-300/70 mt-1">
              Cada ejecución recalcula todo desde cero. Activa el caché para ver la diferencia.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
