import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Cpu, 
  Database, 
  Zap, 
  Brain, 
  Hash,
  Layers,
  Activity,
  Terminal,
  LayoutDashboard,
  ArrowRight
} from 'lucide-react';
import { CacheSimulator } from './components/CacheSimulator';
import { RAGVisualizer } from './components/RAGVisualizer';
import { PerformanceComparer } from './components/PerformanceComparer';
import { SessionStateDemo } from './components/SessionStateDemo';
import { HashGenerator } from './components/HashGenerator';
import { CodePlayground } from './components/CodePlayground';
import { SEMSEOS } from './semse';

function App() {
  const [activeTab, setActiveTab] = useState('cache');
  const [showSemseOS, setShowSemseOS] = useState(false);

  // Si el usuario quiere ver SEMSE OS, mostramos ese sistema
  if (showSemseOS) {
    return <SEMSEOS />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20 animate-pulse-glow">
                <Brain className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">RAG Architect Tools</h1>
                <p className="text-xs text-muted-foreground">Herramientas para construir chats semánticos eficientes</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowSemseOS(true)}
                className="flex items-center gap-2"
              >
                <LayoutDashboard className="w-4 h-4" />
                SEMSE OS Dashboard
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/30">
                v2.0 Interactive
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Intro Card */}
        <Card className="mb-8 border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-purple-500/20">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white mb-2">
                  Laboratorio de Optimización RAG
                </h2>
                <p className="text-muted-foreground text-sm mb-4">
                  Esta aplicación contiene herramientas interactivas que demuestran cómo resolver 
                  los problemas comunes de arquitectura RAG. Cada herramienta simula el comportamiento 
                  de las soluciones en tiempo real.
                </p>
                <div className="flex items-center gap-3">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => setShowSemseOS(true)}
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Explorar SEMSE OS
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Sistema completo con agentes AI, gestión de proyectos y más
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tools Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <TabsTrigger value="cache" className="flex flex-col items-center gap-1 py-3">
              <Database className="w-4 h-4" />
              <span className="text-xs">Caché</span>
            </TabsTrigger>
            <TabsTrigger value="rag" className="flex flex-col items-center gap-1 py-3">
              <Layers className="w-4 h-4" />
              <span className="text-xs">Flujo RAG</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex flex-col items-center gap-1 py-3">
              <Activity className="w-4 h-4" />
              <span className="text-xs">Rendimiento</span>
            </TabsTrigger>
            <TabsTrigger value="session" className="flex flex-col items-center gap-1 py-3">
              <Cpu className="w-4 h-4" />
              <span className="text-xs">Session State</span>
            </TabsTrigger>
            <TabsTrigger value="hash" className="flex flex-col items-center gap-1 py-3">
              <Hash className="w-4 h-4" />
              <span className="text-xs">Hash</span>
            </TabsTrigger>
            <TabsTrigger value="playground" className="flex flex-col items-center gap-1 py-3">
              <Terminal className="w-4 h-4" />
              <span className="text-xs">Código</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cache" className="space-y-4">
            <CacheSimulator />
          </TabsContent>

          <TabsContent value="rag" className="space-y-4">
            <RAGVisualizer />
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <PerformanceComparer />
          </TabsContent>

          <TabsContent value="session" className="space-y-4">
            <SessionStateDemo />
          </TabsContent>

          <TabsContent value="hash" className="space-y-4">
            <HashGenerator />
          </TabsContent>

          <TabsContent value="playground" className="space-y-4">
            <CodePlayground />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Basado en las mejores prácticas de LangChain y Streamlit
            </p>
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-xs">
                @st.cache_data
              </Badge>
              <Badge variant="secondary" className="text-xs">
                @st.cache_resource
              </Badge>
              <Badge variant="secondary" className="text-xs">
                st.session_state
              </Badge>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
