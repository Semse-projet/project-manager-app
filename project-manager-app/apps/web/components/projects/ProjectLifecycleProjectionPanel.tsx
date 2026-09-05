"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProjectLifecycleProjection } from "@semse/schemas";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  RefreshCw,
} from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { fetchProjectLifecycleProjection } from "@/app/lib/buildops-api";

type Props = {
  projectId: string | null | undefined;
  refreshKey?: number;
};

const SEVERITY_VARIANT: Record<
  ProjectLifecycleProjection["blockers"][number]["severity"],
  "error" | "warn" | "info"
> = {
  critical: "error",
  high: "error",
  medium: "warn",
  low: "info",
};

const OWNER_LABEL: Record<ProjectLifecycleProjection["nextAction"]["owner"], string> = {
  client: "cliente",
  professional: "profesional",
  ops: "operaciones",
  system: "sistema",
};

function money(value: number, currency: string | null): string {
  if (!currency) {
    return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(value);
  }
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function date(value: string | null): string {
  return value
    ? new Date(value).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Sin fecha";
}

export function ProjectLifecycleProjectionPanel({ projectId, refreshKey = 0 }: Props) {
  const [projection, setProjection] = useState<ProjectLifecycleProjection | null>(null);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) {
      setProjection(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setProjection(await fetchProjectLifecycleProjection(projectId));
    } catch (loadError) {
      setProjection(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar la proyección.",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (!projectId) {
    return (
      <Card className="grid gap-2 border-dashed border-white/[0.12] bg-white/[0.02]">
        <h2 className="text-lg font-semibold text-ink">Ciclo de vida canónico</h2>
        <p className="text-sm text-muted">
          Estará disponible después de promover este plan BuildOps al proyecto operativo.
        </p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="h-48 animate-pulse bg-white/[0.03]" aria-label="Cargando proyección">
        <span className="sr-only">Cargando proyección</span>
      </Card>
    );
  }

  if (error || !projection) {
    return (
      <Card className="grid gap-3 border-dashed border-white/[0.12] bg-white/[0.02]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Ciclo de vida canónico</h2>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 rounded-lg border border-white/[0.12] px-2 py-1 text-xs text-muted hover:text-ink"
          >
            <RefreshCw size={13} /> Reintentar
          </button>
        </div>
        <p className="text-sm text-muted">
          La proyección todavía no está habilitada o disponible para este proyecto.
        </p>
      </Card>
    );
  }

  const topBlocker = projection.blockers[0];
  const revision = projection.revision.split(":").at(-1)?.slice(0, 12) ?? "actual";

  return (
    <Card className="grid gap-5 border-brand/20 bg-brand/[0.035]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-brand" />
            <h2 className="text-lg font-semibold text-ink">Ciclo de vida canónico</h2>
          </div>
          <p className="mt-1 text-xs text-muted">
            Revisión {revision} · fuente actualizada {date(projection.sourceUpdatedAt)}
          </p>
        </div>
        <Badge variant={topBlocker ? SEVERITY_VARIANT[topBlocker.severity] : "success"}>
          {topBlocker ? `${projection.blockers.length} bloqueo(s)` : "Sin bloqueos"}
        </Badge>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Avance de hitos</span>
          <strong className="text-ink">{projection.progress.percentage}%</strong>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${projection.progress.percentage}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted">
          <span>
            {projection.progress.milestones.completed}/{projection.progress.milestones.total} completados
          </span>
          <span>{projection.progress.milestones.paid} pagados</span>
          <span>{projection.progress.milestones.awaitingReview} en revisión</span>
          <span>{projection.progress.evidence.missingRequired} evidencias requeridas faltantes</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Planificado", value: projection.financial.planned },
          { label: "Gastos aprobados", value: projection.financial.actualExpenses },
          { label: "Liberado", value: projection.financial.released },
          { label: "Disponible", value: projection.financial.available },
        ].map((item) => (
          <div
            key={item.label}
            className="grid gap-1 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"
          >
            <span className="flex items-center gap-1 text-xs text-muted">
              <CircleDollarSign size={13} /> {item.label}
            </span>
            <strong className="text-sm text-ink">
              {money(item.value, projection.financial.currency)}
            </strong>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
          <span className="flex items-center gap-1 text-xs text-muted">
            <CalendarClock size={13} /> Entrega
          </span>
          <strong className="text-sm text-ink">{date(projection.project.dueAt)}</strong>
        </div>
        <div className="grid gap-1 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
          <span className="text-xs text-muted">Riesgo operativo</span>
          <strong className="text-sm text-ink">
            {projection.risk
              ? `${projection.risk.overallScore}/100 · ${projection.risk.level}`
              : "Sin evaluación"}
          </strong>
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-brand/20 bg-brand/[0.06] p-4">
        <span className="text-xs uppercase tracking-[0.16em] text-muted">Próxima acción</span>
        <div className="flex items-start gap-2">
          <AlertTriangle
            size={16}
            className={topBlocker ? "mt-0.5 text-amber-300" : "mt-0.5 text-brand"}
          />
          <div className="grid gap-1">
            <strong className="text-sm text-ink">{projection.nextAction.label}</strong>
            <span className="text-xs text-muted">
              Responsable: {OWNER_LABEL[projection.nextAction.owner]}
            </span>
          </div>
        </div>
      </div>

      {projection.blockers.length > 0 ? (
        <div className="grid gap-2">
          <span className="text-xs uppercase tracking-[0.16em] text-muted">
            Bloqueadores detectados
          </span>
          {projection.blockers.slice(0, 4).map((blocker) => (
            <div key={blocker.code} className="flex items-start gap-2 text-sm text-muted">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
              <span>{blocker.message}</span>
            </div>
          ))}
        </div>
      ) : null}

      {!projection.sources.complete ? (
        <p className="text-xs text-muted">
          Fuentes pendientes: {projection.sources.missing.join(", ")}.
        </p>
      ) : null}
    </Card>
  );
}
