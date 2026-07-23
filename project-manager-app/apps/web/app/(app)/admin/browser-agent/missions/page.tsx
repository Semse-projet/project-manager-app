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
  Plus, 
  Trash2, 
  Eye, 
  Layers 
} from "lucide-react";
import { HtmlInCanvasPanel, StatusBadge } from "@semse/ui";
import { createBrowserMission, fetchBrowserMission, BrowserMission, BrowserMissionStep } from "../../../../semse-api";
import { AdminPageHeader } from "../../../../components/admin/AdminPageHeader";
import { useLanguage } from "../../../../../lib/language-context";

export default function BrowserMissionsPage() {
  const { t } = useLanguage();
  const [goal, setGoal] = useState("Verificar cotización en Home Depot");
  
  // Dynamic steps state
  const [steps, setSteps] = useState<Array<{ actionType: string; parameters: any; engineUsed: string }>>([
    { actionType: "navigate", parameters: { url: "https://example.com" }, engineUsed: "PLAYWRIGHT" },
    { actionType: "get_markdown", parameters: {}, engineUsed: "PLAYWRIGHT" }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMission, setActiveMission] = useState<BrowserMission | null>(null);
  const [activeTab, setActiveTab] = useState<"inspect" | "raw">("inspect");

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleAddStep = () => {
    setSteps([...steps, { actionType: "navigate", parameters: { url: "" }, engineUsed: "PLAYWRIGHT" }]);
  };

  const handleRemoveStep = (index: number) => {
    const next = [...steps];
    next.splice(index, 1);
    setSteps(next);
  };

  const handleStepChange = (index: number, field: string, value: any) => {
    const next = [...steps];
    if (field === "actionType") {
      next[index].actionType = value;
      // Setup default parameters
      if (value === "navigate") next[index].parameters = { url: "" };
      else if (value === "query" || value === "click") next[index].parameters = { selector: "" };
      else if (value === "fill") next[index].parameters = { selector: "", value: "" };
      else next[index].parameters = {};
    } else if (field === "url") {
      next[index].parameters.url = value;
    } else if (field === "selector") {
      next[index].parameters.selector = value;
    } else if (field === "value") {
      next[index].parameters.value = value;
    } else if (field === "engineUsed") {
      next[index].engineUsed = value;
    }
    setSteps(next);
  };

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal || steps.length === 0) return;

    setLoading(true);
    setError(null);
    setActiveMission(null);

    try {
      const response = await createBrowserMission({
        goal,
        steps
      });
      
      // Immediately start polling this mission
      startPolling(response.missionId);
    } catch (err: any) {
      setError(err.message || "Error al crear la misión autónoma");
      setLoading(false);
    }
  };

  const startPolling = (missionId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const data = await fetchBrowserMission(missionId);
        setActiveMission(data);
        
        if (data.status === "COMPLETED" || data.status === "FAILED") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setLoading(false);
        }
      } catch (err: any) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setError(err.message || "Error al sincronizar estado de misión");
        setLoading(false);
      }
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <AdminPageHeader
        title="Misiones Autónomas de Navegación"
        subtitle="Automatiza flujos interactivos de múltiples pasos bajo gobernanza de riesgo"
        icon={Layers}
        iconColor="#3b82f6"
        iconBg="rgba(59,130,246,.15)"
        panel={true}
        actions={
          <Link
            href="/admin/browser-agent"
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs px-4 py-2 rounded-xl transition-colors no-underline border border-zinc-700 hover:text-white"
          >
            Inspección Simple
          </Link>
        }
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Form & Configuration */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="text-emerald-500" size={18} />
              Planificar Nueva Misión
            </h2>

            <form onSubmit={handleCreateMission} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Meta / Objetivo de la Misión</label>
                <input
                  type="text"
                  required
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Ej. Verificar listado de precios"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Dynamic steps list */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">Pasos de Navegación ({steps.length})</label>
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="flex items-center gap-1 text-xs font-bold text-blue-500 hover:text-blue-400 transition-colors"
                  >
                    <Plus size={14} /> Añadir Paso
                  </button>
                </div>

                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {steps.map((step, idx) => (
                    <div key={idx} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 relative space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-extrabold text-zinc-500">PASO #{idx + 1}</span>
                        {steps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveStep(idx)}
                            className="text-zinc-500 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Acción</label>
                          <select
                            value={step.actionType}
                            onChange={(e) => handleStepChange(idx, "actionType", e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 px-2 text-xs text-zinc-200 focus:outline-none"
                          >
                            <option value="navigate">Navegar (navigate)</option>
                            <option value="get_markdown">Extraer Markdown</option>
                            <option value="query">Consultar DOM (query)</option>
                            <option value="click">Hacer Click</option>
                            <option value="fill">Rellenar Input (fill)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Motor</label>
                          <select
                            value={step.engineUsed}
                            onChange={(e) => handleStepChange(idx, "engineUsed", e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 px-2 text-xs text-zinc-200 focus:outline-none"
                          >
                            <option value="PLAYWRIGHT">Playwright</option>
                            <option value="OBSCURA">Obscura API</option>
                          </select>
                        </div>
                      </div>

                      {/* Step specific inputs */}
                      {step.actionType === "navigate" && (
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">URL de destino</label>
                          <input
                            type="url"
                            required
                            placeholder="https://..."
                            value={step.parameters.url || ""}
                            onChange={(e) => handleStepChange(idx, "url", e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 px-3 text-xs text-zinc-200 focus:outline-none"
                          />
                        </div>
                      )}

                      {(step.actionType === "query" || step.actionType === "click" || step.actionType === "fill") && (
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Selector CSS</label>
                          <input
                            type="text"
                            required
                            placeholder="input[name='search'] o button.primary"
                            value={step.parameters.selector || ""}
                            onChange={(e) => handleStepChange(idx, "selector", e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 px-3 text-xs text-zinc-200 focus:outline-none"
                          />
                        </div>
                      )}

                      {step.actionType === "fill" && (
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Valor a escribir</label>
                          <input
                            type="text"
                            required
                            placeholder="Texto a rellenar..."
                            value={step.parameters.value || ""}
                            onChange={(e) => handleStepChange(idx, "value", e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 px-3 text-xs text-zinc-200 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3.5 bg-red-950/40 border border-red-900/60 rounded-xl text-red-400 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="shrink-0 mt-0.5" size={14} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || steps.length === 0}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-zinc-800 disabled:to-zinc-800 text-white font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-blue-500/10"
              >
                {loading ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
                {loading ? "Ejecutando Misión..." : "Lanzar Misión Autónoma"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Active Mission Steps & Evidence */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 min-h-[400px]">
            {!activeMission ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-center">
                <Bot size={48} className="text-zinc-600 mb-4 animate-pulse" />
                <p className="font-bold text-sm text-zinc-400">Sin Misión Activa</p>
                <p className="text-xs text-zinc-500 max-w-xs mt-1">Configura los pasos y haz clic en &quot;Lanzar Misión Autónoma&quot; para ver el bucle de ejecución en tiempo real.</p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Mission Status Header */}
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4 flex-wrap gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">Misión ID: {activeMission.id}</span>
                    <h3 className="text-lg font-bold text-white mt-0.5">{activeMission.goal}</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    {loading && <RefreshCw className="animate-spin text-blue-500" size={14} />}
                    <StatusBadge variant={activeMission.status === "COMPLETED" ? "success" : activeMission.status === "FAILED" ? "error" : "warning"} text={activeMission.status} />
                  </div>
                </div>

                {/* Steps List */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Flujo de Pasos</h4>
                  
                  {activeMission.steps.map((step: BrowserMissionStep) => (
                    <div key={step.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-extrabold text-zinc-500">#{step.stepNumber}</span>
                          <span className="text-sm font-bold text-white capitalize">{step.actionType}</span>
                          <span className="text-[9px] font-semibold bg-zinc-900 text-zinc-400 border border-zinc-800 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {step.engineUsed}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          {step.actionType === "navigate" && `Destino: ${step.parameters?.url}`}
                          {(step.actionType === "query" || step.actionType === "click") && `Selector CSS: ${step.parameters?.selector}`}
                          {step.actionType === "fill" && `Escribir "${step.parameters?.value}" en "${step.parameters?.selector}"`}
                          {step.actionType === "get_markdown" && "Extrayendo cuerpo de página en Markdown"}
                        </p>
                        {step.error && <p className="text-xs text-red-400 mt-1 font-mono">Error: {step.error}</p>}
                        {step.evidenceRef && (
                          <div className="pt-1 flex items-center gap-1.5">
                            <Eye size={12} className="text-blue-500" />
                            <a 
                              href={step.evidenceRef} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-xs text-blue-500 hover:underline"
                            >
                              Ver evidencia (URL)
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {step.status === "PENDING" && <Clock size={16} className="text-zinc-600" />}
                        {step.status === "RUNNING" && <RefreshCw size={16} className="text-blue-500 animate-spin" />}
                        {step.status === "COMPLETED" && <CheckCircle size={16} className="text-emerald-500" />}
                        {step.status === "FAILED" && <XCircle size={16} className="text-red-500" />}
                        <span className="text-xs font-bold text-zinc-500 text-right">{step.status}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Inspect Output Area */}
                {activeMission.status === "COMPLETED" && (
                  <div className="pt-2">
                    <div className="flex border-b border-zinc-800 mb-4">
                      <button
                        onClick={() => setActiveTab("inspect")}
                        className={`pb-2 px-4 text-xs font-bold transition-all border-b-2 ${
                          activeTab === "inspect" ? "border-blue-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        Resumen de la Misión
                      </button>
                      <button
                        onClick={() => setActiveTab("raw")}
                        className={`pb-2 px-4 text-xs font-bold transition-all border-b-2 ${
                          activeTab === "raw" ? "border-blue-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        JSON de Ejecución
                      </button>
                    </div>

                    {activeTab === "inspect" ? (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-3">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle size={14} /> Misión Finalizada con Éxito
                        </h4>
                        <p className="text-xs text-zinc-300">
                          Todos los pasos planificados para la meta <strong>&quot;{activeMission.goal}&quot;</strong> fueron completados satisfactoriamente. 
                          Las cookies y la sesión del navegador se sandboxearon efímeramente y se han destruido de forma segura tras la finalización.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 font-mono text-[10px] text-zinc-400 max-h-[300px] overflow-auto">
                        <pre>{JSON.stringify(activeMission, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
