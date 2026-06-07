"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DeveloperRuntimeCreateMissionInput,
  DeveloperRuntimeRiskLevel,
  DeveloperRuntimeTaskCategory,
} from "@semse/schemas";
import {
  createDeveloperRuntimeMission,
  createDeveloperRuntimeSession,
  executeDeveloperRuntimeSession,
  fetchDeveloperRuntimeCatalog,
  fetchDeveloperRuntimeSession,
  fetchDeveloperRuntimeSessions,
  respondDeveloperRuntimeApproval,
  semseRuntimeEnabled,
  type DeveloperRuntimeCatalog,
  type DeveloperRuntimeSessionDetail,
} from "../../../semse-api";

const CATEGORIES: DeveloperRuntimeTaskCategory[] = [
  "bootstrap",
  "diagnostic",
  "bugfix",
  "refactor",
  "generate",
  "validate",
  "deploy",
  "document",
];

const RISK_BY_CATEGORY: Record<DeveloperRuntimeTaskCategory, DeveloperRuntimeRiskLevel> = {
  bootstrap: "medium",
  diagnostic: "low",
  bugfix: "medium",
  refactor: "medium",
  generate: "medium",
  validate: "low",
  deploy: "high",
  document: "low",
};

type DraftWriteFile = {
  path: string;
  content: string;
};

type DraftPatchFile = {
  path: string;
  find: string;
  replace: string;
};

function formatDate(value?: string) {
  if (!value) return "n/a";
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toneForStatus(status: string) {
  if (status === "failed" || status === "error") return { bg: "rgba(239,68,68,0.12)", color: "#fca5a5", border: "rgba(239,68,68,0.28)" };
  if (status === "warning" || status === "skipped") return { bg: "rgba(250,204,21,0.12)", color: "#fde047", border: "rgba(250,204,21,0.28)" };
  return { bg: "rgba(16,185,129,0.12)", color: "#86efac", border: "rgba(16,185,129,0.28)" };
}

function toneForRisk(risk: string) {
  if (risk === "critical") return { bg: "rgba(239,68,68,0.16)", color: "#fca5a5", border: "rgba(239,68,68,0.32)" };
  if (risk === "high") return { bg: "rgba(251,146,60,0.16)", color: "#fdba74", border: "rgba(249,115,22,0.32)" };
  if (risk === "medium") return { bg: "rgba(250,204,21,0.12)", color: "#fde047", border: "rgba(250,204,21,0.28)" };
  return { bg: "rgba(16,185,129,0.12)", color: "#86efac", border: "rgba(16,185,129,0.28)" };
}

function isDiffArtifact(artifact: { type: string; label: string }) {
  return artifact.type === "patch" || artifact.type === "file" || artifact.label.startsWith("patch:") || artifact.label.startsWith("write:");
}

function diffTone(line: string) {
  if (line.startsWith("@@")) {
    return { background: "rgba(59,130,246,0.10)", color: "#93c5fd" };
  }
  if (line.startsWith("+++ ") || line.startsWith("--- ")) {
    return { background: "transparent", color: "var(--faint)" };
  }
  if (line.startsWith("+")) {
    return { background: "rgba(16,185,129,0.10)", color: "#bbf7d0" };
  }
  if (line.startsWith("-")) {
    return { background: "rgba(239,68,68,0.10)", color: "#fecaca" };
  }
  if (line.startsWith(" ")) {
    return { background: "transparent", color: "var(--muted)" };
  }
  return { background: "transparent", color: "var(--faint)" };
}

function terminalLineTone(line: string) {
  const lower = line.toLowerCase();
  if (lower.includes("error") || lower.includes("failed") || lower.includes("✖") || lower.startsWith("error ts")) {
    return "#fca5a5";
  }
  if (lower.includes("warning") || lower.includes("warn")) {
    return "#fde047";
  }
  if (lower.includes("✓") || lower.includes("passed") || lower.includes("success")) {
    return "#86efac";
  }
  return "#cbd5e1";
}

function stepLabel(stepMap: Map<string, string>, stepId?: string) {
  if (!stepId) return "global";
  return stepMap.get(stepId) ?? stepId;
}

export default function AdminDeveloperRuntimePage() {
  const runtimeEnabled = semseRuntimeEnabled();
  const [catalog, setCatalog] = useState<DeveloperRuntimeCatalog | null>(null);
  const [sessions, setSessions] = useState<DeveloperRuntimeSessionDetail["session"][]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DeveloperRuntimeSessionDetail | null>(null);
  const [loading, setLoading] = useState(runtimeEnabled);
  const [submitting, setSubmitting] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [resolvingApprovalId, setResolvingApprovalId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStepFilter, setSelectedStepFilter] = useState("all");
  const [repoId, setRepoId] = useState("project-manager-app");
  const [branch, setBranch] = useState("main");
  const [goal, setGoal] = useState("Haz que este repo compile y deja evidencia.");
  const [category, setCategory] = useState<DeveloperRuntimeTaskCategory>("bugfix");
  const [commandTemplate, setCommandTemplate] = useState("");
  const [writeFiles, setWriteFiles] = useState<DraftWriteFile[]>([{ path: "", content: "" }]);
  const [patches, setPatches] = useState<DraftPatchFile[]>([{ path: "", find: "", replace: "" }]);

  const selectedRisk = useMemo(() => RISK_BY_CATEGORY[category], [category]);

  const loadSessions = useCallback(async () => {
    const items = await fetchDeveloperRuntimeSessions();
    setSessions(items);
    setSelectedSessionId((current) => current ?? items[0]?.id ?? null);
    return items;
  }, []);

  const loadDetail = useCallback(async (sessionId: string) => {
    setDetailLoading(true);
    try {
      const sessionDetail = await fetchDeveloperRuntimeSession(sessionId);
      setDetail(sessionDetail);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!runtimeEnabled) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.all([
      fetchDeveloperRuntimeCatalog(),
      loadSessions(),
    ])
      .then(([catalogData, sessionData]) => {
        if (cancelled) return;
        setCatalog(catalogData);
        if (sessionData[0]?.id) {
          setSelectedSessionId((current) => current ?? sessionData[0].id);
        }
      })
      .catch((reason) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "No se pudo cargar el Developer Runtime.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [runtimeEnabled, loadSessions]);

  useEffect(() => {
    if (!runtimeEnabled || !selectedSessionId) return;

    setSelectedStepFilter("all");
    let cancelled = false;
    void loadDetail(selectedSessionId)
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "No se pudo cargar el detalle de la sesión.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runtimeEnabled, selectedSessionId, loadDetail]);

  useEffect(() => {
    if (!runtimeEnabled || !selectedSessionId || detail?.session.state !== "executing") {
      return;
    }

    const timer = window.setInterval(() => {
      void Promise.all([
        loadDetail(selectedSessionId),
        loadSessions(),
      ]).catch(() => {
        // keep polling best-effort while execution is in flight
      });
    }, 2500);

    return () => {
      window.clearInterval(timer);
    };
  }, [runtimeEnabled, selectedSessionId, detail?.session.state, loadDetail, loadSessions]);

  useEffect(() => {
    if (!runtimeEnabled || !selectedSessionId || detail?.session.state !== "executing") {
      return;
    }

    const source = new EventSource(`/api/semse/developer-runtime/sessions/${encodeURIComponent(selectedSessionId)}/stream`);

    source.addEventListener("session-detail", (event) => {
      if (!(event instanceof MessageEvent)) return;
      try {
        const nextDetail = JSON.parse(event.data) as DeveloperRuntimeSessionDetail;
        setDetail(nextDetail);
        setSessions((current) => current.map((session) => (
          session.id === nextDetail.session.id ? nextDetail.session : session
        )));
        if (nextDetail.session.state !== "executing") {
          source.close();
        }
      } catch {
        // ignore malformed SSE payloads
      }
    });

    source.addEventListener("stream-error", () => {
      source.close();
    });
    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [runtimeEnabled, selectedSessionId, detail?.session.state]);

  async function handleCreateMission() {
    setSubmitting(true);
    setError(null);
    try {
      const session = await createDeveloperRuntimeSession({
        repoId: repoId.trim(),
        branch: branch.trim() || undefined,
        goal: goal.trim(),
        selectedAgents: [],
      });

      const runtimeMetadata = {
        ...(commandTemplate ? { commandTemplate } : {}),
        ...(writeFiles.some((entry) => entry.path.trim()) ? {
          writeFiles: writeFiles
            .filter((entry) => entry.path.trim())
            .map((entry) => ({
              path: entry.path.trim(),
              content: entry.content,
            })),
        } : {}),
        ...(patches.some((entry) => entry.path.trim() && entry.find.trim()) ? {
          patches: patches
            .filter((entry) => entry.path.trim() && entry.find.trim())
            .map((entry) => ({
              path: entry.path.trim(),
              find: entry.find,
              replace: entry.replace,
            })),
        } : {}),
      };

      const missionInput: DeveloperRuntimeCreateMissionInput = {
        intent: {
          goal: goal.trim(),
          category,
          confidence: 0.82,
          riskLevel: selectedRisk,
          requiresApproval: selectedRisk !== "low",
          repoId: repoId.trim(),
          branch: branch.trim() || undefined,
          metadata: Object.keys(runtimeMetadata).length > 0 ? runtimeMetadata : undefined,
        },
      };

      await createDeveloperRuntimeMission(session.id, missionInput);
      await loadSessions();
      setSelectedSessionId(session.id);
      await loadDetail(session.id);
      setWriteFiles([{ path: "", content: "" }]);
      setPatches([{ path: "", find: "", replace: "" }]);
      setCommandTemplate("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear la misión.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExecuteMission() {
    if (!selectedSessionId) return;

    setExecuting(true);
    setError(null);
    try {
      await executeDeveloperRuntimeSession(selectedSessionId);
      await loadDetail(selectedSessionId);
      await loadSessions();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo ejecutar la misión.");
    } finally {
      setExecuting(false);
    }
  }

  async function handleApprovalResponse(approvalId: string, approved: boolean) {
    if (!selectedSessionId) return;

    setResolvingApprovalId(approvalId);
    setError(null);
    try {
      await respondDeveloperRuntimeApproval(selectedSessionId, approvalId, {
        approved,
        comment: approved ? "Aprobado desde panel admin." : "Rechazado desde panel admin.",
      });
      await loadDetail(selectedSessionId);
      await loadSessions();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo resolver la aprobación.");
    } finally {
      setResolvingApprovalId(null);
    }
  }

  function updateWriteFile(index: number, next: Partial<DraftWriteFile>) {
    setWriteFiles((current) => current.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, ...next } : entry
    )));
  }

  function updatePatch(index: number, next: Partial<DraftPatchFile>) {
    setPatches((current) => current.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, ...next } : entry
    )));
  }

  function addWriteFile() {
    setWriteFiles((current) => [...current, { path: "", content: "" }]);
  }

  function addPatch() {
    setPatches((current) => [...current, { path: "", find: "", replace: "" }]);
  }

  function removeWriteFile(index: number) {
    setWriteFiles((current) => current.length === 1
      ? [{ path: "", content: "" }]
      : current.filter((_, entryIndex) => entryIndex !== index));
  }

  function removePatch(index: number) {
    setPatches((current) => current.length === 1
      ? [{ path: "", find: "", replace: "" }]
      : current.filter((_, entryIndex) => entryIndex !== index));
  }

  const mission = detail?.mission;
  const logs = detail?.logs ?? [];
  const validations = detail?.validations ?? [];
  const artifacts = detail?.artifacts ?? [];
  const approvals = detail?.approvals ?? [];
  const pendingApprovals = approvals.filter((approval) => !approval.decision);
  const stepMap = new Map((mission?.plan ?? []).map((step) => [step.id, `${step.order + 1}. ${step.title}`]));
  const diffArtifacts = artifacts.filter(isDiffArtifact);
  const commandOutputArtifacts = artifacts.filter((artifact) => artifact.type === "command_output");
  const commandArtifactsByStep = commandOutputArtifacts.reduce<Record<string, typeof commandOutputArtifacts>>((acc, artifact) => {
    const key = artifact.stepId ?? "global";
    acc[key] ??= [];
    acc[key].push(artifact);
    return acc;
  }, {});
  const diffArtifactsByStep = diffArtifacts.reduce<Record<string, typeof diffArtifacts>>((acc, artifact) => {
    const key = artifact.stepId ?? "global";
    acc[key] ??= [];
    acc[key].push(artifact);
    return acc;
  }, {});
  const filteredLogs = selectedStepFilter === "all"
    ? logs
    : logs.filter((log) => (log.stepId ?? "global") === selectedStepFilter);
  const filteredValidations = selectedStepFilter === "all"
    ? validations
    : validations.filter((validation) => (validation.stepId ?? "global") === selectedStepFilter);
  const filteredArtifacts = selectedStepFilter === "all"
    ? artifacts
    : artifacts.filter((artifact) => (artifact.stepId ?? "global") === selectedStepFilter);
  const filteredCommandOutputArtifacts = selectedStepFilter === "all"
    ? commandOutputArtifacts
    : commandOutputArtifacts.filter((artifact) => (artifact.stepId ?? "global") === selectedStepFilter);
  const filteredDiffArtifacts = selectedStepFilter === "all"
    ? diffArtifacts
    : diffArtifacts.filter((artifact) => (artifact.stepId ?? "global") === selectedStepFilter);
  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gap: "16px" }}>
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>
          Developer Runtime
        </h1>
        <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>
          Capa operativa agentiva: intención, plan, agentes, validación y evidencia en un solo flujo.
        </p>
      </div>

      {!runtimeEnabled ? (
        <div style={{ padding: "16px", borderRadius: "14px", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.28)", color: "#fbbf24" }}>
          Runtime desactivado. Activa `NEXT_PUBLIC_SEMSE_RUNTIME_ENABLED=true` para usar esta consola.
        </div>
      ) : null}

      {error ? (
        <div style={{ padding: "16px", borderRadius: "14px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.28)", color: "#fca5a5" }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.4fr 1.3fr", gap: "16px", alignItems: "start" }}>
        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "16px" }}>
          <p style={{ fontSize: "12px", color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
            Nueva misión
          </p>

          <div style={{ display: "grid", gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Repo</span>
              <input value={repoId} onChange={(event) => setRepoId(event.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Branch</span>
              <input value={branch} onChange={(event) => setBranch(event.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Objetivo</span>
              <textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={5} style={{ ...inputStyle, resize: "vertical" }} />
            </label>
            <label style={{ display: "grid", gap: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Categoría</span>
              <select value={category} onChange={(event) => setCategory(event.target.value as DeveloperRuntimeTaskCategory)} style={inputStyle}>
                {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>

            <div style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "12px", background: "var(--panel)", display: "grid", gap: "10px" }}>
              <p style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 700 }}>Payload operativo</p>
              <label style={{ display: "grid", gap: "6px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>Command template</span>
                <select value={commandTemplate} onChange={(event) => setCommandTemplate(event.target.value)} style={inputStyle}>
                  <option value="">sin comando</option>
                  {catalog ? Object.keys(catalog.commandTemplates).map((template) => (
                    <option key={template} value={template}>{template}</option>
                  )) : null}
                </select>
              </label>
              <div style={{ display: "grid", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 700 }}>Write files</span>
                  <button type="button" onClick={addWriteFile} style={secondaryButtonStyle}>Agregar</button>
                </div>
                {writeFiles.map((entry, index) => (
                  <div key={`write-${index}`} style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "10px", display: "grid", gap: "8px", background: "var(--surface)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <strong style={{ fontSize: "12px", color: "var(--ink)" }}>write #{index + 1}</strong>
                      <button type="button" onClick={() => removeWriteFile(index)} style={ghostDangerButtonStyle}>Quitar</button>
                    </div>
                    <input
                      value={entry.path}
                      onChange={(event) => updateWriteFile(index, { path: event.target.value })}
                      placeholder="apps/api/src/demo.ts"
                      style={inputStyle}
                    />
                    <textarea
                      value={entry.content}
                      onChange={(event) => updateWriteFile(index, { content: event.target.value })}
                      rows={4}
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 700 }}>Patches</span>
                  <button type="button" onClick={addPatch} style={secondaryButtonStyle}>Agregar</button>
                </div>
                {patches.map((entry, index) => (
                  <div key={`patch-${index}`} style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "10px", display: "grid", gap: "8px", background: "var(--surface)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <strong style={{ fontSize: "12px", color: "var(--ink)" }}>patch #{index + 1}</strong>
                      <button type="button" onClick={() => removePatch(index)} style={ghostDangerButtonStyle}>Quitar</button>
                    </div>
                    <input
                      value={entry.path}
                      onChange={(event) => updatePatch(index, { path: event.target.value })}
                      placeholder="apps/api/src/example.ts"
                      style={inputStyle}
                    />
                    <textarea
                      value={entry.find}
                      onChange={(event) => updatePatch(index, { find: event.target.value })}
                      rows={3}
                      placeholder="texto a buscar"
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                    <textarea
                      value={entry.replace}
                      onChange={(event) => updatePatch(index, { replace: event.target.value })}
                      rows={3}
                      placeholder="texto nuevo"
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <span style={{ ...pillStyle, ...toneForRisk(selectedRisk) }}>riesgo {selectedRisk}</span>
              <button
                onClick={() => void handleCreateMission()}
                disabled={submitting || !runtimeEnabled || repoId.trim().length === 0 || goal.trim().length === 0}
                style={{
                  border: "none",
                  borderRadius: "10px",
                  background: "var(--brand)",
                  color: "#fff",
                  padding: "10px 14px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Planificando..." : "Crear sesión + plan"}
              </button>
            </div>
          </div>
        </section>

        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <p style={{ fontSize: "12px", color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Sesiones activas
            </p>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>{sessions.length} total</span>
          </div>

          {loading ? (
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>Cargando sesiones...</p>
          ) : sessions.length === 0 ? (
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>Aún no hay sesiones de Developer Runtime.</p>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {sessions.map((session) => {
                const active = session.id === selectedSessionId;
                return (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    style={{
                      textAlign: "left",
                      borderRadius: "12px",
                      padding: "12px",
                      cursor: "pointer",
                      border: `1px solid ${active ? "rgba(59,130,246,0.35)" : "var(--border)"}`,
                      background: active ? "rgba(59,130,246,0.08)" : "var(--panel)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <strong style={{ fontSize: "13px", color: "var(--ink)" }}>{session.repoId}</strong>
                      <span style={{ ...pillStyle, ...toneForRisk(session.state === "awaiting_approval" ? "medium" : "low") }}>{session.state}</span>
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px", lineHeight: 1.5 }}>{session.goal}</p>
                    <p style={{ fontSize: "11px", color: "var(--faint)", marginTop: "8px" }}>
                      {session.branch ?? "sin branch"} · {formatDate(session.startedAt)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "16px" }}>
          <p style={{ fontSize: "12px", color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
            Catálogo operativo
          </p>

          {!catalog ? (
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>Cargando catálogo...</p>
          ) : (
            <div style={{ display: "grid", gap: "14px" }}>
              <div>
                <p style={sectionLabelStyle}>Autonomía</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {catalog.autonomyLevels.map((level) => <span key={level} style={{ ...pillStyle, background: "var(--panel)", color: "var(--muted)", border: "1px solid var(--border)" }}>{level}</span>)}
                </div>
              </div>

              <div>
                <p style={sectionLabelStyle}>Agentes</p>
                <div style={{ display: "grid", gap: "8px", maxHeight: "260px", overflowY: "auto" }}>
                  {catalog.agents.map((agent) => (
                    <div key={agent.role} style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "10px", background: "var(--panel)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                        <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{agent.role}</strong>
                        <span style={{ ...pillStyle, background: "rgba(16,185,129,0.12)", color: "#86efac", border: "1px solid rgba(16,185,129,0.24)" }}>{agent.maxAutonomyLevel}</span>
                      </div>
                      <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px", lineHeight: 1.45 }}>{agent.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p style={sectionLabelStyle}>Command templates</p>
                <div style={{ display: "grid", gap: "8px" }}>
                  {Object.entries(catalog.commandTemplates).map(([template, command]) => (
                    <div key={template} style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "10px", background: "var(--panel)" }}>
                      <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{template}</strong>
                      <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px", wordBreak: "break-all" }}>{command}</p>
                      <p style={{ fontSize: "10px", color: "var(--faint)", marginTop: "6px", lineHeight: 1.4 }}>
                        args: {catalog.commandTemplatePolicies[template]?.allowArgs ? `hasta ${catalog.commandTemplatePolicies[template]?.maxArgs}` : "no permitidos"}
                        {" · "}
                        {catalog.commandTemplatePolicies[template]?.notes ?? "sin notas"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
          <div>
            <p style={{ fontSize: "12px", color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Detalle de sesión
            </p>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--ink)", marginTop: "4px" }}>
              {detail?.session.goal ?? "Selecciona una sesión"}
            </h2>
          </div>
          {detail?.session ? (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button
                onClick={() => void handleExecuteMission()}
                disabled={executing || !mission || detail.session.state === "executing"}
                style={{
                  border: "none",
                  borderRadius: "10px",
                  background: detail.session.state === "executing" ? "rgba(59,130,246,0.22)" : pendingApprovals.length > 0 ? "rgba(148,163,184,0.2)" : "var(--brand)",
                  color: "#fff",
                  padding: "8px 12px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: executing || !mission || pendingApprovals.length > 0 ? "not-allowed" : "pointer",
                  opacity: executing || !mission || pendingApprovals.length > 0 ? 0.7 : 1,
                }}
              >
                {executing ? "Despachando..." : detail.session.state === "executing" ? "En ejecución" : pendingApprovals.length > 0 ? "Pendiente aprobación" : "Ejecutar misión"}
              </button>
              <span style={{ ...pillStyle, background: "var(--panel)", color: "var(--muted)", border: "1px solid var(--border)" }}>{detail.session.repoId}</span>
              <span style={{ ...pillStyle, background: "var(--panel)", color: "var(--muted)", border: "1px solid var(--border)" }}>{detail.session.branch ?? "sin branch"}</span>
              <span style={{ ...pillStyle, ...toneForRisk(mission?.riskLevel ?? "low") }}>{mission?.riskLevel ?? detail.session.state}</span>
            </div>
          ) : null}
        </div>

        {mission ? (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
            <label style={{ display: "grid", gap: "6px", minWidth: "240px" }}>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>Filtro por paso</span>
              <select value={selectedStepFilter} onChange={(event) => setSelectedStepFilter(event.target.value)} style={inputStyle}>
                <option value="all">todos</option>
                <option value="global">global</option>
                {mission.plan.map((step) => (
                  <option key={step.id} value={step.id}>{step.order + 1}. {step.title}</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {detailLoading ? (
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>Cargando detalle...</p>
        ) : !detail ? (
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>No hay una sesión seleccionada.</p>
        ) : !mission ? (
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>La sesión existe pero todavía no tiene misión materializada.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" }}>
              <div style={metricCardStyle}>
                <span style={metricLabelStyle}>Categoría</span>
                <strong style={metricValueStyle}>{mission.intent.category}</strong>
              </div>
              <div style={metricCardStyle}>
                <span style={metricLabelStyle}>Estado</span>
                <strong style={metricValueStyle}>{mission.status}</strong>
              </div>
              <div style={metricCardStyle}>
                <span style={metricLabelStyle}>Aprobación</span>
                <strong style={metricValueStyle}>{mission.intent.requiresApproval ? "sí" : "no"}</strong>
              </div>
              <div style={metricCardStyle}>
                <span style={metricLabelStyle}>Pasos</span>
                <strong style={metricValueStyle}>{mission.plan.length}</strong>
              </div>
              <div style={metricCardStyle}>
                <span style={metricLabelStyle}>Logs</span>
                <strong style={metricValueStyle}>{logs.length}</strong>
              </div>
              <div style={metricCardStyle}>
                <span style={metricLabelStyle}>Validaciones</span>
                <strong style={metricValueStyle}>{validations.length}</strong>
              </div>
              <div style={metricCardStyle}>
                <span style={metricLabelStyle}>Artefactos</span>
                <strong style={metricValueStyle}>{artifacts.length}</strong>
              </div>
              <div style={metricCardStyle}>
                <span style={metricLabelStyle}>Approvals</span>
                <strong style={metricValueStyle}>{approvals.length}</strong>
              </div>
            </div>

            <div style={{ display: "grid", gap: "10px" }}>
              {mission.plan.map((step) => (
                <div key={step.id} style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "12px", background: "var(--panel)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                    <div>
                      <strong style={{ fontSize: "13px", color: "var(--ink)" }}>{step.order + 1}. {step.title}</strong>
                      <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px", lineHeight: 1.5 }}>{step.description}</p>
                    </div>
                    <div style={{ display: "grid", gap: "6px", justifyItems: "end" }}>
                      <span style={{ ...pillStyle, background: "rgba(59,130,246,0.12)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.24)" }}>{step.agent}</span>
                      <span style={{ ...pillStyle, ...toneForRisk(step.riskLevel) }}>{step.tool}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--faint)", marginTop: "8px" }}>
                    estado: {step.status} · approval: {step.approvalRequired ? "requerido" : "no"} · verificación: {step.verificationRule ?? "n/a"}
                  </p>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px" }}>
              <div style={{ border: "1px solid var(--border)", borderRadius: "14px", padding: "14px", background: "var(--panel)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <strong style={{ fontSize: "13px", color: "var(--ink)" }}>Bitácora</strong>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>{filteredLogs.length} eventos</span>
                </div>
                {filteredLogs.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--muted)" }}>Sin logs todavía.</p>
                ) : (
                  <div style={{ display: "grid", gap: "8px" }}>
                    {filteredLogs.map((log) => (
                      <div key={log.id} style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "10px", background: "var(--surface)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                          <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{log.action}</strong>
                          <span style={{ ...pillStyle, ...toneForStatus(log.status) }}>{log.status}</span>
                        </div>
                        <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px", lineHeight: 1.45 }}>{log.outputSummary ?? log.inputSummary}</p>
                        <p style={{ fontSize: "10px", color: "var(--faint)", marginTop: "6px" }}>{stepLabel(stepMap, log.stepId)} · {log.agent} · {log.tool} · {formatDate(log.timestamp)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ border: "1px solid var(--border)", borderRadius: "14px", padding: "14px", background: "var(--panel)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <strong style={{ fontSize: "13px", color: "var(--ink)" }}>Validaciones</strong>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>{filteredValidations.length} checks</span>
                </div>
                {filteredValidations.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--muted)" }}>Sin validaciones todavía.</p>
                ) : (
                  <div style={{ display: "grid", gap: "8px" }}>
                    {filteredValidations.map((validation) => (
                      <div key={validation.id} style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "10px", background: "var(--surface)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                          <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{validation.name}</strong>
                          <span style={{ ...pillStyle, ...toneForStatus(validation.status) }}>{validation.status}</span>
                        </div>
                        <p style={{ fontSize: "10px", color: "var(--faint)", marginTop: "6px" }}>{stepLabel(stepMap, validation.stepId)}</p>
                        <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px", lineHeight: 1.45 }}>{validation.details ?? "Sin detalle."}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ border: "1px solid var(--border)", borderRadius: "14px", padding: "14px", background: "var(--panel)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <strong style={{ fontSize: "13px", color: "var(--ink)" }}>Artefactos</strong>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>{filteredArtifacts.length} items</span>
                </div>
                {filteredArtifacts.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--muted)" }}>Sin artefactos todavía.</p>
                ) : (
                  <div style={{ display: "grid", gap: "8px" }}>
                    {filteredArtifacts.map((artifact) => (
                      <div key={artifact.id} style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "10px", background: "var(--surface)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                          <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{artifact.label}</strong>
                          <span style={{ ...pillStyle, background: "rgba(59,130,246,0.12)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.24)" }}>{artifact.type}</span>
                        </div>
                        <p style={{ fontSize: "10px", color: "var(--faint)", marginTop: "6px" }}>{stepLabel(stepMap, artifact.stepId)}</p>
                        <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px", lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {artifact.contentSnippet ?? artifact.uri ?? "Sin contenido."}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ border: "1px solid var(--border)", borderRadius: "14px", padding: "14px", background: "var(--panel)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <strong style={{ fontSize: "13px", color: "var(--ink)" }}>Approvals</strong>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>{pendingApprovals.length} pendientes</span>
                </div>
                {approvals.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--muted)" }}>Sin approvals requeridos.</p>
                ) : (
                  <div style={{ display: "grid", gap: "8px" }}>
                    {approvals.map((approval) => {
                      const resolved = Boolean(approval.decision);
                      return (
                        <div key={approval.request.id} style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "10px", background: "var(--surface)" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                            <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{approval.request.title}</strong>
                            <span style={{ ...pillStyle, ...(resolved ? toneForStatus(approval.decision?.approved ? "ok" : "warning") : toneForRisk(approval.request.riskLevel)) }}>
                              {resolved ? (approval.decision?.approved ? "approved" : "rejected") : "pending"}
                            </span>
                          </div>
                          <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px", lineHeight: 1.45 }}>{approval.request.actionPreview}</p>
                          <p style={{ fontSize: "10px", color: "var(--faint)", marginTop: "6px" }}>
                            {approval.request.reason}
                          </p>
                          {approval.decision ? (
                            <p style={{ fontSize: "10px", color: "var(--faint)", marginTop: "6px" }}>
                              {approval.decision.decidedBy} · {formatDate(approval.decision.decidedAt)} · {approval.decision.comment ?? "sin comentario"}
                            </p>
                          ) : (
                            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                              <button
                                onClick={() => void handleApprovalResponse(approval.request.id, true)}
                                disabled={resolvingApprovalId === approval.request.id}
                                style={{
                                  border: "1px solid rgba(16,185,129,0.28)",
                                  background: "rgba(16,185,129,0.12)",
                                  color: "#86efac",
                                  borderRadius: "8px",
                                  padding: "6px 10px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                Aprobar
                              </button>
                              <button
                                onClick={() => void handleApprovalResponse(approval.request.id, false)}
                                disabled={resolvingApprovalId === approval.request.id}
                                style={{
                                  border: "1px solid rgba(239,68,68,0.28)",
                                  background: "rgba(239,68,68,0.12)",
                                  color: "#fca5a5",
                                  borderRadius: "8px",
                                  padding: "6px 10px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                Rechazar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: "14px", padding: "14px", background: "var(--panel)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <strong style={{ fontSize: "13px", color: "var(--ink)" }}>Terminal</strong>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>{filteredCommandOutputArtifacts.length} outputs</span>
              </div>
              <div style={{ display: "grid", gap: "10px" }}>
                <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", background: "#071018" }}>
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(148,163,184,0.12)", color: "#93c5fd", fontSize: "11px", fontWeight: 700 }}>
                    runtime-feed
                  </div>
                  <div style={{ maxHeight: "260px", overflow: "auto", padding: "10px 12px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "11px", display: "grid", gap: "4px" }}>
                    {filteredLogs.length === 0 ? (
                      <span style={{ color: "#94a3b8" }}>Sin salida todavía.</span>
                    ) : [...filteredLogs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((log) => {
                      const isProgress = log.action === "step.progress";
                      const isError = log.status === "error";
                      const isWarning = log.status === "warning";
                      const lineColor = isError ? "#fca5a5" : isWarning ? "#fde047" : isProgress ? "#94a3b8" : "#d1fae5";
                      return (
                        <span key={log.id} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: lineColor, opacity: isProgress ? 0.7 : 1, fontStyle: isProgress ? "italic" : "normal" }}>
                          <span style={{ color: "#475569", userSelect: "none" }}>[{formatDate(log.timestamp)}] </span>
                          <span style={{ color: "#64748b" }}>{log.action} </span>
                          {log.outputSummary ?? log.inputSummary}
                        </span>
                      );
                    })}
                  </div>
                </div>
                {filteredCommandOutputArtifacts.length > 0 ? (
                  <div style={{ display: "grid", gap: "8px" }}>
                    {Object.entries(commandArtifactsByStep)
                      .filter(([stepId]) => selectedStepFilter === "all" || stepId === selectedStepFilter)
                      .map(([stepId, items]) => (
                      <div key={stepId} style={{ display: "grid", gap: "8px" }}>
                        <strong style={{ fontSize: "11px", color: "#93c5fd" }}>{stepLabel(stepMap, stepId)}</strong>
                        {items.map((artifact) => (
                          <div key={artifact.id} style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", background: "#020617" }}>
                            <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(148,163,184,0.12)", color: "#f8fafc", fontSize: "11px", fontWeight: 700 }}>
                              {artifact.label}
                            </div>
                            <div style={{ maxHeight: "260px", overflow: "auto", padding: "10px 12px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "11px", display: "grid", gap: "2px" }}>
                              {(artifact.contentSnippet ?? "Sin salida.").split("\n").map((line, lineIndex) => (
                                <span key={`${artifact.id}-${lineIndex}`} style={{ color: terminalLineTone(line), whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{line || " "}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: "14px", padding: "14px", background: "var(--panel)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <strong style={{ fontSize: "13px", color: "var(--ink)" }}>Diff Viewer</strong>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>{filteredDiffArtifacts.length} cambios</span>
              </div>
              {filteredDiffArtifacts.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--muted)" }}>Sin cambios de archivo todavía.</p>
              ) : (
                <div style={{ display: "grid", gap: "12px" }}>
                  {Object.entries(diffArtifactsByStep)
                    .filter(([stepId]) => selectedStepFilter === "all" || stepId === selectedStepFilter)
                    .map(([stepId, items]) => (
                    <div key={stepId} style={{ display: "grid", gap: "10px" }}>
                      <strong style={{ fontSize: "11px", color: "var(--muted)" }}>{stepLabel(stepMap, stepId)}</strong>
                      {items.map((artifact) => {
                        const lines = (artifact.contentSnippet ?? "").split("\n");
                        return (
                          <div key={artifact.id} style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", background: "var(--surface)" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                              <strong style={{ fontSize: "12px", color: "var(--ink)" }}>{artifact.label}</strong>
                              <span style={{ ...pillStyle, background: "rgba(96,165,250,0.12)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.24)" }}>{artifact.type}</span>
                            </div>
                            <div style={{ maxHeight: "280px", overflow: "auto", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "11px" }}>
                              {lines.map((line, index) => {
                                const tone = diffTone(line);
                                return (
                                  <div
                                    key={`${artifact.id}-${index}`}
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "48px 1fr",
                                      gap: "12px",
                                      padding: "4px 12px",
                                      background: tone.background,
                                      color: tone.color,
                                      borderBottom: index === lines.length - 1 ? "none" : "1px solid rgba(148,163,184,0.06)",
                                    }}
                                  >
                                    <span style={{ color: "var(--faint)", textAlign: "right", userSelect: "none" }}>{index + 1}</span>
                                    <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{line || " "}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  borderRadius: "10px",
  border: "1px solid var(--border)",
  background: "var(--panel)",
  color: "var(--ink)",
  fontSize: "13px",
  padding: "10px 12px",
} as const;

const sectionLabelStyle = {
  fontSize: "12px",
  color: "var(--muted)",
  marginBottom: "8px",
  fontWeight: 700,
} as const;

const pillStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  borderRadius: "999px",
  padding: "5px 9px",
  fontSize: "11px",
  fontWeight: 700,
} as const;

const secondaryButtonStyle = {
  border: "1px solid var(--border)",
  background: "var(--panel)",
  color: "var(--muted)",
  borderRadius: "8px",
  padding: "6px 10px",
  fontSize: "11px",
  fontWeight: 700,
  cursor: "pointer",
} as const;

const ghostDangerButtonStyle = {
  border: "1px solid rgba(239,68,68,0.2)",
  background: "rgba(239,68,68,0.08)",
  color: "#fca5a5",
  borderRadius: "8px",
  padding: "5px 9px",
  fontSize: "10px",
  fontWeight: 700,
  cursor: "pointer",
} as const;

const metricCardStyle = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  padding: "12px",
  display: "grid",
  gap: "6px",
} as const;

const metricLabelStyle = {
  fontSize: "11px",
  color: "var(--muted)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
} as const;

const metricValueStyle = {
  fontSize: "16px",
  color: "var(--ink)",
  fontWeight: 800,
} as const;
