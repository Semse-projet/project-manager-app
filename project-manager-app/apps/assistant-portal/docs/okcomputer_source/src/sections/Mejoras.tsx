import { useEffect, useRef, useState } from 'react';
import { Rocket, Database, Layers, FileText, Settings, Lock, Sparkles, ArrowUpRight } from 'lucide-react';

interface Mejora {
  icon: React.ElementType;
  title: string;
  description: string;
  difficulty: 'Fácil' | 'Medio' | 'Avanzado';
}

const mejoras: Mejora[] = [
  {
    icon: Database,
    title: 'Persistencia real de Chroma',
    description: 'Ahora el vector store está en memoria. Para una base de conocimiento permanente, usar persist_directory.',
    difficulty: 'Fácil'
  },
  {
    icon: Layers,
    title: 'Separar backend de UI',
    description: 'Dividir en: app.py (UI), rag_engine.py (ingesta/retrieval), config.py (settings), prompts.py (system prompts).',
    difficulty: 'Medio'
  },
  {
    icon: FileText,
    title: 'Soporte multi-PDF',
    description: 'Permitir subir varios PDFs, indexarlos juntos y filtrar por documento específico.',
    difficulty: 'Medio'
  },
  {
    icon: Sparkles,
    title: 'Citas reales en respuestas',
    description: 'Hacer que el modelo cite página y documento en lugar de solo mostrar chunks debajo.',
    difficulty: 'Medio'
  },
  {
    icon: Settings,
    title: 'Modelos configurables',
    description: 'Permitir seleccionar desde sidebar: modelo LLM, k de retrieval, tamaño de chunk, overlap.',
    difficulty: 'Fácil'
  },
  {
    icon: Lock,
    title: 'API Key en producción',
    description: 'Usar st.secrets["OPENAI_API_KEY"] o variables de entorno en lugar de input de usuario.',
    difficulty: 'Fácil'
  }
];

const difficultyColors: Record<string, string> = {
  'Fácil': 'bg-green-500/20 text-green-300',
  'Medio': 'bg-yellow-500/20 text-yellow-300',
  'Avanzado': 'bg-red-500/20 text-red-300'
};

export function Mejoras() {
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

    const cards = sectionRef.current?.querySelectorAll('.mejora-card-wrapper');
    cards?.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <section id="mejoras" ref={sectionRef} className="relative py-24 px-6">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-blue-950/5 to-background" />
      
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 mb-6">
            <Rocket className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-300 font-medium">Próximos Pasos</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Otras <span className="text-blue-400">Mejoras</span> Recomendadas
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Para llevar SEMSEproject al siguiente nivel de profesionalismo.
          </p>
        </div>

        {/* Mejoras Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mejoras.map((mejora, index) => (
            <div
              key={index}
              data-index={index}
              className={`mejora-card-wrapper transition-all duration-700 ${
                visibleCards.has(index) 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-10'
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <MejoraCard {...mejora} />
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-col items-center gap-4 p-8 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30">
            <Sparkles className="w-12 h-12 text-purple-400" />
            <h3 className="text-2xl font-bold text-white">¿Quieres la versión v2?</h3>
            <p className="text-muted-foreground max-w-lg">
              Puedo darte una versión avanzada con múltiples PDFs, citas por página, 
              selector de modelo y persistencia local en Chroma.
            </p>
            <div className="flex items-center gap-2 text-purple-400 font-medium">
              <span>Próximo paso disponible</span>
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MejoraCard({ icon: Icon, title, description, difficulty }: Mejora) {
  return (
    <div className="group p-6 rounded-2xl bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 card-hover h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-xl bg-blue-500/10">
          <Icon className="w-6 h-6 text-blue-400" />
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${difficultyColors[difficulty]}`}>
          {difficulty}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-300 transition-colors">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
