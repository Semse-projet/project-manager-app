"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Bot, Copy, GitBranch, Link as LinkIcon, Play, RefreshCw, SkipForward, TerminalSquare } from "lucide-react";
import { HtmlInCanvasPanel, useHtmlInCanvasSupport } from "@semse/ui";
import {
  continueAutonomyRun,
  createAutonomyRun,
  fetchAutonomyProviderStatus,
  fetchAutonomyRun,
  fetchAutonomyRuns,
  semseRuntimeEnabled,
  type AutonomyLlmStatusView,
  type AutonomyRunView
} from "../../../semse-api";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

type AutonomyStageKey = "branch" | "change" | "commit" | "push" | "pr";
type StageState = "idle" | "pending" | "active" | "done" | "failed";
type TimelineEntry = {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  accent: string;
};

const AUTONOMY_STAGES: Array<{
  key: AutonomyStageKey;
  label: string;
  logMessage: string;
  hint: string;
}> = [
  {
    key: "branch",
    label: "Branch",
    logMessage: "branch_created",
    hint: "Abre el workstream y fija una rama trazable antes de tocar contenido."
  },
  {
    key: "change",
    label: "Change",
    logMessage: "change_applied",
    hint: "Aplica el cambio concreto y deja evidencia del archivo intervenido."
  },
  {
    key: "commit",
    label: "Commit",
    logMessage: "commit_created",
    hint: "Cierra una unidad coherente de cambio con SHA verificable."
  },
  {
    key: "push",
    label: "Push",
    logMessage: "branch_pushed",
    hint: "Publica la rama para que el flujo salga del sandbox local."
  },
  {
    key: "pr",
    label: "PR",
    logMessage: "pr_created",
    hint: "Abre la PR o el marcador local equivalente para revision final."
  }
];

const INFOCLAUDE_CONTEXT = [
  "Harness formal por superficie: el run debe leerse como arnes operativo, no solo como prompt suelto.",
  "Context assembly explicito: branch, archivo y output tienen que verse como contexto armado, no como magia opaca.",
  "Telemetry-first: cada etapa deja rastro auditable en logs y debe poder inspeccionarse paso a paso."
];

const SMOKE_STAGES: AutonomyStageKey[] = ["change", "commit", "push", "pr"];

function formatTimestamp(value?: string) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function tone(status: string) {
  if (status === "COMPLETED") return { color: "#34d399", bg: "rgba(16,185,129,0.12)" };
  if (status === "FAILED") return { color: "#f87171", bg: "rgba(239,68,68,0.12)" };
  return { color: "#60a5fa", bg: "rgba(59,130,246,0.12)" };
}

function isStageKey(value: unknown): value is AutonomyStageKey {
  return AUTONOMY_STAGES.some((stage) => stage.key === value);
}

function getLatestLogData(run: AutonomyRunView | null, message: string): Record<string, unknown> | null {
  if (!run) return null;
  for (let index = run.logs.length - 1; index >= 0; index -= 1) {
    const entry = run.logs[index];
    if (entry.message === message && entry.data && typeof entry.data === "object") {
      return entry.data;
    }
  }
  return null;
}

function resolveCompletedStageCount(run: AutonomyRunView | null) {
  if (!run) return 0;
  return run.completedStageCount;
}

function resolveCurrentStage(run: AutonomyRunView | null): AutonomyStageKey | null {
  if (!run) return null;
  if (run.currentStage) return run.currentStage;
  let current: AutonomyStageKey | null = null;
  for (const stage of AUTONOMY_STAGES) {
    if (run.logs.some((entry) => entry.message === stage.logMessage)) {
      current = stage.key;
    }
  }
  return current;
}

function resolveTargetStage(run: AutonomyRunView | null): AutonomyStageKey | null {
  if (run?.targetStage) return run.targetStage;
  const reachedStage = getLatestLogData(run, "target_stage_reached")?.targetStage;
  if (isStageKey(reachedStage)) return reachedStage;

  const requestedStage = getLatestLogData(run, "run_target_stage")?.targetStage;
  if (isStageKey(requestedStage)) return requestedStage;

  return null;
}

function resolveNextStage(run: AutonomyRunView | null): AutonomyStageKey | null {
  if (run?.nextStage !== undefined) return run.nextStage;
  const current = resolveCurrentStage(run);
  if (!current) return "branch";
  const index = AUTONOMY_STAGES.findIndex((stage) => stage.key === current);
  if (index < 0 || index === AUTONOMY_STAGES.length - 1) return null;
  return AUTONOMY_STAGES[index + 1]?.key ?? null;
}

function resolveStageState(run: AutonomyRunView | null, stageKey: AutonomyStageKey): StageState {
  if (!run) return "idle";
  const stageIndex = AUTONOMY_STAGES.findIndex((stage) => stage.key === stageKey);
  const stage = AUTONOMY_STAGES[stageIndex];
  const completedCount = resolveCompletedStageCount(run);
  const hasStageLog = stage ? run.logs.some((entry) => entry.message === stage.logMessage) : false;

  if (hasStageLog) return "done";
  if (run.status === "FAILED" && completedCount === stageIndex) return "failed";
  if (run.status === "RUNNING" && completedCount === stageIndex) return "active";
  return "pending";
}

function stageTone(state: StageState, active: boolean) {
  if (state === "done") {
    return {
      color: "#34d399",
      background: active ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.12)",
      border: "rgba(16,185,129,0.28)"
    };
  }
  if (state === "failed") {
    return {
      color: "#f87171",
      background: active ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.12)",
      border: "rgba(239,68,68,0.3)"
    };
  }
  if (state === "active") {
    return {
      color: "#60a5fa",
      background: active ? "rgba(59,130,246,0.22)" : "rgba(59,130,246,0.12)",
      border: "rgba(96,165,250,0.28)"
    };
  }
  return {
    color: active ? "var(--ink)" : "var(--muted)",
    background: active ? "rgba(148,163,184,0.16)" : "var(--panel)",
    border: "var(--border)"
  };
}

function stageLabel(stage: AutonomyStageKey | null) {
  if (!stage) return "n/a";
  return AUTONOMY_STAGES.find((entry) => entry.key === stage)?.label ?? stage;
}

function stageStatusLabel(state: StageState) {
  if (state === "done") return "completado";
  if (state === "failed") return "fallo aqui";
  if (state === "active") return "en ejecucion";
  if (state === "pending") return "pendiente";
  return "sin datos";
}

function progressLabel(run: AutonomyRunView | null) {
  if (!run) return "sin run";
  const current = resolveCurrentStage(run);
  const target = resolveTargetStage(run);
  const next = resolveNextStage(run);
  return `actual: ${stageLabel(current)} · target: ${stageLabel(target)} · siguiente: ${stageLabel(next)}`;
}

function badgeStyle(color: string, background: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: 800,
    color,
    background
  };
}

function summarizeLogData(data?: Record<string, unknown>): string {
  if (!data) return "sin contexto";

  const targetStage = data.targetStage;
  if (isStageKey(targetStage)) {
    return `etapa ${stageLabel(targetStage)}`;
  }

  const branchName = data.branchName;
  if (typeof branchName === "string" && branchName) {
    return branchName;
  }

  const prUrl = data.prUrl;
  if (typeof prUrl === "string" && prUrl) {
    return prUrl;
  }

  const commitSha = data.commitSha;
  if (typeof commitSha === "string" && commitSha) {
    return commitSha.slice(0, 12);
  }

  const generatedFile = data.generatedFile;
  if (typeof generatedFile === "string" && generatedFile) {
    return generatedFile;
  }

  const summary = data.summary;
  if (typeof summary === "string" && summary) {
    return summary;
  }

  return "telemetria registrada";
}

function buildTimeline(run: AutonomyRunView | null): TimelineEntry[] {
  if (!run) return [];

  return [...run.logs]
    .filter((entry) =>
      [
        "run_continued",
        "run_target_stage",
        "target_stage_reached",
        "branch_created",
        "change_applied",
        "commit_created",
        "branch_pushed",
        "pr_created",
        "run_failed"
      ].includes(entry.message)
    )
    .reverse()
    .map((entry, index) => {
      if (entry.message === "run_continued") {
        return {
          id: `${entry.timestamp}-continued-${index}`,
          timestamp: entry.timestamp,
          title: "Run continuado",
          detail: summarizeLogData(entry.data),
          accent: "#60a5fa"
        };
      }

      if (entry.message === "run_target_stage") {
        return {
          id: `${entry.timestamp}-target-${index}`,
          timestamp: entry.timestamp,
          title: "Objetivo solicitado",
          detail: summarizeLogData(entry.data),
          accent: "#f59e0b"
        };
      }

      if (entry.message === "target_stage_reached") {
        return {
          id: `${entry.timestamp}-reached-${index}`,
          timestamp: entry.timestamp,
          title: "Objetivo alcanzado",
          detail: summarizeLogData(entry.data),
          accent: "#34d399"
        };
      }

      const stage = AUTONOMY_STAGES.find((item) => item.logMessage === entry.message);
      if (stage) {
        return {
          id: `${entry.timestamp}-${stage.key}-${index}`,
          timestamp: entry.timestamp,
          title: `${stage.label} completado`,
          detail: summarizeLogData(entry.data),
          accent: "#34d399"
        };
      }

      return {
        id: `${entry.timestamp}-${entry.message}-${index}`,
        timestamp: entry.timestamp,
        title: entry.message === "run_failed" ? "Run fallido" : entry.message,
        detail: summarizeLogData(entry.data),
        accent: entry.message === "run_failed" ? "#f87171" : "#94a3b8"
      };
    })
    .slice(0, 10);
}

export default function AdminAutonomyPage() {
  const enabled = semseRuntimeEnabled();
  const canvasSupported = useHtmlInCanvasSupport();
  const [task, setTask] = useState("add status badge");
  const [runs, setRuns] = useState<AutonomyRunView[]>([]);
  const [selected, setSelected] = useState<AutonomyRunView | null>(null);
  const [activeStage, setActiveStage] = useState<AutonomyStageKey>("branch");
  const [provider, setProvider] = useState<AutonomyLlmStatusView | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [smokeRunning, setSmokeRunning] = useState(false);
  const [copiedRunId, setCopiedRunId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | AutonomyRunView["status"]>("all");
  const [stageFilter, setStageFilter] = useState<"all" | AutonomyStageKey>("all");
  const [error, setError] = useState<string | null>(null);

  const loadRunDetail = useCallback(async (runId: string) => {
    const detail = await fetchAutonomyRun(runId);
    setSelected(detail);
    return detail;
  }, []);

  const reload = useCallback(
    async (preferredRunId?: string) => {
      if (!enabled) return;
      const shouldShowLoading = runs.length === 0 && !preferredRunId;
      setLoading(shouldShowLoading);
      setRefreshing(!shouldShowLoading);
      setError(null);
      try {
        const [data, providerStatus] = await Promise.all([fetchAutonomyRuns(), fetchAutonomyProviderStatus()]);
        setRuns(data.items);
        setProvider(providerStatus);

        const selectedId = preferredRunId ?? selected?.id ?? data.items[0]?.id;
        if (selectedId) {
          await loadRunDetail(selectedId);
        } else {
          setSelected(null);
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "No se pudo cargar autonomia.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [enabled, loadRunDetail, runs.length, selected?.id]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!enabled) return;
    const hasRunningRuns = runs.some((run) => run.status === "RUNNING");
    if (!hasRunningRuns) return;

    const timer = window.setInterval(() => {
      void reload(selected?.id);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [enabled, reload, runs, selected?.id]);

  useEffect(() => {
    if (!selected) {
      setActiveStage("branch");
      return;
    }

    const nextStage =
      AUTONOMY_STAGES.find((stage) => resolveStageState(selected, stage.key) === "active")?.key ??
      AUTONOMY_STAGES.find((stage) => resolveStageState(selected, stage.key) === "failed")?.key ??
      AUTONOMY_STAGES.find((stage) => resolveStageState(selected, stage.key) === "pending")?.key ??
      "pr";

    setActiveStage(nextStage);
  }, [selected]);

  async function runTask() {
    setRunning(true);
    setError(null);
    try {
      const created = await createAutonomyRun({ task, targetStage: activeStage });
      setSelected(created);
      await reload(created.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo ejecutar la tarea.");
    } finally {
      setRunning(false);
    }
  }

  async function continueSelectedRun() {
    if (!selected) return;
    const nextStage = resolveNextStage(selected);
    if (!nextStage) return;

    setContinuing(true);
    setError(null);
    try {
      const updated = await continueAutonomyRun(selected.id, { targetStage: nextStage });
      setSelected(updated);
      await reload(updated.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo continuar el run.");
    } finally {
      setContinuing(false);
    }
  }

  async function rerunSmoke() {
    const smokeTask = `add status badge smoke stage flow ${Date.now()}`;
    setSmokeRunning(true);
    setError(null);
    try {
      setTask(smokeTask);
      let current = await createAutonomyRun({ task: smokeTask, targetStage: "branch" });
      for (const stage of SMOKE_STAGES) {
        current = await continueAutonomyRun(current.id, { targetStage: stage });
      }
      setSelected(current);
      await reload(current.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo rehacer el smoke staged.");
    } finally {
      setSmokeRunning(false);
    }
  }

  async function copyRunId(runId: string) {
    try {
      await navigator.clipboard.writeText(runId);
      setCopiedRunId(runId);
      window.setTimeout(() => setCopiedRunId((current) => (current === runId ? null : current)), 2000);
    } catch {
      setError("No se pudo copiar el runId al portapapeles.");
    }
  }

  const activeStageMeta = AUTONOMY_STAGES.find((stage) => stage.key === activeStage) ?? AUTONOMY_STAGES[0];
  const stageLogs = selected
    ? selected.logs.filter(
        (entry) =>
          entry.message === activeStageMeta.logMessage ||
          entry.message === "run_target_stage" ||
          entry.message === "target_stage_reached" ||
          entry.message === "run_continued" ||
          (activeStage === "change" && entry.message === "changes_staged")
      )
    : [];
  const nextStage = useMemo(() => resolveNextStage(selected), [selected]);
  const currentStage = useMemo(() => resolveCurrentStage(selected), [selected]);
  const targetStage = useMemo(() => resolveTargetStage(selected), [selected]);
  const timeline = useMemo(() => buildTimeline(selected), [selected]);
  const filteredRuns = useMemo(
    () =>
      runs.filter((run) => {
        const statusOk = statusFilter === "all" || run.status === statusFilter;
        const stageOk = stageFilter === "all" || resolveCurrentStage(run) === stageFilter || resolveTargetStage(run) === stageFilter;
        return statusOk && stageOk;
      }),
    [runs, statusFilter, stageFilter]
  );
  const canCreateRun = enabled && task.trim().length >= 3 && !running && !smokeRunning;

  return (
    <main style={{ padding: "32px", color: "var(--ink)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <Link href="/admin/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}>
          <span style={{ fontSize: "14px" }}>←</span> Dashboard
        </Link>
        <NotificationBanner audience="admin" />
      </div>
      <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "380px 1fr" }}>
        <HtmlInCanvasPanel
          as="section"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "24px",
            background: "var(--surface)",
            padding: "24px"
          }}
          canvasClassName="rounded-[24px]"
          minHeight={520}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(59,130,246,0.15)", display: "grid", placeItems: "center" }}>
                <Bot size={20} color="#60a5fa" />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>Autonomous PR Core</h1>
                  <span
                    title={canvasSupported ? "Canvas nativo activo" : "DOM fallback — activa chrome://flags/#canvas-draw-element"}
                    style={{
                      padding: "2px 8px",
                      borderRadius: "999px",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      background: canvasSupported ? "rgba(52,211,153,0.12)" : "rgba(148,163,184,0.1)",
                      color: canvasSupported ? "#34d399" : "#64748b",
                      border: `1px solid ${canvasSupported ? "rgba(52,211,153,0.25)" : "rgba(148,163,184,0.15)"}`,
                      cursor: "default"
                    }}
                  >
                    {canvasSupported ? "canvas" : "DOM"}
                  </span>
                </div>
                <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>Branch → change → commit → push → PR</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void reload(selected?.id)}
              disabled={!enabled || refreshing}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "14px",
                background: "var(--panel)",
                color: "var(--ink)",
                padding: "10px 12px",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                cursor: enabled ? "pointer" : "not-allowed",
                opacity: enabled ? 1 : 0.6
              }}
            >
              <RefreshCw size={15} />
              {refreshing ? "Refrescando" : "Refrescar"}
            </button>
          </div>

          {provider && (
            <div
              style={{
                marginBottom: "18px",
                border: "1px solid var(--border)",
                borderRadius: "18px",
                background: "var(--panel)",
                padding: "14px"
              }}
            >
              <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "6px" }}>LLM activo</div>
              <div style={{ fontWeight: 800 }}>{provider.provider}</div>
              <div style={{ fontSize: "0.92rem", color: "var(--muted)", marginTop: "4px" }}>
                modelo: {provider.model ?? "n/a"}
              </div>
              <div style={{ fontSize: "0.92rem", color: "var(--muted)" }}>
                endpoint: {provider.baseUrl ?? "n/a"}
              </div>
              <div style={{ fontSize: "0.92rem", color: provider.configured ? "#34d399" : "#f87171", marginTop: "4px" }}>
                {provider.configured ? "configurado" : "sin configurar"}
              </div>
            </div>
          )}

          <div
            style={{
              marginBottom: "18px",
              border: "1px solid var(--border)",
              borderRadius: "18px",
              background: "var(--panel)",
              padding: "14px",
              display: "grid",
              gap: "8px"
            }}
          >
            <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Estado staged del run seleccionado</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <span style={badgeStyle("#60a5fa", "rgba(59,130,246,0.12)")}>Actual: {stageLabel(currentStage)}</span>
              <span style={badgeStyle("#f59e0b", "rgba(245,158,11,0.12)")}>Target: {stageLabel(targetStage)}</span>
              <span style={badgeStyle("#a78bfa", "rgba(167,139,250,0.12)")}>Siguiente: {stageLabel(nextStage)}</span>
            </div>
            <div style={{ fontSize: "0.92rem", color: "var(--muted)" }}>{progressLabel(selected)}</div>
          </div>

          <div style={{ display: "grid", gap: "10px", marginBottom: "18px" }}>
            <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Autonomous PR Core</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "8px" }}>
              {AUTONOMY_STAGES.map((stage, index) => {
                const colors = stageTone(selected ? resolveStageState(selected, stage.key) : "idle", activeStage === stage.key);
                return (
                  <button
                    key={stage.key}
                    type="button"
                    onClick={() => setActiveStage(stage.key)}
                    style={{
                      borderRadius: "14px",
                      border: `1px solid ${colors.border}`,
                      background: colors.background,
                      color: colors.color,
                      padding: "10px 8px",
                      cursor: "pointer",
                      fontWeight: 800
                    }}
                  >
                    <div style={{ fontSize: "0.72rem", opacity: 0.75 }}>{index + 1}</div>
                    <div style={{ fontSize: "0.88rem" }}>{stage.label}</div>
                  </button>
                );
              })}
            </div>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>{activeStageMeta.hint}</p>
          </div>

          <div
            style={{
              marginBottom: "18px",
              border: "1px solid var(--border)",
              borderRadius: "18px",
              background: "var(--panel)",
              padding: "14px",
              display: "grid",
              gap: "8px"
            }}
          >
            <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Contexto absorbido de infclaude</div>
            {INFOCLAUDE_CONTEXT.map((item) => (
              <div key={item} style={{ fontSize: "0.92rem", color: "var(--ink)" }}>
                {item}
              </div>
            ))}
          </div>

          <label style={{ display: "grid", gap: "8px" }}>
            <span style={{ fontWeight: 700 }}>Tarea natural</span>
            <textarea
              value={task}
              onChange={(event) => setTask(event.target.value)}
              rows={6}
              style={{
                width: "100%",
                borderRadius: "16px",
                border: "1px solid var(--border)",
                background: "var(--panel)",
                color: "var(--ink)",
                padding: "14px"
              }}
            />
          </label>

          <button
            onClick={() => {
              // The UI never shows whether this run targets the sandbox repo
              // or a real one (SEMSE_AUTONOMY_GITHUB_TOKEN/REPO_NAME
              // configured server-side) — see docs/AUDIT_REMEDIATION_PLAN.md
              // 3.20.
              if (window.confirm(`¿Ejecutar hasta la etapa "${activeStageMeta.label}"? Si el repo real de GitHub está configurado en el servidor, esto puede crear branches/commits reales, no solo en el sandbox.`)) {
                runTask();
              }
            }}
            disabled={!canCreateRun}
            style={{
              marginTop: "16px",
              width: "100%",
              border: "none",
              borderRadius: "16px",
              padding: "14px 18px",
              fontWeight: 800,
              background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              cursor: canCreateRun ? "pointer" : "not-allowed",
              opacity: canCreateRun ? 1 : 0.6
            }}
          >
            <Play size={16} />
            {running ? "Ejecutando..." : `Ejecutar hasta ${activeStageMeta.label}`}
          </button>

          <button
            onClick={() => {
              if (window.confirm(`¿Continuar hasta "${nextStage ? stageLabel(nextStage) : "la siguiente etapa"}"? Si el repo real de GitHub está configurado en el servidor, esto puede tocar el repo real, no solo el sandbox.`)) {
                continueSelectedRun();
              }
            }}
            disabled={!selected || !nextStage || continuing || smokeRunning}
            style={{
              marginTop: "12px",
              width: "100%",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "14px 18px",
              fontWeight: 800,
              background: "var(--panel)",
              color: "var(--ink)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              cursor: !selected || !nextStage ? "not-allowed" : "pointer",
              opacity: !selected || !nextStage ? 0.6 : 1
            }}
          >
            <SkipForward size={16} />
            {continuing ? "Continuando..." : nextStage ? `Continuar hasta ${stageLabel(nextStage)}` : "Run completo"}
          </button>

          <button
            onClick={() => {
              if (window.confirm("¿Rehacer smoke staged? Esto encadena automáticamente change → commit → push → PR en una sola llamada. Si el repo real de GitHub está configurado en el servidor, hace push y abre un PR real, no solo en el sandbox.")) {
                rerunSmoke();
              }
            }}
            disabled={!enabled || smokeRunning || running || continuing}
            style={{
              marginTop: "12px",
              width: "100%",
              border: "1px solid rgba(16,185,129,0.28)",
              borderRadius: "16px",
              padding: "14px 18px",
              fontWeight: 800,
              background: "rgba(16,185,129,0.12)",
              color: "#34d399",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              cursor: enabled ? "pointer" : "not-allowed",
              opacity: enabled ? 1 : 0.6
            }}
          >
            <RefreshCw size={16} />
            {smokeRunning ? "Rehaciendo smoke..." : "Rehacer smoke staged"}
          </button>

          {error && <p style={{ marginTop: "14px", color: "#f87171" }}>{error}</p>}
        </HtmlInCanvasPanel>

        <section style={{ display: "grid", gap: "20px" }}>
          <HtmlInCanvasPanel
            style={{
              border: "1px solid var(--border)",
              borderRadius: "24px",
              background: "var(--surface)",
              padding: "24px"
            }}
            canvasClassName="rounded-[24px]"
            minHeight={300}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "end", marginBottom: "16px" }}>
              <div>
                <h2 style={{ marginTop: 0, marginBottom: "4px" }}>Runs recientes</h2>
                <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{filteredRuns.length} visibles de {runs.length}</div>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <label style={{ display: "grid", gap: "4px" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Estado</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | AutonomyRunView["status"])} style={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--panel)", color: "var(--ink)", padding: "10px 12px" }}>
                    <option value="all">Todos</option>
                    <option value="RUNNING">RUNNING</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="FAILED">FAILED</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: "4px" }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Etapa</span>
                  <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as "all" | AutonomyStageKey)} style={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--panel)", color: "var(--ink)", padding: "10px 12px" }}>
                    <option value="all">Todas</option>
                    {AUTONOMY_STAGES.map((stage) => (
                      <option key={stage.key} value={stage.key}>{stage.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            {loading ? (
              <p style={{ color: "var(--muted)" }}>Cargando...</p>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {filteredRuns.length === 0 ? (
                  <div style={{ border: "1px dashed var(--border)", borderRadius: "18px", padding: "18px", color: "var(--muted)" }}>
                    No hay runs para los filtros activos.
                  </div>
                ) : filteredRuns.map((run) => {
                  const statusTone = tone(run.status);
                  const runTargetStage = resolveTargetStage(run);
                  const runNextStage = resolveNextStage(run);
                  const selectedRun = selected?.id === run.id;
                  return (
                    <button
                      key={run.id}
                      onClick={() => void loadRunDetail(run.id)}
                      style={{
                        textAlign: "left",
                        border: selectedRun ? "1px solid rgba(96,165,250,0.4)" : "1px solid var(--border)",
                        borderRadius: "18px",
                        background: "var(--panel)",
                        color: "var(--ink)",
                        padding: "16px",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                        <strong>{run.task}</strong>
                        <span style={{ padding: "4px 10px", borderRadius: "999px", background: statusTone.bg, color: statusTone.color }}>
                          {run.status}
                        </span>
                      </div>
                      <div style={{ marginTop: "8px", color: "var(--muted)", fontSize: "0.92rem" }}>
                        {run.branchName ?? "pending"} · {formatTimestamp(run.createdAt)}
                      </div>
                      <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        <span style={badgeStyle("#f59e0b", "rgba(245,158,11,0.12)")}>Target {stageLabel(runTargetStage)}</span>
                        <span style={badgeStyle("#a78bfa", "rgba(167,139,250,0.12)")}>Siguiente {stageLabel(runNextStage)}</span>
                      </div>
                      <div style={{ marginTop: "8px", color: "var(--muted)", fontSize: "0.82rem" }}>
                        progreso core: {resolveCompletedStageCount(run)}/{AUTONOMY_STAGES.length}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </HtmlInCanvasPanel>

          <HtmlInCanvasPanel
            style={{
              border: "1px solid var(--border)",
              borderRadius: "24px",
              background: "var(--surface)",
              padding: "24px"
            }}
            canvasClassName="rounded-[24px]"
            minHeight={360}
          >
            <h2 style={{ marginTop: 0 }}>Detalle</h2>
            {!selected ? (
              <p style={{ color: "var(--muted)" }}>Selecciona un run.</p>
            ) : (
              <div style={{ display: "grid", gap: "14px" }}>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}><GitBranch size={16} />{selected.branchName ?? "n/a"}</span>
                  <span style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}><TerminalSquare size={16} />{selected.commitSha ?? "n/a"}</span>
                  <span style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}><LinkIcon size={16} />{selected.prUrl ? <a href={selected.prUrl} target="_blank" rel="noreferrer" style={{ color: "#60a5fa", textDecoration: "underline" }}>{selected.prUrl}</a> : "n/a"}</span>
                </div>
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "18px",
                    background: "var(--panel)",
                    padding: "14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap"
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "4px" }}>runId</div>
                    <div style={{ fontWeight: 800, wordBreak: "break-all" }}>{selected.id}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyRunId(selected.id)}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "14px",
                      background: "var(--surface)",
                      color: "var(--ink)",
                      padding: "10px 12px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      cursor: "pointer"
                    }}
                  >
                    <Copy size={15} />
                    {copiedRunId === selected.id ? "Copiado" : "Copiar runId"}
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <span style={badgeStyle("#60a5fa", "rgba(59,130,246,0.12)")}>Actual {stageLabel(currentStage)}</span>
                  <span style={badgeStyle("#f59e0b", "rgba(245,158,11,0.12)")}>Target {stageLabel(targetStage)}</span>
                  <span style={badgeStyle("#a78bfa", "rgba(167,139,250,0.12)")}>Siguiente {stageLabel(nextStage)}</span>
                </div>
                <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>{progressLabel(selected)}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "10px" }}>
                  {AUTONOMY_STAGES.map((stage, index) => {
                    const state = resolveStageState(selected, stage.key);
                    const colors = stageTone(state, activeStage === stage.key);
                    return (
                      <button
                        key={stage.key}
                        type="button"
                        onClick={() => setActiveStage(stage.key)}
                        style={{
                          textAlign: "left",
                          borderRadius: "16px",
                          border: `1px solid ${colors.border}`,
                          background: colors.background,
                          color: colors.color,
                          padding: "12px",
                          cursor: "pointer"
                        }}
                      >
                        <div style={{ fontSize: "0.74rem", opacity: 0.72 }}>Paso {index + 1}</div>
                        <div style={{ fontWeight: 800, marginTop: "4px" }}>{stage.label}</div>
                        <div style={{ fontSize: "0.82rem", marginTop: "6px", color: "var(--muted)" }}>
                          {stageStatusLabel(state)}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "18px",
                    background: "var(--panel)",
                    padding: "16px",
                    display: "grid",
                    gap: "12px"
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "4px" }}>Ultimas transiciones reales</div>
                    <div style={{ fontSize: "0.92rem", color: "var(--muted)" }}>`run_continued`, `run_target_stage`, `target_stage_reached` y cierres por etapa.</div>
                  </div>
                  {timeline.length === 0 ? (
                    <p style={{ margin: 0, color: "var(--muted)" }}>Sin transiciones registradas.</p>
                  ) : (
                    <div style={{ display: "grid", gap: "12px" }}>
                      {timeline.map((entry) => (
                        <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "12px 1fr", gap: "12px", alignItems: "start" }}>
                          <div style={{ width: 12, height: 12, borderRadius: 999, background: entry.accent, marginTop: 6 }} />
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                              <strong>{entry.title}</strong>
                              <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{formatTimestamp(entry.timestamp)}</span>
                            </div>
                            <div style={{ marginTop: "4px", color: "var(--muted)", fontSize: "0.92rem" }}>{entry.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "18px",
                    background: "var(--panel)",
                    padding: "16px",
                    display: "grid",
                    gap: "10px"
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "4px" }}>Archivo generado</div>
                    <div style={{ fontWeight: 700, wordBreak: "break-all" }}>{selected.generatedFile ?? "No disponible"}</div>
                    {selected.generatedFile ? (
                      <div style={{ marginTop: "8px" }}>
                        <a href={"/api/semse/autonomy/" + encodeURIComponent(selected.id) + "/generated-file"} target="_blank" rel="noreferrer" style={{ color: "#60a5fa", textDecoration: "underline", fontSize: "0.92rem" }}>
                          Abrir archivo generado
                        </a>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "8px" }}>Contenido generado</div>
                    <pre
                      style={{
                        margin: 0,
                        padding: "16px",
                        borderRadius: "16px",
                        background: "rgba(15,23,42,0.35)",
                        overflowX: "auto",
                        whiteSpace: "pre-wrap",
                        color: "var(--ink)"
                      }}
                    >
                      {selected.generatedContent ?? "No disponible."}
                    </pre>
                  </div>
                </div>
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "18px",
                    background: "var(--panel)",
                    padding: "16px",
                    display: "grid",
                    gap: "10px"
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "4px" }}>Telemetria de la etapa activa</div>
                    <div style={{ fontWeight: 800 }}>{activeStageMeta.label}</div>
                    <div style={{ fontSize: "0.92rem", color: "var(--muted)", marginTop: "4px" }}>{activeStageMeta.hint}</div>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: "16px",
                      borderRadius: "16px",
                      background: "rgba(15,23,42,0.35)",
                      overflowX: "auto",
                      whiteSpace: "pre-wrap",
                      color: "var(--ink)"
                    }}
                  >
                    {JSON.stringify(stageLogs.length > 0 ? stageLogs : selected.logs, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </HtmlInCanvasPanel>
        </section>
      </div>
    </main>
  );
}
