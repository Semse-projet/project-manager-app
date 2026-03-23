import { trpc } from "@/lib/trpc";
import { AIChatBox, Message } from "@/components/AIChatBox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageTransition } from "@/components/PageTransition";
import {
  Sparkles, MessageSquare, FileText, Bug, TestTube, RefreshCw, Loader2,
  Download, Copy, ClipboardCheck, Trash2, BookOpen, Code2, Shield
} from "lucide-react";
import { useState, useMemo } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

const chatPresets = [
  {
    label: "General",
    icon: Sparkles,
    color: "text-purple-400 bg-purple-500/10",
    system: "Eres un asistente de desarrollo experto. Ayudas con código, documentación, debugging, refactorización y mejores prácticas. Responde siempre en español. Usa formato Markdown.",
    prompts: ["Explica el patrón Observer", "Optimizar consultas SQL", "React hooks best practices", "REST vs GraphQL"],
  },
  {
    label: "Revisor",
    icon: Code2,
    color: "text-blue-400 bg-blue-500/10",
    system: "Eres un revisor de código senior. Analiza código buscando bugs, rendimiento, malas prácticas y vulnerabilidades. Da feedback constructivo con código mejorado. Responde en español con Markdown.",
    prompts: ["Revisa este código", "Problemas de rendimiento", "Vulnerabilidades", "Refactorizaciones"],
  },
  {
    label: "Arquitecto",
    icon: BookOpen,
    color: "text-emerald-400 bg-emerald-500/10",
    system: "Eres un arquitecto de software senior. Diseñas sistemas escalables, eliges tecnologías, defines patrones de arquitectura. Responde en español con diagramas ASCII cuando sea útil.",
    prompts: ["Arquitectura e-commerce", "Microservicios vs monolito", "CQRS y Event Sourcing", "Alta disponibilidad"],
  },
  {
    label: "Seguridad",
    icon: Shield,
    color: "text-red-400 bg-red-500/10",
    system: "Eres un experto en seguridad informática. Identificas vulnerabilidades, implementas mejores prácticas de seguridad, y proteges aplicaciones web. Responde en español con ejemplos prácticos.",
    prompts: ["Prevenir SQL injection", "JWT best practices", "Auditoría APIs REST", "CSP headers"],
  },
];

export default function AIAssistantPage() {
  const [activePreset, setActivePreset] = useState(0);
  const [messages, setMessages] = useState<Message[]>([
    { role: "system", content: chatPresets[0].system },
  ]);
  const [codeInput, setCodeInput] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("javascript");
  const [analysisResult, setAnalysisResult] = useState("");
  const [resultCopied, setResultCopied] = useState(false);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    },
    onError: () => {
      setMessages((prev) => [...prev, { role: "assistant", content: "Lo siento, hubo un error. Intenta de nuevo." }]);
    },
  });

  const commentMutation = trpc.ai.generateComments.useMutation({
    onSuccess: (data) => setAnalysisResult(data.commentedCode),
    onError: () => toast.error("Error al generar comentarios"),
  });
  const docsMutation = trpc.ai.generateDocs.useMutation({
    onSuccess: (data) => setAnalysisResult(data.documentation),
    onError: () => toast.error("Error al generar documentación"),
  });
  const analyzeMutation = trpc.ai.analyzeCode.useMutation({
    onSuccess: (data) => setAnalysisResult(data.analysis),
    onError: () => toast.error("Error en el análisis"),
  });

  const isToolLoading = commentMutation.isPending || docsMutation.isPending || analyzeMutation.isPending;

  const handleSend = (content: string) => {
    const newMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    chatMutation.mutate({ messages: newMessages });
  };

  const handlePresetChange = (index: number) => {
    setActivePreset(index);
    setMessages([{ role: "system", content: chatPresets[index].system }]);
  };

  const handleClearChat = () => {
    setMessages([{ role: "system", content: chatPresets[activePreset].system }]);
    toast.success("Conversación limpiada");
  };

  const currentPreset = chatPresets[activePreset];

  return (
    <PageTransition className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Asistente IA</h1>
          <p className="text-sm text-muted-foreground">
            Chat inteligente y herramientas de análisis de código
          </p>
        </div>
      </div>

      <Tabs defaultValue="chat" className="space-y-4">
        <TabsList className="h-9">
          <TabsTrigger value="chat" className="text-xs sm:text-sm">
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />Chat
          </TabsTrigger>
          <TabsTrigger value="tools" className="text-xs sm:text-sm">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />Herramientas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="space-y-3">
          {/* Preset Selector */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {chatPresets.map((preset, i) => {
              const Icon = preset.icon;
              const isActive = i === activePreset;
              return (
                <button
                  key={preset.label}
                  onClick={() => handlePresetChange(i)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 border ${
                    isActive
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {preset.label}
                </button>
              );
            })}
            <div className="flex-1" />
            {messages.length > 1 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={handleClearChat}>
                <Trash2 className="h-3 w-3 mr-1" />Limpiar
              </Button>
            )}
          </div>

          <AIChatBox
            messages={messages}
            onSendMessage={handleSend}
            isLoading={chatMutation.isPending}
            placeholder={`Pregunta al ${currentPreset.label}...`}
            height="calc(100vh - 20rem)"
            emptyStateMessage={`Modo: ${currentPreset.label}. Inicia una conversación.`}
            suggestedPrompts={currentPreset.prompts}
          />
        </TabsContent>

        <TabsContent value="tools">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-primary" />
                  Código Fuente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={codeLanguage} onValueChange={setCodeLanguage}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["javascript", "typescript", "python", "java", "cpp", "rust", "go", "php", "ruby", "sql"].map(l => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Pega tu código aquí..."
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  rows={10}
                  className="font-mono text-xs resize-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline" size="sm"
                    onClick={() => commentMutation.mutate({ code: codeInput, language: codeLanguage })}
                    disabled={isToolLoading || !codeInput.trim()}
                  >
                    {commentMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5 mr-1.5" />}
                    Comentarios
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => docsMutation.mutate({ code: codeInput, language: codeLanguage })}
                    disabled={isToolLoading || !codeInput.trim()}
                  >
                    {docsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
                    Documentación
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => analyzeMutation.mutate({ code: codeInput, language: codeLanguage, analysisType: "bugs" })}
                    disabled={isToolLoading || !codeInput.trim()}
                  >
                    {analyzeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Bug className="h-3.5 w-3.5 mr-1.5" />}
                    Detectar Bugs
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => analyzeMutation.mutate({ code: codeInput, language: codeLanguage, analysisType: "refactor" })}
                    disabled={isToolLoading || !codeInput.trim()}
                  >
                    {analyzeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                    Refactorizar
                  </Button>
                  <Button
                    className="col-span-2" size="sm"
                    onClick={() => analyzeMutation.mutate({ code: codeInput, language: codeLanguage, analysisType: "tests" })}
                    disabled={isToolLoading || !codeInput.trim()}
                  >
                    {analyzeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <TestTube className="h-3.5 w-3.5 mr-1.5" />}
                    Generar Tests Unitarios
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Resultado del Análisis
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isToolLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Analizando con IA...</span>
                  </div>
                ) : analysisResult ? (
                  <div>
                    <div className="flex items-center gap-1 mb-3 pb-2 border-b border-border/50">
                      <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => {
                        navigator.clipboard.writeText(analysisResult);
                        setResultCopied(true);
                        toast.success("Copiado");
                        setTimeout(() => setResultCopied(false), 2000);
                      }}>
                        {resultCopied ? <ClipboardCheck className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        {resultCopied ? "Copiado" : "Copiar"}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => {
                        const blob = new Blob([analysisResult], { type: "text/markdown" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "analisis_ia.md";
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success("Descargado");
                      }}>
                        <Download className="h-3 w-3 mr-1" />Descargar
                      </Button>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none max-h-[400px] overflow-auto text-xs">
                      <Streamdown>{analysisResult}</Streamdown>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 text-muted-foreground">
                    <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Pega código y selecciona una herramienta</p>
                    <p className="text-xs mt-1">Los resultados aparecerán aquí</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </PageTransition>
  );
}
