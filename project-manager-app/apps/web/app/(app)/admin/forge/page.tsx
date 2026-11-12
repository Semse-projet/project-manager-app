"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertOctagon, ChevronRight, Hammer, Plus, RefreshCw, Search } from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import {
  createForgeRun,
  fetchForgeMissionControl,
  fetchForgeRuns,
  type ForgeMissionControl,
  type ForgeRun,
  type ForgeSpecStatus
} from "../../../lib/module-surfaces-api";
import {
  Banner,
  Button,
  Empty,
  Field,
  Loading,
  Panel,
  Pill,
  Stat,
  StatGrid,
  formatDate,
  inputStyle
} from "../../../../components/module-surface/ui";
import { RUN_STATE, runStateMeta } from "../../../../components/forge/forge-vocab";

// Spec: docs/specs/forge/SEMSE_FORGE_SDD.spec.md + docs/specs/fsm/forge-run-lifecycle.spec.md (APPROVED).
const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "attention", label: "Requieren atención" },
  { id: "active", label: "En curso" },
  { id: "done", label: "Cerrados" }
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const ATTENTION = new Set(["blocked", "rolled_back", "spec_review", "ready_for_review"]);
const DONE = new Set(["closed"]);

function matches(run: ForgeRun, filter: FilterId, query: string) {
  const q = query.trim().toLowerCase();
  if (q && !`${run.title} ${run.spec.id} ${run.spec.path}`.toLowerCase().includes(q)) return false;
  if (filter === "attention") return ATTENTION.has(run.state) || run.approvals.some((a) => a.status === "pending");
  if (filter === "active") return !ATTENTION.has(run.state) && !DONE.has(run.state);
  if (filter === "done") return DONE.has(run.state);
  return true;
}

export default function AdminForgePage() {
  const [summary, setSummary] = useState<ForgeMissionControl | null>(null);
  const [runs, setRuns] = useState<ForgeRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mc, list] = await Promise.all([fetchForgeMissionControl(), fetchForgeRuns()]);
      setSummary(mc);
      setRuns(list ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar Forge");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => [...runs].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).filter((r) => matches(r, filter, query)),
    [runs, filter, query]
  );

  const byState = useMemo(() => {
    const counts = new Map<string, number>();
    runs.forEach((r) => counts.set(r.state, (counts.get(r.state) ?? 0) + 1));
    return counts;
  }, [runs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <AdminPageHeader
        title="SEMSE Forge"
        subtitle="Runs de construcción gobernados por spec: de la idea al despliegue, con aprobaciones humanas y trazabilidad de cada agente."
        icon={Hammer}
        iconColor="var(--accent)"
        iconBg="var(--accent-dim)"
        backHref="/admin/intelligence"
        backLabel="Intelligence"
      />
      <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, marginTop: -8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Button icon={RefreshCw} onClick={() => void load()} busy={loading}>
            Actualizar
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
            Nuevo run
          </Button>
        </div>
      </div>

      {error ? <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner> : null}

      <StatGrid>
        <Stat label="Runs totales" value={summary?.total ?? "—"} />
        <Stat label="Aprobaciones pendientes" value={summary?.pendingApprovals ?? "—"} tone={summary?.pendingApprovals ? "warn" : "muted"} hint="Spec en revisión o listo para revisión" />
        <Stat label="Listos para revisión" value={summary?.readyForReview ?? "—"} tone="brand" />
        <Stat label="Bloqueados" value={summary?.blocked ?? "—"} tone={summary?.blocked ? "error" : "muted"} />
      </StatGrid>

      {showCreate ? (
        <CreateRunPanel
          onCancel={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      ) : null}

      <Panel
        title="Runs"
        icon={Hammer}
        padded={false}
        actions={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 9, top: 9, color: "var(--faint)" }} aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar título o spec"
                aria-label="Buscar runs"
                style={{ ...inputStyle, width: 200, paddingLeft: 28 }}
              />
            </div>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "1px solid var(--border)",
                  background: filter === f.id ? "var(--brand-dim)" : "transparent",
                  color: filter === f.id ? "var(--brand)" : "var(--muted)"
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        {loading && runs.length === 0 ? (
          <Loading label="Cargando runs…" />
        ) : visible.length === 0 ? (
          <Empty
            icon={Hammer}
            title={runs.length ? "Ningún run coincide con el filtro" : "Todavía no hay runs de Forge"}
            description={runs.length ? undefined : "Crea un run a partir de un spec aprobado para que los agentes planifiquen, construyan y verifiquen el cambio."}
            action={runs.length ? undefined : <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>Nuevo run</Button>}
          />
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {visible.map((run) => {
              const meta = runStateMeta(run.state);
              const pending = run.approvals.filter((a) => a.status === "pending").length;
              const done = run.tasks.filter((t) => t.status === "succeeded").length;
              return (
                <li key={run.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <Link
                    href={`/admin/forge/${encodeURIComponent(run.id)}`}
                    style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, padding: "12px 16px", textDecoration: "none", alignItems: "center" }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ color: "var(--ink)", fontSize: 14 }}>{run.title}</strong>
                        <Pill tone={meta.tone}>{meta.label}</Pill>
                        {pending ? <Pill tone="warn" icon={AlertOctagon}>{pending} aprobación(es)</Pill> : null}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {run.spec.id} · {run.spec.path}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12, color: "var(--muted)" }}>
                      <span title="Tareas completadas">{done}/{run.tasks.length} tareas</span>
                      <span>{formatDate(run.updatedAt, true)}</span>
                      <ChevronRight size={14} aria-hidden />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {runs.length > 0 ? (
        <Panel title="Distribución por estado" icon={Hammer}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(RUN_STATE).map(([state, meta]) =>
              byState.get(state) ? (
                <Pill key={state} tone={meta.tone}>
                  {meta.label}: {byState.get(state)}
                </Pill>
              ) : null
            )}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function CreateRunPanel({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [specId, setSpecId] = useState("");
  const [specPath, setSpecPath] = useState("docs/specs/");
  const [digest, setDigest] = useState("");
  const [status, setStatus] = useState<ForgeSpecStatus>("APPROVED");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Panel title="Nuevo run de Forge" icon={Plus}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await createForgeRun({ title: title.trim(), spec: { id: specId.trim(), path: specPath.trim(), digest: digest.trim(), status } });
            onCreated();
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo crear el run");
          } finally {
            setBusy(false);
          }
        }}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <Field label="Título">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required style={inputStyle} placeholder="Ej. Pantallas de liens" />
          </Field>
          <Field label="ID del spec" hint="Tal como aparece en docs/SPEC_INDEX.md">
            <input value={specId} onChange={(e) => setSpecId(e.target.value)} required style={inputStyle} placeholder="tools.lien-rights-management" />
          </Field>
          <Field label="Ruta del spec">
            <input value={specPath} onChange={(e) => setSpecPath(e.target.value)} required style={inputStyle} />
          </Field>
          <Field label="Digest del spec" hint="sha256 del archivo, para fijar la versión revisada">
            <input value={digest} onChange={(e) => setDigest(e.target.value)} required style={inputStyle} placeholder="sha256:…" />
          </Field>
          <Field label="Estado del spec">
            <select value={status} onChange={(e) => setStatus(e.target.value as ForgeSpecStatus)} style={inputStyle}>
              {(["DRAFT", "REVIEW", "APPROVED", "IMPLEMENTED", "VERIFIED"] as const).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {status === "DRAFT" || status === "REVIEW" ? (
          <Banner tone="warn">Un spec en {status} no autoriza implementación: la política de Forge rechaza toda acción de agentes que no sea de spec (policy.spec.must_be_approved) hasta que el spec esté APPROVED.</Banner>
        ) : null}
        {error ? <Banner tone="error">{error}</Banner> : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" icon={Plus} busy={busy}>
            Crear run
          </Button>
        </div>
      </form>
    </Panel>
  );
}
