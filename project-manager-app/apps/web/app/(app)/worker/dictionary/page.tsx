"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Check, GraduationCap, Heart, RefreshCw, ScanSearch, Search, Trash2 } from "lucide-react";
import type { DictionaryEntryView, DictionaryListView } from "@semse/schemas";
import { WordCard } from "../../../components/sense-vision/WordCard";
import { listDictionary, removeWord, updateWord } from "../../../../lib/sense-vision/api";

// Mi Diccionario — what each professional is learning (spec:
// docs/specs/vision/sense-vision-field-library.spec.md §2.5, §2.10).
// Removing a word only removes it from this list, never from the library.

type Filter = "all" | "favorites" | "learning" | "learned";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "favorites", label: "Favoritas" },
  { id: "learning", label: "Por aprender" },
  { id: "learned", label: "Aprendidas" },
];

function applyFilter(entries: DictionaryEntryView[], filter: Filter, query: string): DictionaryEntryView[] {
  const q = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filter === "favorites" && !entry.favorite) return false;
    if (filter === "learning" && entry.learned) return false;
    if (filter === "learned" && !entry.learned) return false;
    if (!q) return true;
    const { item } = entry;
    return [item.nameEn, item.nameEs, ...item.aliasesEn, ...item.aliasesEs].some((name) => name.toLowerCase().includes(q));
  });
}

export default function MyDictionaryPage() {
  const [data, setData] = useState<DictionaryListView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await listDictionary());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar tu diccionario");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const replaceEntry = (updated: DictionaryEntryView) =>
    setData((current) => current && { ...current, entries: current.entries.map((e) => (e.id === updated.id ? updated : e)) });

  const toggle = async (entry: DictionaryEntryView, patch: { favorite?: boolean; learned?: boolean }) => {
    setBusyId(entry.id);
    try {
      replaceEntry(await updateWord(entry.libraryItemId, patch));
    } catch {
      setError("No se pudo actualizar la palabra. Intenta de nuevo.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (entry: DictionaryEntryView) => {
    setBusyId(entry.id);
    try {
      await removeWord(entry.libraryItemId);
      setData((current) => current && { ...current, entries: current.entries.filter((e) => e.id !== entry.id) });
    } catch {
      setError("No se pudo quitar la palabra. Intenta de nuevo.");
    } finally {
      setBusyId(null);
    }
  };

  const open = (entry: DictionaryEntryView) => {
    const next = openId === entry.id ? null : entry.id;
    setOpenId(next);
    if (next) void updateWord(entry.libraryItemId, { viewed: true }).then(replaceEntry).catch(() => undefined);
  };

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const visible = useMemo(() => applyFilter(entries, filter, query), [entries, filter, query]);
  const learnedCount = entries.filter((e) => e.learned).length;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 40px", display: "grid", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
            <BookOpen size={22} aria-hidden /> Mi Diccionario
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--muted)" }}>Las palabras de obra que estás aprendiendo.</p>
        </div>
        <Link href="/worker/sense-vision" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44 }}>
          <ScanSearch size={16} aria-hidden /> Escanear
        </Link>
      </header>

      {data && data.stats.total > 0 && (
        <section aria-label="Resumen" style={{ display: "flex", gap: 8 }}>
          <Stat label="Esta semana" value={data.stats.addedThisWeek} hint={data.stats.addedThisWeek === 1 ? "palabra nueva" : "palabras nuevas"} />
          <Stat label="Total" value={data.stats.total} hint="guardadas" />
          <Stat label="Aprendidas" value={learnedCount} hint={`de ${entries.length}`} />
        </section>
      )}

      {entries.length >= 3 && <Review entries={entries} />}

      {entries.length > 0 && (
        <section aria-label="Filtros" style={{ display: "grid", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <Search size={16} aria-hidden style={{ position: "absolute", left: 12, top: 16, color: "var(--faint)" }} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en mi diccionario"
              aria-label="Buscar en mi diccionario"
              style={{ width: "100%", minHeight: 48, padding: "0 14px 0 36px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 16 }}
            />
          </div>
          <div role="tablist" style={{ display: "flex", gap: 6, overflowX: "auto" }}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filter === f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={filter === f.id ? "btn-primary" : "btn-ghost"}
                style={{ minHeight: 40, whiteSpace: "nowrap" }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {error && (
        <div role="alert" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, background: "var(--raised)", color: "var(--error)", fontSize: 14 }}>
          <span>{error}</span>
          <button type="button" className="btn-ghost" onClick={() => void load()} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <RefreshCw size={14} aria-hidden /> Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ display: "grid", gap: 8 }} aria-label="Cargando">
          {[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 64, borderRadius: 12 }} />)}
        </div>
      ) : entries.length === 0 && !error ? (
        <div style={{ padding: 24, borderRadius: 14, border: "1px dashed var(--border)", textAlign: "center", display: "grid", gap: 10, justifyItems: "center" }}>
          <BookOpen size={32} aria-hidden style={{ color: "var(--faint)" }} />
          <strong style={{ color: "var(--ink)" }}>Tu diccionario está vacío</strong>
          <span style={{ color: "var(--muted)", fontSize: 14 }}>Escanea una herramienta o búscala y toca “Guardar”.</span>
          <Link href="/worker/sense-vision" className="btn-primary" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>Abrir Sense Vision</Link>
        </div>
      ) : visible.length === 0 && entries.length > 0 ? (
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>Ninguna palabra coincide con este filtro.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {visible.map((entry) => (
            <li key={entry.id} style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)" }}>
                <button
                  type="button"
                  onClick={() => open(entry)}
                  aria-expanded={openId === entry.id}
                  style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", color: "var(--ink)", cursor: "pointer", minHeight: 44, padding: 0 }}
                >
                  <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.item.nameEn}</strong>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>{entry.item.nameEs}{entry.learned ? " · aprendida" : ""}</span>
                </button>
                <IconToggle
                  active={entry.favorite}
                  disabled={busyId === entry.id}
                  label={entry.favorite ? "Quitar de favoritas" : "Marcar como favorita"}
                  onClick={() => void toggle(entry, { favorite: !entry.favorite })}
                >
                  <Heart size={18} fill={entry.favorite ? "currentColor" : "none"} />
                </IconToggle>
                <IconToggle
                  active={entry.learned}
                  disabled={busyId === entry.id}
                  label={entry.learned ? "Marcar como por aprender" : "Marcar como aprendida"}
                  onClick={() => void toggle(entry, { learned: !entry.learned })}
                >
                  {entry.learned ? <Check size={18} /> : <GraduationCap size={18} />}
                </IconToggle>
              </div>
              {openId === entry.id && (
                <WordCard
                  item={entry.item}
                  compact
                  actions={
                    <button type="button" className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44 }} disabled={busyId === entry.id} onClick={() => void remove(entry)}>
                      <Trash2 size={14} aria-hidden /> Quitar de mi diccionario
                    </button>
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 0, padding: 12, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--faint)" }}>{hint}</div>
    </div>
  );
}

function IconToggle({ active, disabled, label, onClick, children }: { active: boolean; disabled: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      style={{ width: 44, height: 44, borderRadius: 10, border: "1px solid var(--border)", background: active ? "var(--raised)" : "transparent", color: active ? "var(--brand)" : "var(--muted)", display: "grid", placeItems: "center", cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

/**
 * Light review ("Repasar"): one multiple-choice question at a time drawn
 * from the user's own words — not a full learning platform (handoff §23).
 */
function Review({ entries }: { entries: DictionaryEntryView[] }) {
  const [seed, setSeed] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const question = useMemo(() => {
    const pool = entries.filter((e) => !e.learned).length >= 3 ? entries.filter((e) => !e.learned) : entries;
    const target = pool[seed % pool.length];
    const distractors = entries
      .filter((e) => e.id !== target.id && e.item.nameEn !== target.item.nameEn)
      .sort((a, b) => Number(b.item.category === target.item.category) - Number(a.item.category === target.item.category))
      .slice(0, 2);
    const options = [target, ...distractors]
      .map((e) => e.item.nameEn)
      .sort((a, b) => ((a.length * 31 + seed) % 7) - ((b.length * 31 + seed) % 7));
    return { target, options };
  }, [entries, seed]);

  const correct = picked !== null && picked === question.target.item.nameEn;
  return (
    <section aria-label="Repasar" style={{ padding: 14, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 15, color: "var(--ink)" }}>Repasar · What is this called in English?</h2>
      <p lang="es" style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
        <strong style={{ color: "var(--ink)" }}>{question.target.item.nameEs}</strong> — {question.target.item.descriptionEs}
      </p>
      <div style={{ display: "grid", gap: 6 }}>
        {question.options.map((option, index) => {
          const isAnswer = option === question.target.item.nameEn;
          const state = picked === null ? "idle" : isAnswer ? "right" : picked === option ? "wrong" : "idle";
          return (
            <button
              key={option}
              type="button"
              disabled={picked !== null}
              onClick={() => setPicked(option)}
              style={{
                minHeight: 44,
                textAlign: "left",
                padding: "8px 12px",
                borderRadius: 10,
                border: `1px solid ${state === "right" ? "var(--ok)" : state === "wrong" ? "var(--error)" : "var(--border)"}`,
                background: "var(--bg)",
                color: "var(--ink)",
                cursor: picked === null ? "pointer" : "default",
              }}
            >
              {String.fromCharCode(65 + index)}. {option}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div role="status" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 14, color: correct ? "var(--ok)" : "var(--error)", fontWeight: 600 }}>
            {correct ? "¡Correcto!" : `Era “${question.target.item.nameEn}”.`}
          </span>
          <button type="button" className="btn-ghost" style={{ minHeight: 40 }} onClick={() => { setPicked(null); setSeed((s) => s + 1); }}>
            Siguiente
          </button>
        </div>
      )}
    </section>
  );
}
