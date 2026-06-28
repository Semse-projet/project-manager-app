"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Plus, X, FileText, Camera, Video, Link2, ChevronRight, Paperclip, StickyNote } from "lucide-react";
import { farmTabs } from "../farm-tabs";

interface Evidence {
  id: string;
  entityType: string;
  entityId?: string;
  mediaType: string;
  title?: string;
  note?: string;
  fileUrl?: string;
  capturedAt: string;
  latitude?: number;
  longitude?: number;
}

const MEDIA_ICON: Record<string, typeof StickyNote> = {
  NOTE: StickyNote, PHOTO: Camera, VIDEO: Video,
  DOCUMENT: FileText, EXTERNAL_URL: Link2, OTHER: Paperclip,
};
const MEDIA_COLOR: Record<string, string> = {
  NOTE: "#6ee7b7", PHOTO: "#93c5fd", VIDEO: "#c4b5fd",
  DOCUMENT: "#fcd34d", EXTERNAL_URL: "#67e8f9", OTHER: "#94a3b8",
};


export default function EvidencePage() {
  const { farmId } = useParams<{ farmId: string }>();
  const pathname = usePathname();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [mediaType, setMediaType] = useState("NOTE");
  const [title, setTitle] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/evidence`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      setEvidence((json.data as any)?.evidence ?? []);
    } catch (err: any) { setError(err?.message ?? "Error cargando evidencia"); }
    finally { setLoading(false); }
  }

  function closeModal() { setShowModal(false); setFormError(null); setCreating(false); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim() && mediaType === "NOTE") return;
    setCreating(true); setFormError(null);
    try {
      const body: Record<string, string> = { entityType: "GENERAL", mediaType };
      if (title.trim()) body.title = title.trim();
      if (noteText.trim()) body.note = noteText.trim();
      if (fileUrl.trim()) body.fileUrl = fileUrl.trim();
      const res = await fetch(`/api/semse/agro/farms/${farmId}/evidence`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { const json = await res.json(); throw new Error(json?.error?.message ?? "Error"); }
      setNoteText(""); setTitle(""); setFileUrl(""); setMediaType("NOTE");
      closeModal(); void load();
    } catch (err: any) { setFormError(err?.message); } finally { setCreating(false); }
  }

  const tabs = farmId ? farmTabs(farmId) : [];

  return (
    <div className="agro-shell">
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <ChevronRight size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>Evidencia</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Evidencia</h1>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>Notas de campo, fotos, documentos y evidencia operativa</p>
        </div>
        <button className="btn-accent" onClick={() => setShowModal(true)}>
          <Plus size={13} /> Nueva evidencia
        </button>
      </div>

      <nav className="tab-bar">
        {tabs.map(tab => (
          <Link key={tab.href} href={tab.href} className="tab-item"
            data-active={pathname === tab.href ? "true" : "false"}>{tab.label}</Link>
        ))}
      </nav>

      {error && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1,2,3].map(i => <div key={i} className="skel" style={{ height: 80 }} />)}
        </div>
      ) : evidence.length === 0 ? (
        <div className="empty-state">
          <Camera size={36} className="empty-icon" />
          <p className="empty-title">Sin evidencia registrada</p>
          <p className="empty-desc">Registra notas de campo, fotos y documentos para mantener trazabilidad de la operación.</p>
          <button className="btn-accent" onClick={() => setShowModal(true)}>
            <Plus size={13} /> Agregar primera evidencia
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {evidence.map((ev) => {
            const Icon = MEDIA_ICON[ev.mediaType] ?? Paperclip;
            const color = MEDIA_COLOR[ev.mediaType] ?? "#94a3b8";
            return (
              <div key={ev.id} style={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                borderLeft: `3px solid ${color}`,
                background: "var(--surface)",
                padding: "14px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: ev.note ? 8 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={13} color={color} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                        {ev.title ?? ev.mediaType}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--muted)" }}>{ev.entityType}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <span className="badge badge-slate" style={{ fontSize: 10 }}>{ev.mediaType}</span>
                    <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 4 }}>
                      {new Date(ev.capturedAt).toLocaleDateString("es-MX")}
                    </p>
                  </div>
                </div>
                {ev.note && <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5, marginTop: 6 }}>{ev.note}</p>}
                {ev.fileUrl && (
                  <a href={ev.fileUrl} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: color, textDecoration: "none", marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Link2 size={11} /> Ver archivo
                  </a>
                )}
                {ev.latitude != null && ev.longitude != null && (
                  <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 4 }}>
                    📍 {ev.latitude.toFixed(4)}, {ev.longitude.toFixed(4)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Nueva evidencia</h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", display: "flex" }}><X size={16} /></button>
            </div>
            {formError && <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>{formError}</div>}
            <form onSubmit={e => void handleCreate(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="fl">Tipo</label>
                <select className="fi" value={mediaType} onChange={e => setMediaType(e.target.value)}>
                  <option value="NOTE">Nota</option>
                  <option value="PHOTO">Foto</option>
                  <option value="VIDEO">Video</option>
                  <option value="DOCUMENT">Documento</option>
                  <option value="EXTERNAL_URL">URL externa</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
              <div><label className="fl">Título (opcional)</label><input className="fi" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Inspección corral norte" /></div>
              <div>
                <label className="fl">Nota / Descripción</label>
                <textarea className="fi" rows={3} value={noteText} onChange={e => setNoteText(e.target.value)}
                  style={{ resize: "vertical" }} placeholder="Describe lo observado..." />
              </div>
              {(mediaType === "PHOTO" || mediaType === "VIDEO" || mediaType === "DOCUMENT" || mediaType === "EXTERNAL_URL") && (
                <div><label className="fl">URL del archivo</label><input className="fi" type="url" value={fileUrl} onChange={e => setFileUrl(e.target.value)} placeholder="https://..." /></div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" className="btn-accent" disabled={creating} style={{ flex: 1 }}>{creating ? "Guardando…" : "Guardar"}</button>
                <button type="button" className="btn-ghost" onClick={closeModal}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
