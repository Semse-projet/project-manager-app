import { useEffect, useRef, useState } from 'react';
import { FileText, Scissors, Brain, Database, MessageSquare, User, ArrowRight, Layers } from 'lucide-react';

interface FlowStep {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
}

const flowSteps: FlowStep[] = [
  {
    icon: FileText,
    title: 'PDF Upload',
    description: 'Usuario sube documento',
    color: 'blue'
  },
  {
    icon: Scissors,
    title: 'Chunking',
    description: 'Divide en fragmentos',
    color: 'purple'
  },
  {
    icon: Brain,
    title: 'Embeddings',
    description: 'Convierte a vectores',
    color: 'pink'
  },
  {
    icon: Database,
    title: 'Vector Store',
    description: 'Almacena en Chroma',
    color: 'green'
  }
];

const querySteps: FlowStep[] = [
  {
    icon: User,
    title: 'Pregunta',
    description: 'Usuario consulta',
    color: 'blue'
  },
  {
    icon: Database,
    title: 'Retrieval',
    description: 'Busca chunks similares',
    color: 'purple'
  },
  {
    icon: Brain,
    title: 'LLM',
    description: 'Genera respuesta',
    color: 'pink'
  },
  {
    icon: MessageSquare,
    title: 'Respuesta',
    description: 'Con fuentes citadas',
    color: 'green'
  }
];

export function Arquitectura() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section id="arquitectura" ref={sectionRef} className="relative py-24 px-6">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-purple-950/5 to-background" />
      
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 mb-6">
            <Layers className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300 font-medium">Arquitectura RAG</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Flujo de <span className="text-purple-400">Datos</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Entiende cómo fluye la información en un sistema RAG bien diseñado.
          </p>
        </div>

        {/* Ingestion Flow */}
        <div className={`mb-16 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h3 className="text-2xl font-bold text-white mb-8 text-center">1. Ingesta de Documentos</h3>
          <div className="relative">
            {/* Connection line */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-green-500/30 -translate-y-1/2 z-0" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
              {flowSteps.map((step, index) => (
                <FlowStepCard key={index} {...step} delay={index * 150} />
              ))}
            </div>
          </div>
        </div>

        {/* Query Flow */}
        <div className={`transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h3 className="text-2xl font-bold text-white mb-8 text-center">2. Flujo de Consulta</h3>
          <div className="relative">
            {/* Connection line */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-green-500/30 -translate-y-1/2 z-0" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
              {querySteps.map((step, index) => (
                <FlowStepCard key={index} {...step} delay={index * 150 + 600} />
              ))}
            </div>
          </div>
        </div>

        {/* Architecture Diagram */}
        <div className={`mt-16 transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="p-8 rounded-2xl bg-gradient-to-br from-purple-500/5 to-blue-500/5 border border-purple-500/20">
            <h3 className="text-xl font-bold text-white mb-6 text-center">Diagrama de Componentes</h3>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <ComponentBox label="Streamlit UI" color="blue" />
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
              <ComponentBox label="Session State" color="purple" />
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
              <ComponentBox label="RAG Chain" color="pink" />
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
              <ComponentBox label="Chroma DB" color="green" />
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <ComponentBox label="OpenAI Embeddings" color="yellow" />
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
              <ComponentBox label="ChatOpenAI" color="orange" />
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
              <ComponentBox label="Memory Buffer" color="red" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FlowStepCard({ icon: Icon, title, description, color, delay }: FlowStep & { delay: number }) {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
    pink: 'from-pink-500/20 to-pink-600/10 border-pink-500/30 text-pink-400',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400',
  };

  return (
    <div 
      className={`flex flex-col items-center p-6 rounded-2xl bg-gradient-to-br ${colorClasses[color]} border card-hover`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="p-4 rounded-xl bg-white/5 mb-4">
        <Icon className="w-8 h-8" />
      </div>
      <h4 className="text-lg font-semibold text-white mb-1">{title}</h4>
      <p className="text-sm text-center text-white/70">{description}</p>
    </div>
  );
}

function ComponentBox({ label, color }: { label: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
    purple: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
    pink: 'bg-pink-500/20 border-pink-500/30 text-pink-300',
    green: 'bg-green-500/20 border-green-500/30 text-green-300',
    yellow: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300',
    orange: 'bg-orange-500/20 border-orange-500/30 text-orange-300',
    red: 'bg-red-500/20 border-red-500/30 text-red-300',
  };

  return (
    <div className={`px-4 py-2 rounded-lg border ${colorClasses[color]} text-sm font-medium`}>
      {label}
    </div>
  );
}
