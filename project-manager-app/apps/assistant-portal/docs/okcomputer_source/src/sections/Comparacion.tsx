import { useEffect, useRef, useState } from 'react';
import { XCircle, CheckCircle2, ArrowRight, Code2 } from 'lucide-react';

const antesCode = `# ANTES: Problemas
# ❌ Re-vectoriza en cada interacción
# ❌ Memoria no persiste
# ❌ API key en UI
# ❌ Archivo temporal fijo

def process_pdf():
    # Esto se ejecuta en CADA rerun
    loader = PyPDFLoader("temp.pdf")
    docs = loader.load()
    chunks = splitter.split_documents(docs)
    
    # Recrea embeddings cada vez
    embeddings = OpenAIEmbeddings()
    vector_db = Chroma.from_documents(chunks, embeddings)
    
    return vector_db

# Cada pregunta = reprocesar todo`;

const despuesCode = `# DESPUÉS: Soluciones
# ✅ Cachear procesamiento
# ✅ Memoria persistente
# ✅ Hash único por archivo

@st.cache_data
def save_temp_pdf(file_bytes, name):
    digest = hashlib.sha256(file_bytes).hexdigest()[:12]
    # Nombre único por archivo
    return f"temp_{name}_{digest}.pdf"

@st.cache_resource
def build_vectorstore(chunks, api_key):
    # Solo se ejecuta UNA vez
    embeddings = OpenAIEmbeddings()
    return Chroma.from_documents(chunks, embeddings)

# El chain se guarda en session_state
if "qa_chain" not in st.session_state:
    st.session_state.qa_chain = build_qa_chain(vector_db)`;

export function Comparacion() {
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
    <section id="comparacion" ref={sectionRef} className="relative py-24 px-6">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-purple-950/5 to-background" />
      
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 mb-6">
            <Code2 className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300 font-medium">Comparación de Código</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Antes vs <span className="text-purple-400">Después</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Veamos la diferencia entre el código problemático y la versión optimizada.
          </p>
        </div>

        {/* Comparison Cards */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          {/* Before Card */}
          <div className="rounded-2xl overflow-hidden border border-red-500/30 glow-red">
            <div className="bg-red-500/10 px-6 py-4 border-b border-red-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <XCircle className="w-5 h-5 text-red-400" />
                <span className="font-semibold text-red-300">Antes (Problemático)</span>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-300">Lento</span>
            </div>
            <div className="p-6 bg-red-950/5">
              <pre className="text-sm font-mono text-red-200/80 overflow-x-auto">
                <code>{antesCode}</code>
              </pre>
            </div>
            <div className="px-6 py-4 bg-red-500/5 border-t border-red-500/20">
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-red-300/80">
                  <XCircle className="w-4 h-4" />
                  Reprocesa todo en cada pregunta
                </li>
                <li className="flex items-center gap-2 text-sm text-red-300/80">
                  <XCircle className="w-4 h-4" />
                  Pierde memoria entre reruns
                </li>
                <li className="flex items-center gap-2 text-sm text-red-300/80">
                  <XCircle className="w-4 h-4" />
                  Nombre de archivo fijo
                </li>
              </ul>
            </div>
          </div>

          {/* Arrow for desktop */}
          <div className="hidden lg:flex items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/50">
              <ArrowRight className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* After Card */}
          <div className="rounded-2xl overflow-hidden border border-green-500/30 glow-green">
            <div className="bg-green-500/10 px-6 py-4 border-b border-green-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="font-semibold text-green-300">Después (Optimizado)</span>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-300">Rápido</span>
            </div>
            <div className="p-6 bg-green-950/5">
              <pre className="text-sm font-mono text-green-200/80 overflow-x-auto">
                <code>{despuesCode}</code>
              </pre>
            </div>
            <div className="px-6 py-4 bg-green-500/5 border-t border-green-500/20">
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-green-300/80">
                  <CheckCircle2 className="w-4 h-4" />
                  Cachea resultados pesados
                </li>
                <li className="flex items-center gap-2 text-sm text-green-300/80">
                  <CheckCircle2 className="w-4 h-4" />
                  Preserva memoria en session_state
                </li>
                <li className="flex items-center gap-2 text-sm text-green-300/80">
                  <CheckCircle2 className="w-4 h-4" />
                  Hash único por archivo
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Key Differences */}
        <div className={`mt-12 transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h3 className="text-2xl font-bold text-white mb-6 text-center">Diferencias Clave</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DifferenceCard
              title="Decoradores @st.cache"
              description="Usar @st.cache_data para datos y @st.cache_resource para objetos pesados como embeddings."
              color="purple"
            />
            <DifferenceCard
              title="Session State"
              description="Guardar el chain en st.session_state para mantener la memoria conversacional entre reruns."
              color="blue"
            />
            <DifferenceCard
              title="Hash de Archivo"
              description="Usar SHA256 para generar nombres únicos y detectar cambios de documento."
              color="pink"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function DifferenceCard({ title, description, color }: { title: string; description: string; color: string }) {
  const colorClasses: Record<string, string> = {
    purple: 'from-purple-500/10 to-purple-600/5 border-purple-500/30',
    blue: 'from-blue-500/10 to-blue-600/5 border-blue-500/30',
    pink: 'from-pink-500/10 to-pink-600/5 border-pink-500/30',
  };

  return (
    <div className={`p-6 rounded-2xl bg-gradient-to-br ${colorClasses[color]} border`}>
      <h4 className="text-lg font-semibold text-white mb-2">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
