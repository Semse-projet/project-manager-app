import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/PageTransition";
import {
  ArrowLeft, Save, MessageSquare, FileText, Bug, TestTube, RefreshCw, Sparkles, Loader2,
  Download, Copy, ClipboardCheck, X, Circle, PanelRightOpen, PanelRightClose
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
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
import { motion, AnimatePresence } from "framer-motion";

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

const langColors: Record<string, string> = {
  javascript: "bg-yellow-500/20 text-yellow-400",
  typescript: "bg-blue-500/20 text-blue-400",
  python: "bg-green-500/20 text-green-400",
  html: "bg-orange-500/20 text-orange-400",
  css: "bg-purple-500/20 text-purple-400",
  rust: "bg-red-500/20 text-red-400",
  java: "bg-red-500/20 text-red-400",
  cpp: "bg-blue-500/20 text-blue-400",
  json: "bg-emerald-500/20 text-emerald-400",
  markdown: "bg-gray-500/20 text-gray-400",
  sql: "bg-cyan-500/20 text-cyan-400",
  php: "bg-indigo-500/20 text-indigo-400",
  xml: "bg-teal-500/20 text-teal-400",
};

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(true);
  const { theme } = useTheme();
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: file, isLoading } = trpc.files.get.useQuery(
    { id: fileId! },
    { enabled: !!fileId }
  );
  const { data: project } = trpc.projects.get.useQuery({ id: projectId });
  const { data: projectFiles } = trpc.files.list.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

  // Filter only code files for tabs
  const openFiles = useMemo(() => {
    if (!projectFiles) return [];
    return projectFiles.filter(f => f.type === "file").slice(0, 8);
  }, [projectFiles]);

  const updateMutation = trpc.files.update.useMutation({
    onSuccess: () => {
      toast.success("Archivo guardado");
      setHasUnsavedChanges(false);
    },
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
      setHasUnsavedChanges(false);
    }
  }, [file]);

  // Auto-save after 3 seconds of inactivity
  useEffect(() => {
    if (!hasUnsavedChanges || !fileId) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      updateMutation.mutate({ id: fileId, content: code });
    }, 3000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [code, hasUnsavedChanges, fileId]);

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
          const newCode = update.state.doc.toString();
          setCode(newCode);
          setHasUnsavedChanges(true);
        }
      }),
      EditorView.theme({
        "&": { height: "100%", fontSize: "13px" },
        ".cm-scroller": { overflow: "auto", fontFamily: "'JetBrains Mono', monospace" },
        ".cm-gutters": { borderRight: "none" },
        ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.03)" },
        ".cm-activeLineGutter": { backgroundColor: "rgba(255,255,255,0.03)" },
      }),
      EditorView.lineWrapping,
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
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
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

  const langBadge = langColors[file?.language || ""] || "bg-muted text-muted-foreground";

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <PageTransition className="space-y-0 h-[calc(100vh-6rem)]">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setLocation(`/projects/${projectId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold truncate">{file?.name || "Editor"}</h1>
              {hasUnsavedChanges && (
                <Circle className="h-2 w-2 fill-amber-400 text-amber-400 shrink-0" />
              )}
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${langBadge}`}>
                {file?.language || "text"}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{project?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="h-7 text-xs hidden sm:flex" onClick={handleDownloadCode}>
            <Download className="h-3.5 w-3.5 mr-1" />Descargar
          </Button>
          <Button
            variant="ghost" size="sm" className="h-7 text-xs"
            onClick={() => setShowAiPanel(!showAiPanel)}
          >
            {showAiPanel ? <PanelRightClose className="h-3.5 w-3.5 mr-1" /> : <PanelRightOpen className="h-3.5 w-3.5 mr-1" />}
            <span className="hidden sm:inline">IA</span>
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">{updateMutation.isPending ? "Guardando..." : "Guardar"}</span>
          </Button>
        </div>
      </div>

      {/* File Tabs */}
      {openFiles.length > 1 && (
        <div className="flex items-center gap-0.5 border-b border-border/30 mb-0 overflow-x-auto pb-0 scrollbar-none">
          {openFiles.map((f) => {
            const isActive = f.id === fileId;
            return (
              <button
                key={f.id}
                onClick={() => setLocation(`/editor/${projectId}/${f.id}`)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? "border-primary text-foreground bg-muted/30"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20"
                }`}
              >
                <span className="truncate max-w-[120px]">{f.name}</span>
                {isActive && hasUnsavedChanges && (
                  <Circle className="h-1.5 w-1.5 fill-amber-400 text-amber-400" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content */}
      <div className={`grid gap-0 h-[calc(100%-${openFiles.length > 1 ? "6rem" : "3.5rem"})] ${showAiPanel ? "grid-cols-1 lg:grid-cols-[1fr_340px]" : "grid-cols-1"}`}>
        {/* Code Editor */}
        <div className="border border-border/50 rounded-lg overflow-hidden bg-card min-h-0">
          <div ref={editorRef} className="h-full" />
        </div>

        {/* AI Panel */}
        <AnimatePresence>
          {showAiPanel && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="border border-border/50 rounded-lg bg-card flex flex-col overflow-hidden min-h-0"
            >
              <Tabs value={aiTab} onValueChange={setAiTab} className="flex flex-col h-full">
                <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-1.5 pt-1.5 h-auto flex-wrap gap-0.5">
                  <TabsTrigger value="comments" className="text-[11px] h-7 px-2">
                    <MessageSquare className="h-3 w-3 mr-1" />Comentarios
                  </TabsTrigger>
                  <TabsTrigger value="docs" className="text-[11px] h-7 px-2">
                    <FileText className="h-3 w-3 mr-1" />Docs
                  </TabsTrigger>
                  <TabsTrigger value="analyze" className="text-[11px] h-7 px-2">
                    <Bug className="h-3 w-3 mr-1" />Análisis
                  </TabsTrigger>
                  <TabsTrigger value="result" className="text-[11px] h-7 px-2">
                    <Sparkles className="h-3 w-3 mr-1" />Resultado
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="comments" className="flex-1 p-3 space-y-3 overflow-auto">
                  <p className="text-xs text-muted-foreground">
                    Genera comentarios inteligentes para tu código usando IA generativa. La IA analiza cada función y genera documentación descriptiva.
                  </p>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => commentMutation.mutate({ code: getCurrentCode(), language: file?.language || undefined })}
                    disabled={isAiLoading || !getCurrentCode().trim()}
                  >
                    {commentMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                    Generar Comentarios
                  </Button>
                </TabsContent>

                <TabsContent value="docs" className="flex-1 p-3 space-y-3 overflow-auto">
                  <p className="text-xs text-muted-foreground">
                    Genera documentación Markdown automática. Convierte tu código en documentación estructurada con descripciones, parámetros y ejemplos.
                  </p>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => docsMutation.mutate({ code: getCurrentCode(), language: file?.language || undefined, projectName: project?.name })}
                    disabled={isAiLoading || !getCurrentCode().trim()}
                  >
                    {docsMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                    Generar Documentación
                  </Button>
                </TabsContent>

                <TabsContent value="analyze" className="flex-1 p-3 space-y-2 overflow-auto">
                  <p className="text-xs text-muted-foreground mb-2">
                    Análisis avanzado de código con IA.
                  </p>
                  {[
                    { type: "refactor", icon: RefreshCw, label: "Refactorización", desc: "Sugerencias para mejorar" },
                    { type: "bugs", icon: Bug, label: "Detección de Bugs", desc: "Encuentra problemas potenciales" },
                    { type: "tests", icon: TestTube, label: "Generar Tests", desc: "Tests unitarios automáticos" },
                    { type: "general", icon: Sparkles, label: "Revisión General", desc: "Análisis completo del código" },
                  ].map((item) => (
                    <Button
                      key={item.type}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start h-auto py-2"
                      onClick={() => analyzeMutation.mutate({ code: getCurrentCode(), language: file?.language || undefined, analysisType: item.type as "refactor" | "bugs" | "tests" | "general" })}
                      disabled={isAiLoading}
                    >
                      <item.icon className="h-3.5 w-3.5 mr-2 shrink-0" />
                      <div className="text-left">
                        <p className="text-xs font-medium">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                      </div>
                    </Button>
                  ))}
                </TabsContent>

                <TabsContent value="result" className="flex-1 p-3 overflow-auto">
                  {isAiLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Analizando con IA...</span>
                    </div>
                  ) : aiResult ? (
                    <div>
                      <div className="flex items-center gap-1 mb-3 pb-2 border-b border-border/50">
                        <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={handleCopyResult}>
                          {copied ? <ClipboardCheck className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                          {copied ? "Copiado" : "Copiar"}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={handleDownloadResult}>
                          <Download className="h-3 w-3 mr-1" />Descargar
                        </Button>
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                        <Streamdown>{aiResult}</Streamdown>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Ejecuta una acción de IA para ver resultados</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-2 py-1 border-t border-border/30 mt-1">
        <div className="flex items-center gap-3">
          <span>{file?.language || "text"}</span>
          <span>UTF-8</span>
          <span>Ln {viewRef.current?.state.doc.lines || 0}</span>
        </div>
        <div className="flex items-center gap-3">
          {hasUnsavedChanges ? (
            <span className="text-amber-400">Sin guardar</span>
          ) : (
            <span className="text-emerald-400">Guardado</span>
          )}
          <span>Auto-guardado: ON</span>
        </div>
      </div>
    </PageTransition>
  );
}
