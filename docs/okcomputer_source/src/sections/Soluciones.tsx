import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Zap, Shield, Database, RefreshCw, MessageSquare, FileSearch, Settings } from 'lucide-react';

interface Solution {
  icon: React.ElementType;
  title: string;
  description: string;
  benefit: string;
}

const solutions: Solution[] = [
  {
    icon: Database,
    title: 'Cachear el procesamiento del PDF',
    description: 'Usar @st.cache_data para guardar el PDF temporal y evitar re-procesamiento en cada interacción.',
    benefit: 'El PDF solo se procesa una vez'
  },
  {
    icon: Zap,
    title: 'Cachear embeddings y vector store',
    description: 'Usar @st.cache_resource para mantener el vector store en memoria entre reruns.',
    benefit: 'Embeddings persistentes, sin recálculos'
  },
  {
    icon: MessageSquare,
    title: 'Guardar chain en session_state',
    description: 'Mantener el objeto ConversationalRetrievalChain en st.session_state para preservar la memoria.',
    benefit: 'Memoria conversacional coherente'
  },
  {
    icon: FileSearch,
    title: 'Nombre temporal único por archivo',
    description: 'Generar nombres únicos usando hash SHA256 para evitar conflictos entre sesiones.',
    benefit: 'Sin colisiones de archivos'
  },
  {
    icon: RefreshCw,
    title: 'Botón para reiniciar conversación',
    description: 'Permitir al usuario limpiar el estado y empezar de nuevo con un solo click.',
    benefit: 'Mejor control de la experiencia'
  },
  {
    icon: Settings,
    title: 'Una sola fuente de verdad',
    description: 'Mantener el historial en st.session_state como única fuente de mensajes.',
    benefit: 'Estado consistente y predecible'
  }
];

export function Soluciones() {
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

    const cards = sectionRef.current?.querySelectorAll('.solution-card-wrapper');
    cards?.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <section id="soluciones" ref={sectionRef} className="relative py-24 px-6">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-green-950/5 to-background" />
      
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 mb-6">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-300 font-medium">La Mejora Mínima y Efectiva</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            ¿Cómo lo <span className="text-green-400">arreglamos</span>?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Separar responsabilidades y usar el sistema de caché de Streamlit 
            para recursos pesados.
          </p>
        </div>

        {/* Solutions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {solutions.map((solution, index) => (
            <div
              key={index}
              data-index={index}
              className={`solution-card-wrapper transition-all duration-700 ${
                visibleCards.has(index) 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-10'
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <SolutionCard {...solution} />
            </div>
          ))}
        </div>

        {/* Benefits Summary */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <BenefitCard 
            icon={Zap}
            title="Más Rápida"
            description="El PDF ya no se reingesta en cada pregunta. Separar guardado, chunking y vector store usando caché."
          />
          <BenefitCard 
            icon={Shield}
            title="Más Estable"
            description="Solo reconstruye el sistema cuando cambia el PDF. Estado consistente entre interacciones."
          />
          <BenefitCard 
            icon={MessageSquare}
            title="Memoria Coherente"
            description="El chain queda guardado en st.session_state, así que no se resetea en cada interacción."
          />
        </div>
      </div>
    </section>
  );
}

function SolutionCard({ icon: Icon, title, description, benefit }: Solution) {
  return (
    <div className="solution-card rounded-2xl p-6 h-full card-hover">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-green-500/10 flex-shrink-0">
          <Icon className="w-6 h-6 text-green-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground mb-3">{description}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-300">
              {benefit}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BenefitCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-green-500/5 to-transparent border border-green-500/20">
      <Icon className="w-8 h-8 text-green-400 mb-4" />
      <h4 className="text-lg font-semibold text-white mb-2">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
