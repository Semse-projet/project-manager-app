"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { 
  Globe, 
  Play, 
  Terminal, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw, 
  FileText, 
  Bot, 
  Copy, 
  ImageIcon,
  ShieldAlert,
  Save,
  Code
} from "lucide-react";
import { HtmlInCanvasPanel, StatusBadge } from "@semse/ui";
import { startBrowserInspection, fetchBrowserInspectionResult, BrowserInspectionResult } from "../../../semse-api";
import { useLanguage } from "../../../../lib/language-context";

export default function BrowserAgentPage() {
  const { t } = useLanguage();
  const [url, setUrl] = useState("https://example.com");
  const [projectId, setProjectId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [includeText, setIncludeText] = useState(true);
  const [includeAiSummary, setIncludeAiSummary] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runInfo, setRunInfo] = useState<{ runId: string; status: string } | null>(null);
  const [result, setResult] = useState<BrowserInspectionResult | null>(null);
  const [activeTab, setActiveTab] = useState<"screenshot" | "logs" | "ai" | "actions">("screenshot");

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleRunInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setRunInfo(null);

    try {
      const response = await startBrowserInspection({
        url,
        projectId: projectId || undefined,
        milestoneId: milestoneId || undefined,
        includeScreenshot,
        includeText,
        includeAiSummary,
      });

      setRunInfo(response);
      
      // Start polling status
      startPolling(response.runId);
    } catch (err: any) {
      setError(err.message || "Error al iniciar la inspección");
      setLoading(false);
    }
  };

  const startPolling = (runId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const data = await fetchBrowserInspectionResult(runId);
        
        if (data.status === "completed" || data.status === "failed") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setResult(data);
          setLoading(false);
          
          if (data.success && data.aiSummary) {
            setActiveTab("ai");
          } else if (data.success) {
            setActiveTab("screenshot");
          }
        } else {
          setRunInfo({ runId: data.runId, status: data.status });
        }
      } catch (err: any) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setError(err.message || "Error al obtener el resultado de la inspección");
        setLoading(false);
      }
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("¡Copiado al portapapeles!");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header Panel */}
      <HtmlInCanvasPanel as="section" className="flex items-center justify-between mb-8 flex-wrap gap-4 p-6 bg-zinc-900 border border-zinc-800 rounded-2xl" minHeight={82}>
        <div>
          <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-xs font-semibold no-underline mb-2 transition-colors">
            <span>←</span> Dashboard
          </Link>
          <h1 className="text-2xl font-extrabold text-white mb-1 flex items-center gap-2">
            <Globe className="text-blue-500" size={24} />
            Sense Browser Agent
          </h1>
          <p className="text-sm text-zinc-400">Inspección web visual y técnica impulsada por Chromium y AI</p>
        </div>
      </HtmlInCanvasPanel>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Form & Configuration */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Play className="text-emerald-500 fill-emerald-500" size={16} />
              Iniciar Inspección
            </h2>
            
            <form onSubmit={handleRunInspection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">URL del Sitio Web</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                  <input
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">ID de Proyecto (Opcional)</label>
                  <input
                    type="text"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    placeholder="proj_..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 pr-3 pl-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">ID de Hito (Opcional)</label>
                  <input
                    type="text"
                    value={milestoneId}
                    onChange={(e) => setMilestoneId(e.target.value)}
                    placeholder="mil_..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 pr-3 pl-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4 space-y-3">
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">Opciones del Agente</label>
                
                <label className="flex items-center gap-3 cursor-pointer text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={includeScreenshot}
                    onChange={(e) => setIncludeScreenshot(e.target.checked)}
                    className="rounded border-zinc-800 text-blue-500 bg-zinc-950 focus:ring-0 focus:ring-offset-0"
                  />
                  Capturar Pantalla (Screenshot)
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={includeText}
                    onChange={(e) => setIncludeText(e.target.checked)}
                    className="rounded border-zinc-800 text-blue-500 bg-zinc-950 focus:ring-0 focus:ring-offset-0"
                  />
                  Extraer Muestra de Texto DOM
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={includeAiSummary}
                    onChange={(e) => setIncludeAiSummary(e.target.checked)}
                    className="rounded border-zinc-800 text-blue-500 bg-zinc-950 focus:ring-0 focus:ring-offset-0"
                  />
                  Análisis y Resumen Inteligente IA
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white font-bold py-2.5 px-4 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
                {loading ? "Inspeccionando..." : "Ejecutar Agente Visual"}
              </button>
            </form>
          </div>

          {/* Status Indicator Panel */}
          {(loading || runInfo || error) && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wider">Estado del Pipeline</h3>
              {error && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-red-400 text-sm">
                  <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {runInfo && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400 font-medium">ID de Ejecución:</span>
                    <span className="text-zinc-200 font-mono text-xs bg-zinc-950 px-2 py-0.5 border border-zinc-800 rounded">{runInfo.runId}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400 font-medium">Estado del Job:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                      runInfo.status === "completed" ? "bg-emerald-950 text-emerald-400" :
                      runInfo.status === "failed" ? "bg-red-950 text-red-400" : "bg-blue-950 text-blue-400"
                    }`}>{runInfo.status}</span>
                  </div>
                  {loading && (
                    <div className="flex items-center gap-2 text-zinc-400 text-xs py-2">
                      <RefreshCw className="animate-spin text-blue-500" size={14} />
                      <span>Esperando respuesta del Chromium Runner...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Visual Result / Audit Analysis Output */}
        <div className="lg:col-span-8">
          {result ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-full">
              
              {/* Top Banner metrics */}
              <div className="bg-zinc-950 border-b border-zinc-800 p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-1">Resultado General</div>
                  <div className="flex items-center gap-1.5 font-extrabold">
                    {result.pageStatus === "healthy" ? (
                      <>
                        <CheckCircle className="text-emerald-500" size={16} />
                        <span className="text-emerald-400">SALUDABLE</span>
                      </>
                    ) : result.pageStatus === "warning" ? (
                      <>
                        <AlertTriangle className="text-amber-500" size={16} />
                        <span className="text-amber-400">ADVERTENCIA</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="text-red-500" size={16} />
                        <span className="text-red-400">FALLIDO</span>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-1">Carga de Navegador</div>
                  <div className="flex items-center gap-1.5 font-extrabold text-zinc-200">
                    <Clock size={16} className="text-zinc-500" />
                    <span>{result.loadTimeMs} ms</span>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-1">Errores Consola</div>
                  <div className="flex items-center gap-1.5 font-extrabold">
                    {result.consoleErrors && result.consoleErrors.length > 0 ? (
                      <span className="text-red-400">{result.consoleErrors.length} errores</span>
                    ) : (
                      <span className="text-zinc-400">Ninguno</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-1">Peticiones Fallidas</div>
                  <div className="flex items-center gap-1.5 font-extrabold">
                    {result.networkFailures && result.networkFailures.length > 0 ? (
                      <span className="text-red-400">{result.networkFailures.length} fallos</span>
                    ) : (
                      <span className="text-zinc-400">Ninguno</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Title summary bar */}
              <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between gap-4">
                <div className="overflow-hidden">
                  <div className="text-xs font-bold text-zinc-500 uppercase">Título de la Página</div>
                  <div className="text-sm font-bold text-white truncate">{result.title || "—"}</div>
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-bold text-zinc-500 uppercase">URL Final</div>
                  <div className="text-sm font-bold text-blue-400 truncate hover:underline cursor-pointer" onClick={() => window.open(result.finalUrl, "_blank")}>{result.finalUrl}</div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex bg-zinc-950 border-b border-zinc-800">
                <button
                  onClick={() => setActiveTab("screenshot")}
                  className={`flex items-center gap-2 px-6 py-3 border-b-2 text-sm font-bold transition-all ${
                    activeTab === "screenshot" ? "border-blue-500 text-white bg-zinc-900/50" : "border-transparent text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <ImageIcon size={16} />
                  Vista Visual
                </button>
                <button
                  onClick={() => setActiveTab("logs")}
                  className={`flex items-center gap-2 px-6 py-3 border-b-2 text-sm font-bold transition-all ${
                    activeTab === "logs" ? "border-blue-500 text-white bg-zinc-900/50" : "border-transparent text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Terminal size={16} />
                  Logs Consola & Red
                </button>
                <button
                  onClick={() => setActiveTab("ai")}
                  disabled={!result.aiSummary}
                  className={`flex items-center gap-2 px-6 py-3 border-b-2 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    activeTab === "ai" ? "border-blue-500 text-white bg-zinc-900/50" : "border-transparent text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Bot size={16} />
                  Resumen de IA
                </button>
                <button
                  onClick={() => setActiveTab("actions")}
                  disabled={!result.aiSummary}
                  className={`flex items-center gap-2 px-6 py-3 border-b-2 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    activeTab === "actions" ? "border-blue-500 text-white bg-zinc-900/50" : "border-transparent text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Code size={16} />
                  Acciones Correctivas
                </button>
              </div>

              {/* Tab Contents */}
              <div className="p-6 flex-1 overflow-y-auto max-h-[600px] bg-zinc-950">
                
                {/* Visual Screenshot Tab */}
                {activeTab === "screenshot" && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white mb-2">Captura de Pantalla del Inspector</h3>
                    {result.screenshotBase64 ? (
                      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900 flex justify-center">
                        <img
                          src={`data:image/png;base64,${result.screenshotBase64}`}
                          alt="Browser Screenshot"
                          className="max-w-full h-auto object-contain"
                        />
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-zinc-900 rounded-xl border border-zinc-800 text-zinc-500 text-sm">
                        No se solicitó o no se pudo generar captura de pantalla para esta inspección.
                      </div>
                    )}

                    {result.visibleTextSample && (
                      <div className="mt-6">
                        <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                          <FileText size={15} />
                          Texto Extraído del DOM (Muestra)
                        </h4>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs font-mono text-zinc-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                          {result.visibleTextSample}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Logs Tab */}
                {activeTab === "logs" && (
                  <div className="space-y-6">
                    {/* Console Errors Section */}
                    <div>
                      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <Terminal size={16} className="text-red-400" />
                        Mensajes de Error de la Consola
                      </h3>
                      {result.consoleErrors && result.consoleErrors.length > 0 ? (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {result.consoleErrors.map((err, idx) => (
                            <div key={idx} className="bg-red-950/30 border border-red-900/40 p-3 rounded-lg text-xs">
                              <div className="font-semibold text-red-300 mb-1">{err.text}</div>
                              {err.location && (
                                <div className="text-zinc-500 font-mono">
                                  {err.location.url}:{err.location.lineNumber}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-zinc-900 rounded-lg text-center border border-zinc-800 text-zinc-400 text-sm">
                          Excelente. No se capturaron errores de consola.
                        </div>
                      )}
                    </div>

                    {/* Network Failures Section */}
                    <div>
                      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-amber-400" />
                        Peticiones HTTP Fallidas
                      </h3>
                      {result.networkFailures && result.networkFailures.length > 0 ? (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {result.networkFailures.map((fail, idx) => (
                            <div key={idx} className="bg-amber-950/20 border border-amber-900/35 p-3 rounded-lg text-xs">
                              <div className="flex items-center justify-between gap-4">
                                <span className="font-semibold text-amber-300 truncate">{fail.url}</span>
                                <span className="bg-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded uppercase text-[10px] font-bold shrink-0">{fail.method}</span>
                              </div>
                              <div className="text-zinc-400 mt-1">
                                {fail.status ? `Status: ${fail.status} ${fail.statusText || ""}` : `Error: ${fail.errorText}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-zinc-900 rounded-lg text-center border border-zinc-800 text-zinc-400 text-sm">
                          Excelente. No se detectaron peticiones fallidas (4xx/5xx).
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* AI Summary Tab */}
                {activeTab === "ai" && result.aiSummary && (
                  <div className="space-y-6">
                    {/* Spanish Summary Card */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                      <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                        <Bot className="text-blue-500" size={16} />
                        Evaluación del Agente (Español)
                      </h3>
                      <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{result.aiSummary.summary_es}</p>
                    </div>

                    {/* Recommendations Section */}
                    {result.aiSummary.recommendations && result.aiSummary.recommendations.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                          <CheckCircle className="text-emerald-500" size={15} />
                          Acciones Recomendadas
                        </h4>
                        <ul className="space-y-2 pl-5 list-disc text-sm text-zinc-300">
                          {result.aiSummary.recommendations.map((rec: string, idx: number) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Technical Summary Card */}
                    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5">
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Technical Analysis (English)</h3>
                      <p className="text-zinc-400 text-xs font-mono whitespace-pre-wrap">{result.aiSummary.summary_en}</p>
                    </div>
                  </div>
                )}

                {/* Corrective Actions Tab */}
                {activeTab === "actions" && result.aiSummary && (
                  <div className="space-y-6">
                    {/* GitHub Issue Card */}
                    {result.aiSummary.github_issue_body && (
                      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900">
                        <div className="bg-zinc-950 p-4 border-b border-zinc-800 flex justify-between items-center">
                          <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            <FileText size={16} className="text-zinc-400" />
                            GitHub Bug Report Draft
                          </h4>
                          <button
                            onClick={() => handleCopy(result.aiSummary!.github_issue_body!)}
                            className="flex items-center gap-1.5 px-3 py-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-xs font-bold rounded-lg transition-colors border border-zinc-700 cursor-pointer"
                          >
                            <Copy size={13} />
                            Copiar Reporte
                          </button>
                        </div>
                        <div className="p-4 bg-zinc-950 max-h-48 overflow-y-auto">
                          <pre className="text-xs font-mono text-zinc-400 whitespace-pre-wrap">{result.aiSummary.github_issue_body}</pre>
                        </div>
                      </div>
                    )}

                    {/* Claude Fix Prompt Card */}
                    {result.aiSummary.claude_fix_prompt && (
                      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900">
                        <div className="bg-zinc-950 p-4 border-b border-zinc-800 flex justify-between items-center">
                          <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            <Bot size={16} className="text-blue-400" />
                            Claude Fix Prompt (Instrucción de Reparación)
                          </h4>
                          <button
                            onClick={() => handleCopy(result.aiSummary!.claude_fix_prompt!)}
                            className="flex items-center gap-1.5 px-3 py-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-xs font-bold rounded-lg transition-colors border border-zinc-700 cursor-pointer"
                          >
                            <Copy size={13} />
                            Copiar Prompt
                          </button>
                        </div>
                        <div className="p-4 bg-zinc-950 max-h-48 overflow-y-auto">
                          <pre className="text-xs font-mono text-zinc-400 whitespace-pre-wrap">{result.aiSummary.claude_fix_prompt}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
              
              {/* Bottom save indicators */}
              {result.success && result.projectId && (
                <div className="bg-zinc-950 border-t border-zinc-800 px-6 py-4 flex items-center gap-2 text-xs text-emerald-400">
                  <Save size={14} />
                  <span>Resultado guardado automáticamente como documento de evidencia en el Gateway del proyecto.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 bg-zinc-900/30 rounded-2xl p-12 text-center">
              <Globe className="text-zinc-700 mb-4 animate-pulse" size={48} />
              <h3 className="text-lg font-bold text-zinc-300 mb-1">Sin Datos de Inspección</h3>
              <p className="text-sm text-zinc-500 max-w-sm">Ingrese una URL a la izquierda y presione ejecutar para ver capturas de pantalla, consola, fallos de red y reportes IA.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
