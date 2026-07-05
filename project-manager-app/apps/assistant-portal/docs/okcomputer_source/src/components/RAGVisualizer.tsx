import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  Scissors, 
  Brain, 
  Database, 
  MessageSquare, 
  User,
  ArrowRight,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  duration: number;
  color: string;
}

const ingestionSteps: Step[] = [
  { id: 'upload', title: 'PDF Upload', description: 'Usuario sube documento', icon: FileText, duration: 500, color: 'blue' },
  { id: 'chunk', title: 'Chunking', description: 'Divide en fragmentos de 1000 chars', icon: Scissors, duration: 800, color: 'purple' },
  { id: 'embed', title: 'Embeddings', description: 'OpenAI convierte a vectores', icon: Brain, duration: 1500, color: 'pink' },
  { id: 'store', title: 'Vector Store', description: 'Almacena en ChromaDB', icon: Database, duration: 600, color: 'green' },
];

const querySteps: Step[] = [
  { id: 'query', title: 'Pregunta', description: 'Usuario consulta', icon: User, duration: 200, color: 'blue' },
  { id: 'retrieve', title: 'Retrieval', description: 'Busca chunks similares (k=4)', icon: Database, duration: 400, color: 'purple' },
  { id: 'llm', title: 'LLM', description: 'GPT-4 genera respuesta', icon: Brain, duration: 2000, color: 'pink' },
  { id: 'response', title: 'Respuesta', description: 'Con fuentes citadas', icon: MessageSquare, duration: 300, color: 'green' },
];

export function RAGVisualizer() {
  const [activeFlow, setActiveFlow] = useState<'ingestion' | 'query'>('ingestion');
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);

  const steps = activeFlow === 'ingestion' ? ingestionSteps : querySteps;

  const runSimulation = async () => {
    setIsRunning(true);
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setProgress(0);

    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      setProgress(((i + 1) / steps.length) * 100);
      
      await new Promise(resolve => setTimeout(resolve, steps[i].duration));
      
      setCompletedSteps(prev => new Set([...prev, steps[i].id]));
    }

    setCurrentStep(-1);
    setIsRunning(false);
    setProgress(100);
  };

  const reset = () => {
    setCurrentStep(-1);
    setIsRunning(false);
    setCompletedSteps(new Set());
    setProgress(0);
  };

  const getStepStatus = (index: number) => {
    if (completedSteps.has(steps[index].id)) return 'completed';
    if (currentStep === index) return 'active';
    return 'pending';
  };

  const getColorClass = (color: string) => {
    const colors: Record<string, { bg: string; border: string; text: string }> = {
      blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400' },
      purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/50', text: 'text-purple-400' },
      pink: { bg: 'bg-pink-500/20', border: 'border-pink-500/50', text: 'text-pink-400' },
      green: { bg: 'bg-green-500/20', border: 'border-green-500/50', text: 'text-green-400' },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Visualizador de Flujo RAG</h2>
          <p className="text-muted-foreground">
            Observa paso a paso cómo fluye la información en el sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={activeFlow === 'ingestion' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setActiveFlow('ingestion'); reset(); }}
          >
            <FileText className="w-4 h-4 mr-2" />
            Ingesta
          </Button>
          <Button
            variant={activeFlow === 'query' ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setActiveFlow('query'); reset(); }}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Consulta
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progreso</span>
          <span className="text-white font-mono">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Flow Visualization */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            {/* Connection Line */}
            <div className="hidden md:block absolute top-12 left-0 right-0 h-1 bg-muted">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Steps */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
              {steps.map((step, index) => {
                const status = getStepStatus(index);
                const colors = getColorClass(step.color);
                const Icon = step.icon;

                return (
                  <div 
                    key={step.id}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-300 ${
                      status === 'completed' 
                        ? `${colors.bg} ${colors.border}` 
                        : status === 'active'
                        ? 'bg-yellow-500/10 border-yellow-500/50 scale-105'
                        : 'bg-muted/30 border-muted'
                    }`}
                  >
                    <div className={`p-3 rounded-full mb-3 ${
                      status === 'completed' 
                        ? colors.bg 
                        : status === 'active'
                        ? 'bg-yellow-500/20 animate-pulse'
                        : 'bg-muted'
                    }`}>
                      {status === 'completed' ? (
                        <CheckCircle2 className={`w-6 h-6 ${colors.text}`} />
                      ) : status === 'active' ? (
                        <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Icon className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <h4 className={`font-semibold text-center ${
                      status === 'completed' || status === 'active' ? 'text-white' : 'text-muted-foreground'
                    }`}>
                      {step.title}
                    </h4>
                    <p className="text-xs text-center text-muted-foreground mt-1">
                      {step.description}
                    </p>
                    {status === 'active' && (
                      <Badge variant="outline" className="mt-2 bg-yellow-500/10 text-yellow-300 border-yellow-500/30">
                        <Clock className="w-3 h-3 mr-1" />
                        {Math.round(step.duration / 100) / 10}s
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step Details */}
      {currentStep >= 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-500/20 animate-pulse">
                {(() => {
                  const Icon = steps[currentStep].icon;
                  return <Icon className="w-5 h-5 text-yellow-400" />;
                })()}
              </div>
              <div>
                <p className="text-sm font-medium text-yellow-300">
                  Ejecutando: {steps[currentStep].title}
                </p>
                <p className="text-xs text-yellow-300/70">
                  {steps[currentStep].description}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <Button 
          size="lg" 
          onClick={runSimulation}
          disabled={isRunning}
          className="min-w-[150px]"
        >
          {isRunning ? (
            <>
              <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Ejecutando...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              {progress === 100 ? 'Repetir' : 'Iniciar'} Simulación
            </>
          )}
        </Button>
        <Button 
          variant="outline" 
          size="lg"
          onClick={reset}
          disabled={isRunning}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reiniciar
        </Button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-blue-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-400">
              <FileText className="w-4 h-4" />
              Flujo de Ingesta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-blue-400" />
                Procesa el PDF una sola vez
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-blue-400" />
                Crea embeddings con OpenAI
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-blue-400" />
                Almacena en ChromaDB
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-green-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-green-400">
              <MessageSquare className="w-4 h-4" />
              Flujo de Consulta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-green-400" />
                Recibe pregunta del usuario
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-green-400" />
                Busca chunks similares (top-k)
              </li>
              <li className="flex items-center gap-2">
                <ArrowRight className="w-3 h-3 text-green-400" />
                Genera respuesta con contexto
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
