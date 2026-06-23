"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

const MEDIA_ICON: Record<string, string> = {
  NOTE: "📝", PHOTO: "📷", VIDEO: "🎬", DOCUMENT: "📄", EXTERNAL_URL: "🔗", OTHER: "📎",
};

export default function EvidencePage() {
  const { farmId } = useParams<{ farmId: string }>();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    if (!farmId) return;
    void load();
  }, [farmId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/evidence`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      setEvidence((json.data as any)?.evidence ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Error cargando evidencia");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/semse/agro/farms/${farmId}/evidence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entityType: "GENERAL", mediaType: "NOTE", note: noteText.trim() }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error?.message ?? "Error");
      }
      setShowCreate(false);
      setNoteText("");
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Error creando nota");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <nav className="mb-6 flex items-center gap-2 text-xs text-[var(--muted)]">
        <Link href="/agro" className="hover:text-[var(--accent)]">Agro</Link>
        <span>/</span>
        <Link href={`/agro/${farmId}`} className="hover:text-[var(--accent)]">Finca</Link>
        <span>/</span>
        <span className="text-[var(--ink)]">Evidencia</span>
      </nav>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--ink)]">Evidencia</h1>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + Nota
        </button>
      </div>

      {showCreate && (
        <form onSubmit={(e) => void handleCreateNote(e)} className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Nueva nota de campo</h2>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            placeholder="Describe lo observado..."
            required
          />
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {creating ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)]">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm text-[var(--muted)]">Cargando...</div>
      ) : evidence.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Sin evidencia registrada.</p>
      ) : (
        <div className="space-y-3">
          {evidence.map((ev) => (
            <div key={ev.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span>{MEDIA_ICON[ev.mediaType] ?? "📎"}</span>
                  <span className="text-xs font-medium text-[var(--ink)]">{ev.title ?? ev.mediaType}</span>
                  <span className="text-xs text-[var(--muted)]">· {ev.entityType}</span>
                </div>
                <span className="text-xs text-[var(--muted)]">
                  {new Date(ev.capturedAt).toLocaleDateString("es-MX")}
                </span>
              </div>
              {ev.note && <p className="text-sm text-[var(--ink)]">{ev.note}</p>}
              {ev.fileUrl && (
                <a href={ev.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-1 text-xs text-[var(--accent)] underline">
                  Ver archivo
                </a>
              )}
              {ev.latitude != null && ev.longitude != null && (
                <p className="mt-1 text-xs text-[var(--muted)]">📍 {ev.latitude.toFixed(4)}, {ev.longitude.toFixed(4)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
