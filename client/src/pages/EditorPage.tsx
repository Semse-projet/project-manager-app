import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Save, MessageSquare, FileText, Bug, TestTube, RefreshCw, Sparkles, Loader2,
  Download, Copy, ClipboardCheck
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { php } from "@codemirror/lang-php";
import { useTheme } from "@/contexts/ThemeContext";
import { Streamdown } from "streamdown";

function getLanguageExtension(lang: string) {
  const map: Record<string, () => any> = {
    javascript: () => javascript({ jsx: true, typescript: false }),
    typescript: () => javascript({ jsx: true, typescript: true }),
    python: () => python(),
    html: () => html(),
    css: () => css(),
    json: () => json(),
    markdown: () => markdown(),
    java: () => java(),
    cpp: () => cpp(),
    rust: () => rust(),
    sql: () => sql(),
    xml: () => xml(),
    php: () => php(),
  };
  return map[lang]?.() ?? javascript();
}

export default function EditorPage() {
  const params = useParams<{ projectId: string; fileId?: string }>();
  const projectId = parseInt(params.projectId || "0");
  const fileId = params.fileId ? parseInt(params.fileId) : undefined;
  const [, setLocation] = useLocation();
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [code, setCode] = useState("");
  const [aiTab, setAiTab] = useState("comments");
  const [aiResult, setAiResult] = useState("");
  const { theme } = useTheme();

  const { data: file, isLoading } = trpc.files.get.useQuery(
    { id: fileId! },
    { enabled: !!fileId }
  );
  const { data: project } = trpc.projects.get.useQuery({ id: projectId });

  const updateMutation = trpc.files.update.useMutation({
    onSuccess: () => toast.success("Archivo guardado"),
  });

  const commentMutation = trpc.ai.generateComments.useMutation({
    onSuccess: (data) => { setAiResult(data.commentedCode); setAiTab("result"); },
    onError: () => toast.error("Error al generar comentarios"),
  });

  const docsMutation = trpc.ai.generateDocs.useMutation({
    onSuccess: (data) => { setAiResult(data.documentation); setAiTab("result"); },
    onError: () => toast.error("Error al generar documentación"),
  });

  const analyzeMutation = trpc.ai.analyzeCode.useMutation({
    onSuccess: (data) => { setAiResult(data.analysis); setAiTab("result"); },
    onError: () => toast.error("Error en el análisis"),
  });

  const isAiLoading = commentMutation.isPending || docsMutation.isPending || analyzeMutation.isPending;

  useEffect(() => {
    if (file?.content !== undefined && file?.content !== null) {
      setCode(file.content);
    }
  }, [file]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const langExt = getLanguageExtension(file?.language || "javascript");
    const extensions = [
      basicSetup,
      langExt,
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged) {
          setCode(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        "&": { height: "100%", fontSize: "14px" },
        ".cm-scroller": { overflow: "auto", fontFamily: "'JetBrains Mono', monospace" },
        ".cm-gutters": { borderRight: "none" },
      }),
    ];
    if (theme === "dark") extensions.push(oneDark);

    const state = EditorState.create({
      doc: code || "",
      extensions,
    });

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [file?.language, theme]);

  const handleSave = useCallback(() => {
    if (!fileId) return;
    updateMutation.mutate({ id: fileId, content: code });
  }, [fileId, code, updateMutation]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  const [copied, setCopied] = useState(false);

  const getCurrentCode = () => viewRef.current?.state.doc.toString() || code;

  const handleCopyResult = () => {
    navigator.clipboard.writeText(aiResult);
    setCopied(true);
    toast.success("Copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadResult = () => {
    const isMarkdown = aiResult.includes("#") || aiResult.includes("```");
    const ext = isMarkdown ? "md" : "txt";
    const mimeType = isMarkdown ? "text/markdown" : "text/plain";
    const blob = new Blob([aiResult], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file?.name || "documento"}_ai.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Archivo descargado");
  };

  const handleDownloadCode = () => {
    const content = getCurrentCode();
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file?.name || "code.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Código descargado");
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-[600px] w-full" /></div>;

  return (
    <div className="space-y-4 h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/projects/${projectId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{file?.name || "Editor"}</h1>
            <p className="text-xs text-muted-foreground">{project?.name} / {file?.language || "text"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleDownloadCode}>
            <Download className="h-4 w-4 mr-1" />Descargar
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="h-4 w-4 mr-1" />
            {updateMutation.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100%-4rem)]">
        {/* Code Editor */}
        <div className="lg:col-span-2 border rounded-lg overflow-hidden bg-card">
          <div ref={editorRef} className="h-full" />
        </div>

        {/* AI Panel */}
        <div className="border rounded-lg bg-card flex flex-col overflow-hidden">
          <Tabs value={aiTab} onValueChange={setAiTab} className="flex flex-col h-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-2 pt-2">
              <TabsTrigger value="comments" className="text-xs"><MessageSquare className="h-3 w-3 mr-1" />Comentarios</TabsTrigger>
              <TabsTrigger value="docs" className="text-xs"><FileText className="h-3 w-3 mr-1" />Docs</TabsTrigger>
              <TabsTrigger value="analyze" className="text-xs"><Bug className="h-3 w-3 mr-1" />Análisis</TabsTrigger>
              <TabsTrigger value="result" className="text-xs"><Sparkles className="h-3 w-3 mr-1" />Resultado</TabsTrigger>
            </TabsList>

            <TabsContent value="comments" className="flex-1 p-4 space-y-3 overflow-auto">
              <p className="text-sm text-muted-foreground">
                Genera comentarios inteligentes para tu código usando IA generativa.
              </p>
              <Button
                className="w-full"
                onClick={() => commentMutation.mutate({ code: getCurrentCode(), language: file?.language || undefined })}
                disabled={isAiLoading || !getCurrentCode().trim()}
              >
                {commentMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                Generar Comentarios
              </Button>
            </TabsContent>

            <TabsContent value="docs" className="flex-1 p-4 space-y-3 overflow-auto">
              <p className="text-sm text-muted-foreground">
                Genera documentación Markdown automática a partir de tu código.
              </p>
              <Button
                className="w-full"
                onClick={() => docsMutation.mutate({ code: getCurrentCode(), language: file?.language || undefined, projectName: project?.name })}
                disabled={isAiLoading || !getCurrentCode().trim()}
              >
                {docsMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                Generar Documentación
              </Button>
            </TabsContent>

            <TabsContent value="analyze" className="flex-1 p-4 space-y-3 overflow-auto">
              <p className="text-sm text-muted-foreground">
                Análisis avanzado de código con IA.
              </p>
              <div className="space-y-2">
                <Button
                  variant="outline" className="w-full justify-start"
                  onClick={() => analyzeMutation.mutate({ code: getCurrentCode(), language: file?.language || undefined, analysisType: "refactor" })}
                  disabled={isAiLoading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />Sugerencias de Refactorización
                </Button>
                <Button
                  variant="outline" className="w-full justify-start"
                  onClick={() => analyzeMutation.mutate({ code: getCurrentCode(), language: file?.language || undefined, analysisType: "bugs" })}
                  disabled={isAiLoading}
                >
                  <Bug className="h-4 w-4 mr-2" />Detección de Bugs
                </Button>
                <Button
                  variant="outline" className="w-full justify-start"
                  onClick={() => analyzeMutation.mutate({ code: getCurrentCode(), language: file?.language || undefined, analysisType: "tests" })}
                  disabled={isAiLoading}
                >
                  <TestTube className="h-4 w-4 mr-2" />Generar Tests
                </Button>
                <Button
                  variant="outline" className="w-full justify-start"
                  onClick={() => analyzeMutation.mutate({ code: getCurrentCode(), language: file?.language || undefined, analysisType: "general" })}
                  disabled={isAiLoading}
                >
                  <Sparkles className="h-4 w-4 mr-2" />Revisión General
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="result" className="flex-1 p-4 overflow-auto">
              {isAiLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Analizando con IA...</span>
                </div>
              ) : aiResult ? (
                <div>
                  <div className="flex items-center gap-1 mb-3 pb-2 border-b border-border/50">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCopyResult}>
                      {copied ? <ClipboardCheck className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      {copied ? "Copiado" : "Copiar"}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleDownloadResult}>
                      <Download className="h-3 w-3 mr-1" />Descargar
                    </Button>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <Streamdown>{aiResult}</Streamdown>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Ejecuta una acción de IA para ver resultados</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
