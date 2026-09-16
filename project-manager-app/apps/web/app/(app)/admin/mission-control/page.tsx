"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";

type MissionControlAction =
  | "ACKNOWLEDGE"
  | "RESOLVE"
  | "DISMISS"
  | "PAUSE"
  | "RESUME"
  | "RETRY"
  | "REQUEUE"
  | "REPLAY"
  | "ESCALATE";

type MissionControlException = {
  exceptionId: string;
  source: string;
  targetType: string;
  targetId: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  status: "open" | "acknowledged" | "failed" | "dead_letter" | "pending_approval";
  title: string;
  summary: string;
  occurredAt: string;
  correlationId: string | null;
  availableActions: MissionControlAction[];
  runbookIds: string[];
  deepLink: string;
};

type MissionControlRunbook = {
  id: string;
  version: string;
  title: string;
  allowedActions: MissionControlAction[];
  targetTypes: string[];
  documentationPath: string;
  risk: "low" | "medium" | "high" | "critical";
};

type ExceptionsPayload = {
  enabled: boolean;
  items: MissionControlException[];
  nextCursor: string | null;
  counts: {
    total: number;
    bySource: Record<string, number>;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
  };
  sourceErrors: Array<{ source: string; code: string }>;
  generatedAt: string;
};

type Receipt = {
  id: string;
  status: "RUNNING" | "SUCCEEDED" | "FAILED" | "NO_OP";
  action: MissionControlAction;
  targetType: string;
  targetId: string;
  incidentId: string | null;
  result: Record<string, unknown>;
  correlationId: string;
  dryRun: boolean;
  attempts: number;
  createdAt: string;
  completedAt: string | null;
};

type ActionDraft = {
  exception: MissionControlException;
  action: MissionControlAction;
  targetType: string;
  targetId: string;
  runbookId: string;
  reason: string;
  idempotencyKey: string;
  dryRun: boolean;
};

const HIGH_IMPACT_ACTIONS = new Set<MissionControlAction>([
  "PAUSE",
  "RESUME",
  "RETRY",
  "REQUEUE",
  "REPLAY",
  "ESCALATE",
]);

const SEVERITY_STYLE: Record<string, { color: string; background: string }> = {
  critical: { color: "#fecaca", background: "rgba(239,68,68,.16)" },
  high: { color: "#fed7aa", background: "rgba(249,115,22,.16)" },
  medium: { color: "#fef08a", background: "rgba(234,179,8,.14)" },
  low: { color: "#bfdbfe", background: "rgba(59,130,246,.14)" },
  info: { color: "#cbd5e1", background: "rgba(148,163,184,.12)" },
};

const SOURCE_LABELS: Record<string, string> = {
  signal: "Signal",
  event: "Domain event",
  agent_run: "Agent run",
  approval: "Approval",
  loop: "Permanent loop",
  incident: "Incident",
  service_health: "Service health",
  worker_queue: "Worker queue",
};

function relativeTime(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function makeIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `mc-${crypto.randomUUID()}`;
  }
  return `mc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function actionTarget(item: MissionControlException, action: MissionControlAction) {
  if (action === "ESCALATE" || (action === "RESOLVE" && item.source === "incident")) {
    return { targetType: "MissionControlException", targetId: item.exceptionId };
  }
  return { targetType: item.targetType, targetId: item.targetId };
}

function errorMessage(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) return fallback;
  const root = body as { error?: unknown };
  if (typeof root.error !== "object" || root.error === null) return fallback;
  const error = root.error as { message?: unknown };
  return typeof error.message === "string" ? error.message : fallback;
}

export default function MissionControlPage() {
  const [payload, setPayload] = useState<ExceptionsPayload | null>(null);
  const [runbooks, setRunbooks] = useState<MissionControlRunbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [accessState, setAccessState] = useState<"ready" | "forbidden" | "inactive" | "error">("ready");
  const [error, setError] = useState<string | null>(null);
  const [liveState, setLiveState] = useState<"connected" | "degraded">("connected");
  const [source, setSource] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState<ActionDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const buildQuery = useCallback((cursor?: string | null) => {
    const query = new URLSearchParams({ limit: "50" });
    if (source) query.set("source", source);
    if (severity) query.set("severity", severity);
    if (status) query.set("status", status);
    if (cursor) query.set("cursor", cursor);
    return query.toString();
  }, [severity, source, status]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [exceptionsResponse, runbooksResponse] = await Promise.all([
        fetch(`/api/semse/ops/mission-control/exceptions?${buildQuery()}`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/semse/ops/mission-control/runbooks", {
          credentials: "include",
          cache: "no-store",
        }),
      ]);
      if (exceptionsResponse.status === 403 || runbooksResponse.status === 403) {
        setAccessState("forbidden");
        return;
      }
      if (exceptionsResponse.status === 404 || runbooksResponse.status === 404) {
        setAccessState("inactive");
        return;
      }
      if (!exceptionsResponse.ok || !runbooksResponse.ok) {
        const body = await exceptionsResponse.json().catch(() => null);
        throw new Error(errorMessage(body, "Mission Control is temporarily unavailable."));
      }
      const exceptionsBody = await exceptionsResponse.json() as { data?: ExceptionsPayload };
      const runbooksBody = await runbooksResponse.json() as {
        data?: { runbooks?: MissionControlRunbook[] };
      };
      setPayload(exceptionsBody.data ?? null);
      setRunbooks(runbooksBody.data?.runbooks ?? []);
      setAccessState("ready");
    } catch (caught) {
      setAccessState("error");
      setError(caught instanceof Error ? caught.message : "Mission Control could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (accessState !== "ready") return;
    const stream = new EventSource("/api/semse/sse/mission-control");
    const refresh = () => { void fetchData(); };
    stream.onopen = () => setLiveState("connected");
    stream.onerror = () => setLiveState("degraded");
    stream.addEventListener("mission-control-action:updated", refresh);
    stream.addEventListener("mission-control-incident:created", refresh);
    stream.addEventListener("operational-signal:created", refresh);
    stream.addEventListener("operational-signal:updated", refresh);
    const poll = window.setInterval(refresh, 30_000);
    return () => {
      stream.close();
      window.clearInterval(poll);
    };
  }, [accessState, fetchData]);

  const openDraft = useCallback((
    item: MissionControlException,
    action: MissionControlAction,
  ) => {
    const target = actionTarget(item, action);
    const compatible = runbooks.find((runbook) =>
      item.runbookIds.includes(runbook.id) &&
      runbook.allowedActions.includes(action) &&
      runbook.targetTypes.includes(target.targetType)
    );
    setReceipt(null);
    setActionError(null);
    setDraft({
      exception: item,
      action,
      targetType: target.targetType,
      targetId: target.targetId,
      runbookId: compatible?.id ?? "",
      reason: "",
      idempotencyKey: makeIdempotencyKey(),
      dryRun: HIGH_IMPACT_ACTIONS.has(action),
    });
  }, [runbooks]);

  const submitAction = useCallback(async () => {
    if (!draft || draft.reason.trim().length < 10 || !draft.runbookId) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await fetch("/api/semse/ops/mission-control/actions", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: draft.action,
          targetType: draft.targetType,
          targetId: draft.targetId,
          reason: draft.reason.trim(),
          runbookId: draft.runbookId,
          idempotencyKey: draft.idempotencyKey,
          dryRun: draft.dryRun,
          options: {},
        }),
      });
      const body = await response.json().catch(() => null) as {
        data?: { receipt?: Receipt };
      } | null;
      if (!response.ok || !body?.data?.receipt) {
        throw new Error(errorMessage(body, `Action failed with HTTP ${response.status}.`));
      }
      setReceipt(body.data.receipt);
      await fetchData();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "The governed action failed.");
    } finally {
      setSubmitting(false);
    }
  }, [draft, fetchData]);

  const loadMore = useCallback(async () => {
    if (!payload?.nextCursor) return;
    setLoadingMore(true);
    try {
      const response = await fetch(
        `/api/semse/ops/mission-control/exceptions?${buildQuery(payload.nextCursor)}`,
        { credentials: "include", cache: "no-store" },
      );
      if (!response.ok) throw new Error("The next page could not be loaded.");
      const body = await response.json() as { data?: ExceptionsPayload };
      if (!body.data) return;
      setPayload((current) => current ? {
        ...body.data!,
        items: [...current.items, ...body.data!.items],
      } : body.data!);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The next page could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  }, [buildQuery, payload?.nextCursor]);

  const selectedRunbook = useMemo(
    () => runbooks.find((runbook) => runbook.id === draft?.runbookId) ?? null,
    [draft?.runbookId, runbooks],
  );

  const pageStatus = payload?.sourceErrors.length
    ? "DEGRADED"
    : (payload?.counts.total ?? 0) > 0
      ? "ATTENTION"
      : "HEALTHY";
  const statusColor = pageStatus === "HEALTHY"
    ? "#22c55e"
    : pageStatus === "DEGRADED"
      ? "#f97316"
      : "#eab308";

  if (!loading && accessState === "forbidden") {
    return <StatePanel title="Access denied" detail="Your session does not have ops:dashboard:read." />;
  }
  if (!loading && accessState === "inactive") {
    return <StatePanel title="Mission Control 2.0 is not active" detail="This tenant is outside the current canary allowlist." />;
  }
  if (!loading && accessState === "error" && !payload) {
    return <StatePanel title="Mission Control unavailable" detail={error ?? "The service did not return a usable response."} retry={fetchData} />;
  }

  return (
    <div className="mx-auto max-w-[1280px] p-6">
      <AdminPageHeader
        title="Mission Control 2.0"
        subtitle="Tenant-safe exception queue with governed, idempotent recovery actions."
        icon={Activity}
        iconColor={statusColor}
        iconBg={`${statusColor}18`}
        showBack={false}
        actions={
          <div className="flex items-center gap-2">
            <span
              className="rounded border px-2 py-1 text-[10px] font-bold tracking-widest"
              style={{ borderColor: `${statusColor}55`, color: statusColor }}
            >
              {pageStatus}
            </span>
            <span className={`text-[10px] ${liveState === "connected" ? "text-emerald-400" : "text-orange-400"}`}>
              {liveState === "connected" ? "LIVE" : "POLLING"}
            </span>
            <button
              type="button"
              onClick={() => void fetchData()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Total" value={payload?.counts.total ?? 0} />
        <Metric label="Critical" value={payload?.counts.bySeverity.critical ?? 0} tone="var(--error)" />
        <Metric label="Dead letter" value={payload?.counts.byStatus.dead_letter ?? 0} tone="#f97316" />
        <Metric label="Failed" value={payload?.counts.byStatus.failed ?? 0} tone="#eab308" />
        <Metric label="Pending approval" value={payload?.counts.byStatus.pending_approval ?? 0} tone="var(--violet)" />
      </div>

      {payload?.sourceErrors.length ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-200">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          Partial data: {payload.sourceErrors.map((item) => item.source).join(", ")}. Healthy sources remain actionable.
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
        <FilterSelect label="Source" value={source} onChange={setSource} options={Object.entries(SOURCE_LABELS)} />
        <FilterSelect
          label="Severity"
          value={severity}
          onChange={setSeverity}
          options={["critical", "high", "medium", "low", "info"].map((item) => [item, item])}
        />
        <FilterSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={["open", "acknowledged", "failed", "dead_letter", "pending_approval"].map((item) => [item, item])}
        />
      </div>

      {loading && !payload ? (
        <div className="rounded-xl border border-slate-800 p-12 text-center text-sm text-slate-400">Loading canonical exceptions…</div>
      ) : payload?.items.length ? (
        <div className="space-y-3">
          {payload.items.map((item) => (
            <ExceptionCard key={item.exceptionId} item={item} onAction={openDraft} />
          ))}
          {payload.nextCursor ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="w-full rounded-xl border border-slate-700 py-3 text-sm text-slate-300 hover:border-slate-500 disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-12 text-center">
          <ShieldCheck className="mx-auto mb-3 text-emerald-400" size={32} />
          <p className="font-semibold text-slate-100">No exceptions match this view.</p>
          <p className="mt-1 text-sm text-slate-400">GET remains the source of truth after every SSE reconnect.</p>
        </div>
      )}

      {draft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-violet-300">Governed action</p>
                <h2 className="mt-1 text-lg font-bold text-white">{draft.action}: {draft.exception.title}</h2>
              </div>
              <button
                type="button"
                aria-label="Close action dialog"
                onClick={() => setDraft(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">
              <div>Target: <code>{draft.targetType}/{draft.targetId}</code></div>
              <div className="mt-1">Receipt key: <code className="break-all">{draft.idempotencyKey}</code></div>
            </div>

            <label className="mb-1 block text-xs font-semibold text-slate-300" htmlFor="mission-control-runbook">Approved runbook</label>
            <select
              id="mission-control-runbook"
              value={draft.runbookId}
              onChange={(event) => setDraft((current) => current ? { ...current, runbookId: event.target.value } : current)}
              className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100"
            >
              <option value="">Select a compatible runbook</option>
              {runbooks
                .filter((runbook) =>
                  draft.exception.runbookIds.includes(runbook.id) &&
                  runbook.allowedActions.includes(draft.action) &&
                  runbook.targetTypes.includes(draft.targetType)
                )
                .map((runbook) => (
                  <option key={runbook.id} value={runbook.id}>
                    {runbook.title} · risk {runbook.risk}
                  </option>
                ))}
            </select>

            {selectedRunbook ? (
              <p className="mb-3 text-xs text-slate-400">
                Version {selectedRunbook.version} · {selectedRunbook.documentationPath}
              </p>
            ) : null}

            <label className="mb-1 block text-xs font-semibold text-slate-300" htmlFor="mission-control-reason">
              Operator reason (10–500 characters)
            </label>
            <textarea
              id="mission-control-reason"
              rows={4}
              maxLength={500}
              value={draft.reason}
              onChange={(event) => setDraft((current) => current ? { ...current, reason: event.target.value } : current)}
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-100"
              placeholder="State what was verified, why this action is appropriate, and the expected result."
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={draft.dryRun}
                  onChange={(event) => setDraft((current) => current ? { ...current, dryRun: event.target.checked } : current)}
                />
                Dry-run (validate without applying the owning-domain effect)
              </label>
              <span className="text-[10px] text-slate-500">{draft.reason.trim().length}/500</span>
            </div>

            {actionError ? (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{actionError}</div>
            ) : null}
            {receipt ? (
              <div className={`mt-3 rounded-lg border p-3 text-xs ${
                receipt.status === "FAILED"
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              }`}>
                Receipt <code>{receipt.id}</code> · {receipt.status}
                {receipt.dryRun ? " · DRY-RUN" : ""}
                <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-[11px]">
                  {JSON.stringify(receipt.result, null, 2)}
                </pre>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void submitAction()}
                disabled={submitting || draft.reason.trim().length < 10 || !draft.runbookId}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "Creating receipt…" : draft.dryRun ? "Confirm dry-run" : "Confirm governed action"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value, tone = "#94a3b8" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="text-2xl font-black" style={{ color: tone }}>{value}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <label className="flex min-w-44 flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-200"
      >
        <option value="">All</option>
        {options.map(([key, optionLabel]) => (
          <option key={key} value={key}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function ExceptionCard({
  item,
  onAction,
}: {
  item: MissionControlException;
  onAction: (item: MissionControlException, action: MissionControlAction) => void;
}) {
  const severity = SEVERITY_STYLE[item.severity] ?? SEVERITY_STYLE.info;
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className="rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: severity.color, background: severity.background }}
            >
              {item.severity}
            </span>
            <span className="text-[11px] text-slate-400">{SOURCE_LABELS[item.source] ?? item.source}</span>
            <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">{item.status}</span>
            <span className="text-[10px] text-slate-600">{relativeTime(item.occurredAt)}</span>
          </div>
          <h2 className="text-sm font-bold text-slate-100">{item.title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">{item.summary}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-600">
            <span>{item.targetType}/{item.targetId}</span>
            {item.correlationId ? <span>correlation: {item.correlationId}</span> : null}
          </div>
        </div>
        <a
          href={item.deepLink}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-300 hover:text-blue-200"
        >
          Owner workspace <ExternalLink size={12} />
        </a>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-3">
        {item.availableActions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onAction(item, action)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              action === "ESCALATE"
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
            }`}
          >
            {action}
          </button>
        ))}
      </div>
    </article>
  );
}

function StatePanel({
  title,
  detail,
  retry,
}: {
  title: string;
  detail: string;
  retry?: () => void | Promise<void>;
}) {
  return (
    <div className="mx-auto mt-20 max-w-xl rounded-2xl border border-slate-800 bg-slate-950/50 p-10 text-center">
      <AlertTriangle className="mx-auto mb-3 text-orange-400" size={30} />
      <h1 className="text-xl font-bold text-slate-100">{title}</h1>
      <p className="mt-2 text-sm text-slate-400">{detail}</p>
      {retry ? (
        <button
          type="button"
          onClick={() => void retry()}
          className="mt-5 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
