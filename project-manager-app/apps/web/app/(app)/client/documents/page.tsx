"use client";

import { useEffect, useState } from "react";
import { FileText, Download, Eye, Upload, Clock, Search, ImageIcon, Video } from "lucide-react";
import Link from "next/link";
import { HtmlInCanvasPanel, StatusBadge } from "@semse/ui";
import { CLIENT_ROUTES } from "../../../lib/client-routes";
import { fetchJobs, fetchJobEvidence } from "../../../semse-api";
import { ClientPageHeader } from "../../../components/client/ClientPageHeader";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

interface DocRow {
  id: string;
  name: string;
  kind: string;
  jobTitle: string;
  jobId: string;
  uploadedAt: string;
  validationStatus: string;
  previewUrl?: string;
  downloadUrl?: string;
  sourceKey?: string;
  accessMode: "direct" | "project";
}

const KIND_COLOR: Record<string, string> = {
  PHOTO:    "#10b981",
  VIDEO:    "#3b82f6",
  DOCUMENT: "#8b5cf6",
  CONTRACT: "#f59e0b",
};

const KIND_LABEL: Record<string, string> = {
  PHOTO:    "Foto",
  VIDEO:    "Video",
  DOCUMENT: "Documento",
  CONTRACT: "Contrato",
};

function KindIcon({ kind }: { kind: string }) {
  const color = KIND_COLOR[kind] ?? "#6b7280";
  if (kind === "PHOTO") return <ImageIcon size={18} color={color} />;
  if (kind === "VIDEO") return <Video size={18} color={color} />;
  return <FileText size={18} color={color} />;
}

function statusVariant(s: string): "success" | "warning" | "info" | "neutral" {
  if (s === "approved" || s === "valid") return "success";
  if (s === "pending" || s === "under_review") return "warning";
  if (s === "rejected" || s === "invalid") return "info";
  return "neutral";
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return undefined;
}

function toMetadata(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function resolveEvidenceLinks(rec: Record<string, unknown>) {
  const metadata = toMetadata(rec.metadata);
  const previewUrl = pickString(
    rec.previewUrl,
    rec.preview_url,
    rec.url,
    rec.signedUrl,
    rec.signed_url,
    rec.viewUrl,
    rec.view_url,
    metadata?.previewUrl,
    metadata?.preview_url,
    metadata?.url,
    metadata?.signedUrl,
    metadata?.signed_url,
    metadata?.viewUrl
  );
  const downloadUrl = pickString(
    rec.downloadUrl,
    rec.download_url,
    rec.fileUrl,
    rec.file_url,
    rec.signedDownloadUrl,
    rec.signed_download_url,
    previewUrl,
    metadata?.downloadUrl,
    metadata?.download_url,
    metadata?.fileUrl,
    metadata?.signedDownloadUrl
  );

  return { previewUrl, downloadUrl, metadata };
}

function presentValidationStatus(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "passed") return "approved";
  if (normalized === "failed") return "rejected";
  if (normalized === "manual_review") return "under_review";
  return normalized;
}

export default function ClientDocumentsPage() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const jobs = await fetchJobs();
        const rows: DocRow[] = [];
        await Promise.all(
          jobs.map(async (job) => {
            try {
              const evidence = await fetchJobEvidence(job.id);
              for (const item of evidence) {
                const rec = item as Record<string, unknown>;
                const { previewUrl, downloadUrl, metadata } = resolveEvidenceLinks(rec);
                const name = pickString(
                  rec.filename,
                  rec.originalFilename,
                  rec.original_filename,
                  metadata?.filename,
                  metadata?.originalFilename,
                  rec.bucketKey,
                  rec.key,
                  rec.id
                ) ?? "Archivo";
                rows.push({
                  id: String(rec.id ?? `${job.id}-${rows.length}`),
                  name,
                  kind: String(rec.kind ?? "DOCUMENT").toUpperCase(),
                  jobTitle: job.title,
                  jobId: job.id,
                  uploadedAt: String(rec.createdAt ?? rec.capturedAt ?? "").slice(0, 10),
                  validationStatus: presentValidationStatus(String(rec.validationStatus ?? "pending")),
                  previewUrl,
                  downloadUrl,
                  sourceKey: pickString(rec.bucketKey, rec.key, metadata?.bucketKey, metadata?.key),
                  accessMode: previewUrl || downloadUrl ? "direct" : "project",
                });
              }
            } catch {
              // job sin evidencia — ignorar
            }
          })
        );
        rows.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
        setDocs(rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudieron cargar los documentos.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = docs.filter(d =>
    !query ||
    d.name.toLowerCase().includes(query.toLowerCase()) ||
    d.jobTitle.toLowerCase().includes(query.toLowerCase())
  );
  const approvedDocs = docs.filter((doc) => ["approved", "valid"].includes(doc.validationStatus.toLowerCase())).length;
  const withDirectUrl = docs.filter((doc) => doc.accessMode === "direct").length;

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto" }}>
      <ClientPageHeader
        title="Documentos"
        subtitle="Evidencias, respaldo operativo y archivos generados por tus proyectos"
        breadcrumbs={[{ label: "Documentos" }]}
        minHeight={82}
        actions={
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <NotificationBanner audience="client" />
            <Link
              href={CLIENT_ROUTES.milestones}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "10px", border: "none", background: "var(--brand)", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", textDecoration: "none" }}
            >
              <Upload size={15} />
              Revisar hitos
            </Link>
          </div>
        }
      />

      <HtmlInCanvasPanel as="section" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", marginBottom: "16px" }} canvasClassName="rounded-2xl" minHeight={108}>
        {[
          { label: "Archivos totales", value: String(docs.length), color: "var(--brand)" },
          { label: "Con acceso directo", value: String(withDirectUrl), color: "#10b981" },
          { label: "Validados", value: String(approvedDocs), color: "#8b5cf6" },
        ].map((item) => (
          <div key={item.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 16px" }}>
            <p style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 700, marginBottom: "6px" }}>{item.label.toUpperCase()}</p>
            <p style={{ fontSize: "24px", fontWeight: 900, color: item.color }}>{item.value}</p>
          </div>
        ))}
      </HtmlInCanvasPanel>

      <HtmlInCanvasPanel as="div" style={{ position: "relative", marginBottom: "16px" }} canvasClassName="rounded-2xl" minHeight={46}>
        <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar documento o proyecto..."
          style={{ width: "100%", paddingLeft: "36px", paddingRight: "12px", height: "40px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "13px", outline: "none", boxSizing: "border-box" }}
        />
      </HtmlInCanvasPanel>

      <HtmlInCanvasPanel as="section" canvasClassName="rounded-2xl" minHeight={360}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: "68px", borderRadius: "10px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : error ? (
          <div style={{ padding: "16px 18px", borderRadius: "12px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)", color: "#ef4444", fontSize: "13px" }}>
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center" }}>
            <FileText size={36} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
            <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
              {docs.length === 0 ? "Aún no hay evidencias registradas" : "No se encontraron documentos"}
            </p>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px" }}>
              {docs.length === 0
                ? "Las evidencias aparecen aquí cuando los profesionales suben archivos a tus proyectos."
                : "Ajusta el filtro de búsqueda."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {filtered.map(doc => {
              const color = KIND_COLOR[doc.kind] ?? "#6b7280";
              return (
                <div
                  key={doc.id}
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px" }}
                >
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <KindIcon kind={doc.kind} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px", flexWrap: "wrap" }}>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "320px" }}>{doc.name}</p>
                      <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: `${color}14`, color, fontWeight: 600 }}>{KIND_LABEL[doc.kind] ?? doc.kind}</span>
                      <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: doc.accessMode === "direct" ? "rgba(16,185,129,.12)" : "rgba(100,116,139,.12)", color: doc.accessMode === "direct" ? "#10b981" : "#64748b", fontWeight: 700 }}>
                        {doc.accessMode === "direct" ? "Acceso directo" : "Desde proyecto"}
                      </span>
                    </div>
                    <Link href={`/client/jobs/${doc.jobId}`} style={{ fontSize: "11px", color: "var(--brand)", textDecoration: "none", fontWeight: 600 }}>{doc.jobTitle}</Link>
                    {doc.uploadedAt && (
                      <p style={{ fontSize: "11px", color: "var(--faint)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={10} /> {doc.uploadedAt}
                      </p>
                    )}
                    {doc.sourceKey ? (
                      <p style={{ fontSize: "10px", color: "var(--faint)", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {doc.sourceKey}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge variant={statusVariant(doc.validationStatus)} text={doc.validationStatus} size="sm" />
                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    {doc.previewUrl ? (
                      <a href={doc.previewUrl} target="_blank" rel="noopener noreferrer" title="Ver archivo" style={{ padding: "6px", borderRadius: "7px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", display: "flex", textDecoration: "none" }}>
                        <Eye size={14} />
                      </a>
                    ) : (
                      <Link href={`/client/jobs/${doc.jobId}`} title="Abrir proyecto para revisar el archivo" style={{ padding: "6px", borderRadius: "7px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", display: "flex", textDecoration: "none" }}>
                        <Eye size={14} />
                      </Link>
                    )}
                    {doc.downloadUrl ? (
                      <a href={doc.downloadUrl} download title="Descargar archivo" style={{ padding: "6px", borderRadius: "7px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", display: "flex", textDecoration: "none" }}>
                        <Download size={14} />
                      </a>
                    ) : (
                      <Link href={`/client/jobs/${doc.jobId}`} title="Ir al proyecto para descargar o validar" style={{ padding: "6px", borderRadius: "7px", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", display: "flex", textDecoration: "none" }}>
                        <Download size={14} />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </HtmlInCanvasPanel>
    </div>
  );
}
