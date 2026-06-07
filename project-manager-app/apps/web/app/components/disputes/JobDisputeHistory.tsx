"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2, MessageSquare, RefreshCw, Scale, ShieldAlert } from "lucide-react";
import { fetchDisputes, fetchDisputeComments } from "../../semse-api";

type DisputeRow = {
  id: string;
  projectId: string;
  jobId?: string;
  reason: string;
  status: "open" | "assigned" | "resolved";
  resolution?: string;
  commentCount: number;
};

function normalizeStatus(value: unknown): DisputeRow["status"] {
  const s = typeof value === "string" ? value.toLowerCase() : "";
  if (s === "resolved" || s === "closed") return "resolved";
  if (s === "assigned" || s === "escalated") return "assigned";
  return "open";
}

const STATUS_META = {
  open:     { label: "Abierta",   color: "#ef4444", Icon: AlertTriangle },
  assigned: { label: "Asignada",  color: "#f59e0b", Icon: ShieldAlert   },
  resolved: { label: "Resuelta",  color: "#10b981", Icon: CheckCircle2  },
};

export function JobDisputeHistory({
  jobId,
  audience,
  projectId,
}: {
  jobId: string;
  audience: "client" | "worker";
  projectId?: string;
}) {
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchDisputes()
      .then(async (all) => {
        if (cancelled) return;

        const related = all.filter((d) => {
          const dJobId = typeof d.jobId === "string" ? d.jobId : "";
          const dProjectId = typeof d.projectId === "string" ? d.projectId : "";
          if (dJobId && dJobId === jobId) return true;
          if (projectId && dProjectId && dProjectId === projectId) return true;
          return false;
        });

        const withCounts = await Promise.all(
          related.map(async (d) => {
            const id = String(d.id ?? "");
            let commentCount = 0;
            try {
              const comments = await fetchDisputeComments(id);
              commentCount = comments.length;
            } catch {}
            return {
              id,
              projectId: String(d.projectId ?? ""),
              jobId: typeof d.jobId === "string" ? d.jobId : undefined,
              reason: String(d.reason ?? "Sin motivo registrado."),
              status: normalizeStatus(d.status),
              resolution: typeof d.resolution === "string" && d.resolution.trim() ? d.resolution : undefined,
              commentCount,
            } satisfies DisputeRow;
          })
        );

        if (!cancelled) setRows(withCounts);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar el historial.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [jobId, projectId]);

  const disputesHref = audience === "client" ? "/client/disputes" : "/worker/disputes";
  const openCount = rows.filter((r) => r.status !== "resolved").length;

  return (
    <section style={{ background: "var(--surface)", border: `1px solid ${openCount > 0 ? "rgba(239,68,68,.28)" : "var(--border)"}`, borderRadius: "16px", padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Scale size={16} color={openCount > 0 ? "#ef4444" : "var(--muted)"} />
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 800, color: "var(--ink)", margin: 0 }}>
              Historial de disputas
            </h2>
            {openCount > 0 ? (
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#ef4444", fontWeight: 700 }}>
                {openCount} disputa{openCount !== 1 ? "s" : ""} activa{openCount !== 1 ? "s" : ""}
              </p>
            ) : rows.length > 0 ? (
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#10b981", fontWeight: 700 }}>
                Todas resueltas
              </p>
            ) : null}
          </div>
        </div>
        <Link
          href={disputesHref}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 12px", borderRadius: "9px", border: "1px solid var(--border)", background: "transparent", color: "var(--ink)", fontSize: "12px", fontWeight: 700, textDecoration: "none" }}
        >
          Ver panel completo <ArrowUpRight size={13} />
        </Link>
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: "8px" }}>
          {[1, 2].map((i) => (
            <div key={i} style={{ height: "64px", borderRadius: "12px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ padding: "14px 16px", borderRadius: "12px", background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.18)", color: "#ef4444", fontSize: "13px" }}>
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: "18px 20px", borderRadius: "14px", border: "1px dashed var(--border)", color: "var(--muted)", fontSize: "13px", lineHeight: 1.6 }}>
          Este trabajo no tiene disputas registradas. Si surge un bloqueo, ábrelo desde el panel de disputas.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {rows.map((row) => {
            const meta = STATUS_META[row.status];
            const Icon = meta.Icon;
            return (
              <div
                key={row.id}
                style={{ padding: "14px 16px", borderRadius: "14px", border: `1px solid ${row.status !== "resolved" ? "rgba(239,68,68,.18)" : "var(--border)"}`, background: row.status !== "resolved" ? "rgba(239,68,68,.04)" : "var(--bg)", display: "grid", gap: "8px" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <Icon size={14} color={meta.color} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", fontWeight: 800, color: meta.color }}>{meta.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {row.commentCount > 0 ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#818cf8", fontWeight: 700 }}>
                        <MessageSquare size={12} /> {row.commentCount} argumento{row.commentCount !== 1 ? "s" : ""}
                      </span>
                    ) : null}
                    <Link
                      href={`${disputesHref}?status=open`}
                      style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 9px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: "11px", fontWeight: 700, textDecoration: "none" }}
                    >
                      Workspace <ArrowUpRight size={11} />
                    </Link>
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: "13px", color: "var(--ink)", lineHeight: 1.6 }}>{row.reason}</p>

                {row.resolution ? (
                  <div style={{ padding: "8px 10px", borderRadius: "10px", background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.2)", fontSize: "12px", color: "#10b981", lineHeight: 1.5 }}>
                    <RefreshCw size={11} style={{ display: "inline", marginRight: 5 }} />
                    {row.resolution}
                  </div>
                ) : null}

                <div style={{ fontSize: "11px", color: "var(--faint)" }}>
                  ID {row.id.slice(0, 8)} · Proyecto {row.projectId.slice(0, 8)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
