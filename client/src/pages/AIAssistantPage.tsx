import { trpc } from "@/lib/trpc";
import { AIChatBox, Message } from "@/components/AIChatBox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, MessageSquare, FileText, Bug, TestTube, RefreshCw, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { Streamdown } from "streamdown";

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: "Eres un asistente de desarrollo experto. Ayudas con código, documentación, debugging, refactorización y mejores prácticas. Responde siempre en español. Usa formato Markdown para tus respuestas.",
    },
  ]);
  const [codeInput, setCodeInput] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("javascript");
  const [analysisResult, setAnalysisResult] = useState("");

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Lo siento, hubo un error al procesar tu mensaje. Intenta de nuevo." },
      ]);
    },
  });

  const commentMutation = trpc.ai.generateComments.useMutation({
    onSuccess: (data) => setAnalysisResult(data.commentedCode),
  });
  const docsMutation = trpc.ai.generateDocs.useMutation({
    onSuccess: (data) => setAnalysisResult(data.documentation),
  });
  const analyzeMutation = trpc.ai.analyzeCode.useMutation({
    onSuccess: (data) => setAnalysisResult(data.analysis),
  });

  const isToolLoading = commentMutation.isPending || docsMutation.isPending || analyzeMutation.isPending;

  const handleSend = (content: string) => {
    const newMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    chatMutation.mutate({ messages: newMessages });
  };

  const suggestedPrompts = useMemo(
    () => [
      "Explica el patrón de diseño Observer",
      "Cómo optimizar consultas SQL",
      "Mejores prácticas para React hooks",
      "Diferencias entre REST y GraphQL",
    ],
    []
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Asistente IA</h1>
        <p className="text-muted-foreground mt-1">
          Chat inteligente y herramientas de análisis de código con IA generativa
        </p>
      </div>

      <Tabs defaultValue="chat" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chat">
            <MessageSquare className="h-4 w-4 mr-2" />Chat
          </TabsTrigger>
          <TabsTrigger value="tools">
            <Sparkles className="h-4 w-4 mr-2" />Herramientas de Código
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <AIChatBox
            messages={messages}
            onSendMessage={handleSend}
            isLoading={chatMutation.isPending}
            placeholder="Pregunta sobre código, arquitectura, mejores prácticas..."
            height="calc(100vh - 16rem)"
            emptyStateMessage="Inicia una conversación con el asistente de IA"
            suggestedPrompts={suggestedPrompts}
          />
        </TabsContent>

        <TabsContent value="tools">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Código Fuente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={codeLanguage} onValueChange={setCodeLanguage}>
                  <SelectTrigger>
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
                  rows={12}
                  className="font-mono text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => commentMutation.mutate({ code: codeInput, language: codeLanguage })}
                    disabled={isToolLoading || !codeInput.trim()}
                  >
                    {commentMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                    Comentarios
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => docsMutation.mutate({ code: codeInput, language: codeLanguage })}
                    disabled={isToolLoading || !codeInput.trim()}
                  >
                    {docsMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                    Documentación
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => analyzeMutation.mutate({ code: codeInput, language: codeLanguage, analysisType: "bugs" })}
                    disabled={isToolLoading || !codeInput.trim()}
                  >
                    {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bug className="h-4 w-4 mr-2" />}
                    Detectar Bugs
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => analyzeMutation.mutate({ code: codeInput, language: codeLanguage, analysisType: "refactor" })}
                    disabled={isToolLoading || !codeInput.trim()}
                  >
                    {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Refactorizar
                  </Button>
                  <Button
                    className="col-span-2"
                    onClick={() => analyzeMutation.mutate({ code: codeInput, language: codeLanguage, analysisType: "tests" })}
                    disabled={isToolLoading || !codeInput.trim()}
                  >
                    {analyzeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
                    Generar Tests Unitarios
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resultado del Análisis</CardTitle>
              </CardHeader>
              <CardContent>
                {isToolLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">Analizando con IA...</span>
                  </div>
                ) : analysisResult ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none max-h-[500px] overflow-auto">
                    <Streamdown>{analysisResult}</Streamdown>
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
    </div>
  );
}
