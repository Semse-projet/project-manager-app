"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  Ban,
  Bot,
  CheckCircle2,
  FileText,
  GitBranch,
  Hammer,
  ListChecks,
  Play,
  RefreshCw,
  ShieldCheck,
  Undo2,
  XCircle
} from "lucide-react";
import { AdminPageHeader } from "../../../../components/admin/AdminPageHeader";
import {
  FORGE_RUN_TRANSITIONS,
  decideForgeApproval,
  dispatchNextForgeTask,
  fetchForgeRun,
  fetchForgeRunnableTasks,
  transitionForgeRun,
  type ForgeApproval,
  type ForgeRun,
  type ForgeRunState,
  type ForgeTask
} from "../../../../lib/module-surfaces-api";
import {
  Banner,
  Button,
  ConfirmDialog,
  Empty,
  Loading,
  Panel,
  Pill,
  formatDate,
  shortId,
  toneColor,
  toneFill
} from "../../../../../components/module-surface/ui";
import { APPROVAL_LABEL, RISK_TONE, RUN_PHASES, TASK_STATUS, runStateMeta } from "../../../../../components/forge/forge-vocab";

// Transitions that leave the happy path deserve an explicit confirmation.
const DESTRUCTIVE: ReadonlySet<ForgeRunState> = new Set(["blocked", "rolled_back", "closed"]);

export default function ForgeRunDetailPage() {
  const params = useParams<{ runId: string }>();
  const runId = decodeURIComponent(params.runId);

  const [run, setRun] = useState<ForgeRun | null>(null);
  const [runnable, setRunnable] = useState<ForgeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmNext, setConfirmNext] = useState<ForgeRunState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, ready] = await Promise.all([
        fetchForgeRun(runId),
        fetchForgeRunnableTasks(runId).catch(() => [] as ForgeTask[])
      ]);
      setRun(detail);
      setRunnable(ready ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el run");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(key: string, task: () => Promise<unknown>, ok: string) {
    setBusy(key);
    setError(null);
    setFlash(null);
    try {
      await task();
      setFlash(ok);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "La acción falló");
    } finally {
      setBusy(null);
    }
  }

  const transition = (next: ForgeRunState) =>
    act(`t:${next}`, () => transitionForgeRun(runId, next), `Run movido a «${runStateMeta(next).label}».`);

  const events = useMemo(
    () => [...(run?.events ?? [])].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)),
    [run]
  );

  if (loading && !run) return <Loading label="Cargando run…" />;

  if (!run) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <AdminPageHeader title="Run no encontrado" icon={Hammer} backHref="/admin/forge" backLabel="Forge" />
        {error ? <Banner tone="error">{error}</Banner> : null}
      </div>
    );
  }

  const meta = runStateMeta(run.state);
  const nextStates = FORGE_RUN_TRANSITIONS[run.state] ?? [];
  const pendingApprovals = run.approvals.filter((a) => a.status === "pending");
  const runnableIds = new Set(runnable.map((t) => t.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <AdminPageHeader
        title={run.title}
        subtitle={
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Pill tone={meta.tone}>{meta.label}</Pill>
            <span>Run {shortId(run.id, 12)} · actualizado {formatDate(run.updatedAt, true)}</span>
          </span>
        }
        icon={Hammer}
        iconColor="var(--accent)"
        iconBg="var(--accent-dim)"
        backHref="/admin/forge"
        backLabel="Forge"
      />
      <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, marginTop: -8 }}>
        <Button icon={RefreshCw} onClick={() => void load()} busy={loading}>
          Actualizar
        </Button>
      </div>

      {error ? <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner> : null}
      {flash ? <Banner tone="ok" onDismiss={() => setFlash(null)}>{flash}</Banner> : null}

      <LifecycleStepper state={run.state} />

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))" }}>
        <Panel title="Siguiente paso" icon={ArrowRight}>
          {nextStates.length === 0 ? (
            <Empty icon={CheckCircle2} title="Run cerrado" description="Este run llegó a su estado final y no admite más transiciones." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                Transiciones permitidas desde <strong style={{ color: "var(--ink)" }}>{meta.label}</strong>. La API valida cada transición
                contra la máquina de estados y registra el evento en la auditoría.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {nextStates.map((next) => {
                  const nextMeta = runStateMeta(next);
                  const risky = DESTRUCTIVE.has(next);
                  return (
                    <Button
                      key={next}
                      variant={risky ? "danger" : "secondary"}
                      icon={next === "blocked" ? Ban : next === "rolled_back" ? Undo2 : ArrowRight}
                      busy={busy === `t:${next}`}
                      onClick={() => (risky ? setConfirmNext(next) : void transition(next))}
                    >
                      {nextMeta.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Aprobaciones" icon={ShieldCheck}>
          {run.approvals.length === 0 ? (
            <Empty icon={ShieldCheck} title="Sin aprobaciones requeridas" description="La política de Forge no pidió revisión humana para este run todavía." />
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {run.approvals.map((approval, index) => (
                <ApprovalRow
                  key={`${approval.mode}-${index}`}
                  approval={approval}
                  busy={busy}
                  onDecide={(decision) =>
                    act(
                      `a:${approval.mode}:${decision}`,
                      () => decideForgeApproval(runId, approval.mode, decision),
                      decision === "approved" ? "Aprobación registrada." : "Aprobación rechazada."
                    )
                  }
                />
              ))}
            </ul>
          )}
          {pendingApprovals.length > 0 ? (
            <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--faint)" }}>
              Quien originó la acción no puede aprobarla; el doble control requiere dos aprobadores distintos.
            </p>
          ) : null}
        </Panel>

        <Panel title="Spec gobernante" icon={FileText}>
          <dl style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: "6px 12px", margin: 0, fontSize: 13 }}>
            <dt style={{ color: "var(--muted)" }}>ID</dt>
            <dd style={{ margin: 0, color: "var(--ink)", wordBreak: "break-all" }}>{run.spec.id}</dd>
            <dt style={{ color: "var(--muted)" }}>Ruta</dt>
            <dd style={{ margin: 0, color: "var(--ink)", wordBreak: "break-all", fontFamily: "var(--font-mono)", fontSize: 12 }}>{run.spec.path}</dd>
            <dt style={{ color: "var(--muted)" }}>Estado</dt>
            <dd style={{ margin: 0 }}>
              <Pill tone={run.spec.status === "APPROVED" || run.spec.status === "VERIFIED" ? "ok" : run.spec.status === "IMPLEMENTED" ? "brand" : "warn"}>
                {run.spec.status}
              </Pill>
            </dd>
            <dt style={{ color: "var(--muted)" }}>Digest</dt>
            <dd style={{ margin: 0, color: "var(--muted)", wordBreak: "break-all", fontFamily: "var(--font-mono)", fontSize: 11 }}>{run.spec.digest}</dd>
          </dl>
        </Panel>
      </div>

      <Panel
        title={`Tareas (${run.tasks.length})`}
        icon={ListChecks}
        padded={run.tasks.length === 0}
        actions={
          <Button
            variant="primary"
            icon={Play}
            disabled={runnable.length === 0}
            busy={busy === "dispatch"}
            title={runnable.length ? "Encola la tarea lista de mayor prioridad" : "No hay tareas listas para ejecutar"}
            onClick={() => void act("dispatch", () => dispatchNextForgeTask(runId), "Siguiente tarea despachada a la cola de agentes.")}
          >
            Despachar siguiente ({runnable.length})
          </Button>
        }
      >
        {run.tasks.length === 0 ? (
          <Empty icon={ListChecks} title="Sin tareas todavía" description="Las tareas se agregan cuando el run se planifica a partir del spec." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>
                  {["Tarea", "Rol", "Riesgo", "Estado", "Dependencias", "Rama / entorno"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...run.tasks]
                  .sort((a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER))
                  .map((task) => {
                    const status = TASK_STATUS[task.status ?? "pending"] ?? TASK_STATUS.pending;
                    return (
                      <tr key={task.id} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                        <td style={{ padding: "10px 16px", minWidth: 220 }}>
                          <div style={{ fontWeight: 600, color: "var(--ink)" }}>{task.title}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{task.objective}</div>
                        </td>
                        <td style={{ padding: "10px 16px", color: "var(--ink)" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                            <Bot size={12} style={{ color: "var(--muted)", flexShrink: 0 }} aria-hidden />
                            {task.requestedRole}
                          </span>
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <Pill tone={RISK_TONE[task.riskLevel] ?? "muted"}>{task.riskLevel}</Pill>
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            <Pill tone={status.tone}>{status.label}</Pill>
                            {runnableIds.has(task.id) ? <Pill tone="brand">Ejecutable</Pill> : null}
                          </div>
                        </td>
                        <td style={{ padding: "10px 16px", color: "var(--muted)", fontSize: 12 }}>
                          {task.dependencies.length ? task.dependencies.join(", ") : "—"}
                        </td>
                        <td style={{ padding: "10px 16px", color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <GitBranch size={12} style={{ flexShrink: 0 }} aria-hidden />
                            {task.targetBranch}
                          </span>
                          <div>{task.environment}</div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))" }}>
        <Panel title="Agentes asignados" icon={Bot}>
          {Object.keys(run.assignedAgents).length === 0 ? (
            <Empty icon={Bot} title="Sin agentes asignados" />
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {Object.entries(run.assignedAgents).map(([role, agents]) => (
                <li key={role} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                  <span style={{ color: "var(--ink)", fontWeight: 600 }}>{role}</span>
                  <span style={{ color: "var(--muted)", textAlign: "right" }}>{agents.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
          {run.agentRunIds.length ? (
            <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--faint)" }}>{run.agentRunIds.length} ejecución(es) de agente vinculadas.</p>
          ) : null}
        </Panel>

        <Panel title="Bitácora" icon={FileText}>
          {events.length === 0 ? (
            <Empty icon={FileText} title="Sin eventos" />
          ) : (
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10, maxHeight: 420, overflowY: "auto" }}>
              {events.map((event) => (
                <li key={event.id} style={{ display: "grid", gridTemplateColumns: "10px minmax(0,1fr)", gap: 10 }}>
                  <span style={{ width: 8, height: 8, marginTop: 5, borderRadius: 99, background: event.type.includes("BLOCKED") || event.type.includes("ROLLED") ? "var(--error)" : "var(--brand)" }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-mono)" }}>{event.type}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {formatDate(event.timestamp, true)} · {event.actor}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={Boolean(confirmNext)}
        title={`Mover el run a «${confirmNext ? runStateMeta(confirmNext).label : ""}»`}
        confirmLabel="Confirmar"
        tone="error"
        busy={Boolean(confirmNext && busy === `t:${confirmNext}`)}
        onCancel={() => setConfirmNext(null)}
        onConfirm={() => {
          if (!confirmNext) return;
          const next = confirmNext;
          setConfirmNext(null);
          void transition(next);
        }}
      >
        {confirmNext === "closed"
          ? "Cerrar el run es definitivo: no admite más transiciones."
          : confirmNext === "rolled_back"
            ? "Marca el run como revertido. Desde ahí solo puede volver a «Spec borrador», a «Planificado» o cerrarse."
            : "Bloquea el run. Para continuar habrá que moverlo de vuelta a un estado anterior del ciclo."}
      </ConfirmDialog>
    </div>
  );
}

function LifecycleStepper({ state }: { state: ForgeRunState }) {
  const meta = runStateMeta(state);
  const offPath = meta.phase < 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${RUN_PHASES.length}, minmax(0, 1fr))`,
        gap: 6,
        padding: 14,
        borderRadius: 14,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        position: "relative"
      }}
      aria-label={`Fase actual: ${meta.label}`}
    >
      {RUN_PHASES.map((phase, i) => {
        const done = !offPath && i < meta.phase;
        const current = !offPath && i === meta.phase;
        const tone = done ? "ok" : current ? meta.tone : "muted";
        return (
          <div key={phase} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, opacity: offPath ? 0.45 : 1 }}>
            <div style={{ height: 6, borderRadius: 99, background: done || current ? toneColor(tone) : toneFill("muted", 25) }} />
            <span
              style={{
                fontSize: 11,
                fontWeight: current ? 800 : 600,
                color: current ? toneColor(tone) : "var(--muted)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {phase}
            </span>
          </div>
        );
      })}
      {offPath ? (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <Pill tone="error" icon={state === "blocked" ? Ban : Undo2}>
            {meta.label}
          </Pill>
        </div>
      ) : null}
    </div>
  );
}

function ApprovalRow({
  approval,
  busy,
  onDecide
}: {
  approval: ForgeApproval;
  busy: string | null;
  onDecide: (decision: "approved" | "rejected") => void;
}) {
  const tone = approval.status === "approved" ? "ok" : approval.status === "rejected" ? "error" : "warn";
  const needed = approval.mode === "dual_control" ? 2 : 1;
  return (
    <li style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12, background: "var(--bg)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ flex: 1, fontSize: 13, color: "var(--ink)" }}>{APPROVAL_LABEL[approval.mode] ?? approval.mode}</strong>
        <Pill tone={tone}>{approval.status === "pending" ? "Pendiente" : approval.status === "approved" ? "Aprobada" : "Rechazada"}</Pill>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
        {approval.approvedBy?.length ?? 0}/{needed} aprobador(es)
        {approval.requestedBy ? ` · solicitada por ${approval.requestedBy}` : ""}
        {approval.at ? ` · ${formatDate(approval.at, true)}` : ""}
      </div>
      {approval.status === "pending" ? (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Button variant="primary" icon={CheckCircle2} busy={busy === `a:${approval.mode}:approved`} onClick={() => onDecide("approved")}>
            Aprobar
          </Button>
          <Button variant="danger" icon={XCircle} busy={busy === `a:${approval.mode}:rejected`} onClick={() => onDecide("rejected")}>
            Rechazar
          </Button>
        </div>
      ) : null}
    </li>
  );
}
