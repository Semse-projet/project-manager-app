import { useEffect, useState } from 'react';
import { Brain, FileText, MessageSquare, Database, ArrowDown } from 'lucide-react';

export function Hero() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const scrollToContent = () => {
    document.getElementById('problemas')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 grid-bg opacity-50" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
      
      {/* Content */}
      <div className={`relative z-10 text-center px-6 max-w-5xl mx-auto transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 mb-8">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="text-sm text-purple-300 font-medium">Analogía de Arquitectura RAG</span>
        </div>

        {/* Title */}
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
            Chat Semántico
          </span>
          <br />
          <span className="text-white">sobre PDFs</span>
        </h1>

        {/* Subtitle */}
        <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto">
          De un prototipo lento e ineficiente a una arquitectura RAG 
          profesional con <span className="text-purple-400 font-semibold">LangChain</span> y <span className="text-pink-400 font-semibold">Streamlit</span>
        </p>

        {/* Flow diagram */}
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 mb-16">
          <FlowItem icon={FileText} label="PDF" color="blue" />
          <ArrowConnector />
          <FlowItem icon={Database} label="Chunks" color="purple" />
          <ArrowConnector />
          <FlowItem icon={Brain} label="Embeddings" color="pink" />
          <ArrowConnector />
          <FlowItem icon={MessageSquare} label="Chat" color="green" />
        </div>

        {/* CTA */}
        <button
          onClick={scrollToContent}
          className="group inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-lg hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
        >
          Explorar la Analogía
          <ArrowDown className="w-5 h-5 group-hover:translate-y-1 transition-transform" />
        </button>
      </div>

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}

function FlowItem({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
    pink: 'from-pink-500/20 to-pink-600/10 border-pink-500/30 text-pink-400',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400',
  };

  return (
    <div className={`flex flex-col items-center gap-3 p-6 rounded-2xl bg-gradient-to-br ${colorClasses[color]} border float-animation`}>
      <Icon className="w-8 h-8" />
      <span className="font-medium text-white">{label}</span>
    </div>
  );
}

function ArrowConnector() {
  return (
    <div className="hidden md:flex items-center">
      <div className="w-12 h-0.5 bg-gradient-to-r from-purple-500/50 to-pink-500/50" />
      <div className="w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-8 border-l-pink-500/50" />
    </div>
  );
}
