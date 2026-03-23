import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, RotateCcw, BrainCircuit, KeyRound, FileX, ShieldAlert, Layers, XCircle } from 'lucide-react';

interface Problem {
  icon: React.ElementType;
  title: string;
  description: string;
  impact: string;
}

const problems: Problem[] = [
  {
    icon: RotateCcw,
    title: 'Re-vectorización en cada interacción',
    description: 'En Streamlit, el script se reejecuta de arriba a abajo cada vez que el usuario interactúa. Esto significa que cada pregunta vuelve a cargar el PDF, trocearlo y crear embeddings.',
    impact: 'Lento, caro y consume tokens innecesariamente'
  },
  {
    icon: BrainCircuit,
    title: 'Memoria conversacional no persistente',
    description: 'Aunque los mensajes se guardan en st.session_state, el objeto ConversationBufferMemory se crea de nuevo en cada rerun.',
    impact: 'El historial visual permanece, pero la memoria interna de LangChain se resetea'
  },
  {
    icon: KeyRound,
    title: 'API Key expuesta en la UI',
    description: 'Guardar la API key manualmente en widgets funciona para pruebas, pero es inseguro para producción.',
    impact: 'Riesgo de seguridad y exposición de credenciales'
  },
  {
    icon: FileX,
    title: 'Archivo temporal fijo (temp.pdf)',
    description: 'Usar un nombre fijo para archivos temporales puede causar conflictos entre sesiones.',
    impact: 'Archivos se pisan entre sí, sin limpieza adecuada'
  },
  {
    icon: ShieldAlert,
    title: 'UX sin protección de recursos',
    description: 'No hay botón para reiniciar conversación, no se muestra qué documento está activo.',
    impact: 'Experiencia confusa para el usuario'
  },
  {
    icon: Layers,
    title: 'Chain monolítica obsoleta',
    description: 'ConversationalRetrievalChain funciona, pero hoy conviene usar pipelines de retrieval más modulares.',
    impact: 'Arquitectura difícil de escalar y mantener'
  }
];

export function Problemas() {
  const [visibleCards, setVisibleCards] = useState<Set<number>>(new Set());
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0');
            setVisibleCards((prev) => new Set([...prev, index]));
          }
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -50px 0px' }
    );

    const cards = sectionRef.current?.querySelectorAll('.problem-card-wrapper');
    cards?.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <section id="problemas" ref={sectionRef} className="relative py-24 px-6">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-red-950/5 to-background" />
      
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/30 mb-6">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-300 font-medium">Problemas Críticos</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            ¿Qué está <span className="text-red-400">roto</span>?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Tu código sirve como prototipo inicial, pero tiene problemas de arquitectura 
            que afectan rendimiento, memoria y consistencia.
          </p>
        </div>

        {/* Problems Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {problems.map((problem, index) => (
            <div
              key={index}
              data-index={index}
              className={`problem-card-wrapper transition-all duration-700 ${
                visibleCards.has(index) 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-10'
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <ProblemCard {...problem} />
            </div>
          ))}
        </div>

        {/* Summary Alert */}
        <div className="mt-12 p-6 rounded-2xl bg-red-500/5 border border-red-500/20 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
          <div>
            <h4 className="text-lg font-semibold text-red-300 mb-2">Diagnóstico Final</h4>
            <p className="text-muted-foreground">
              Tu código actual no es una base sólida para un módulo serio de conocimiento porque 
              <span className="text-red-300"> recalcula demasiado</span>, 
              <span className="text-red-300"> desperdicia costo</span>, 
              <span className="text-red-300"> no conserva bien la memoria interna</span> y 
              <span className="text-red-300"> no está listo para crecer</span>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProblemCard({ icon: Icon, title, description, impact }: Problem) {
  return (
    <div className="problem-card rounded-2xl p-6 h-full card-hover">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-red-500/10 flex-shrink-0">
          <Icon className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground mb-3">{description}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-300">
              Impacto: {impact}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
