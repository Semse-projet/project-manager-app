"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Camera, CameraOff, Check, Pause, Play, RefreshCw, ScanSearch, Search, Star, WifiOff, X } from "lucide-react";
import type { LibraryItemView, RecognizedLibraryItem, VisionRecognizeResult } from "@semse/schemas";
import { WordCard } from "../../../components/sense-vision/WordCard";
import { captureVideoFrame } from "../../../../lib/sense-vision/browser";
import { createFrameSampler, createResultStabilizer } from "../../../../lib/sense-vision/live-loop";
import { recognizeFrame, reportCorrection, saveWord, searchLibrary } from "../../../../lib/sense-vision/api";
import { trackProductEvent } from "../../../../lib/product-intelligence";

// Sense Vision — camera-first field vocabulary.
// Spec: docs/specs/vision/sense-vision-field-library.spec.md §2, §4 (P1–P4, P8, P13–P15).
// Live mode is capture → analyze → show → discard: frames live only in the
// request that carries them; nothing is uploaded to Evidence or storage.

const SAMPLE_INTERVAL_MS = 1500;
const POLICY_RELOAD_KEY = "semse.senseVision.policyReload";

/**
 * Permissions-Policy is fixed per document. The site-wide header sets
 * camera=() and only /worker/sense-vision re-allows it (next.config.ts), so
 * arriving here by client-side navigation keeps the blocking policy of the
 * page the user came from. Chromium exposes that via permissionsPolicy.
 */
function cameraBlockedByDocumentPolicy(): boolean {
  const policy = (document as Document & { permissionsPolicy?: { allowsFeature(feature: string): boolean }; featurePolicy?: { allowsFeature(feature: string): boolean } })
    .permissionsPolicy ?? (document as Document & { featurePolicy?: { allowsFeature(feature: string): boolean } }).featurePolicy;
  return policy ? !policy.allowsFeature("camera") : false;
}
const REQUEST_TIMEOUT_MS = 15_000;

type CameraState = "starting" | "live" | "denied" | "unsupported" | "error" | "paused";
type ScanState = "waiting" | "identifying" | "identified" | "uncertain" | "unknown" | "unavailable" | "error";

const SCAN_COPY: Record<ScanState, { label: string; tone: string }> = {
  waiting: { label: "Cámara lista — apunta a una pieza", tone: "var(--muted)" },
  identifying: { label: "Identificando…", tone: "var(--info, var(--brand))" },
  identified: { label: "Identificado", tone: "var(--ok)" },
  uncertain: { label: "No estoy seguro — ¿es alguno de estos?", tone: "var(--warn)" },
  unknown: { label: "No lo reconozco todavía", tone: "var(--muted)" },
  unavailable: { label: "Reconocimiento automático no activado", tone: "var(--muted)" },
  error: { label: "Error de análisis — reintentando", tone: "var(--error)" },
};

export default function SenseVisionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stabilizerRef = useRef(createResultStabilizer());
  const seenRef = useRef(new Map<string, RecognizedLibraryItem>());

  const [camera, setCamera] = useState<CameraState>("starting");
  const [scan, setScan] = useState<ScanState>("waiting");
  const [online, setOnline] = useState(true);
  const [sampling, setSampling] = useState(true);
  const [result, setResult] = useState<VisionRecognizeResult | null>(null);
  const [shown, setShown] = useState<RecognizedLibraryItem | LibraryItemView | null>(null);
  const [shownSource, setShownSource] = useState<"scan" | "search">("scan");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [correctionNote, setCorrectionNote] = useState<string | null>(null);

  // ── Camera lifecycle ────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCamera("unsupported");
      return;
    }
    if (cameraBlockedByDocumentPolicy()) {
      // One full reload fetches this route's own headers; the flag prevents a loop.
      let reloaded = false;
      try {
        reloaded = sessionStorage.getItem(POLICY_RELOAD_KEY) === "1";
        if (!reloaded) sessionStorage.setItem(POLICY_RELOAD_KEY, "1");
      } catch {
        reloaded = true;
      }
      if (!reloaded) {
        window.location.reload();
        return;
      }
      setCamera("unsupported");
      return;
    }
    try {
      sessionStorage.removeItem(POLICY_RELOAD_KEY);
    } catch {
      /* storage unavailable — nothing to clear */
    }
    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      stabilizerRef.current.reset();
      setCamera("live");
      setScan((current) => (current === "unavailable" ? current : "waiting"));
      trackProductEvent("vision.scan_started");
    } catch (error) {
      const name = (error as { name?: string })?.name;
      setCamera(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" ? "unsupported" : "error");
    }
  }, []);

  useEffect(() => {
    void startCamera();
    const onVisibility = () => {
      if (document.hidden) {
        stopCamera();
        setCamera("paused");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // ── Result handling ─────────────────────────────────────────────────
  const applyResult = useCallback((next: VisionRecognizeResult) => {
    setResult(next);
    if (next.status === "unavailable") {
      setScan("unavailable");
      setSampling(false);
      return;
    }
    if (next.status === "error") {
      setScan("error");
      trackProductEvent("vision.scan_failed", { status: next.status, latencyMs: next.latencyMs });
      return;
    }

    trackProductEvent("vision.scan_completed", {
      status: next.status,
      latencyMs: next.latencyMs,
      confidence: next.object?.confidence ?? null,
      source: next.source,
    });
    if (next.status === "unknown") trackProductEvent("vision.recognition_unknown", { latencyMs: next.latencyMs, source: next.source });
    if (next.status === "uncertain") {
      trackProductEvent("vision.recognition_low_confidence", {
        latencyMs: next.latencyMs,
        confidence: next.object?.confidence ?? null,
        source: next.source,
      });
    }

    for (const candidate of [next.object, ...next.alternatives]) {
      if (candidate) seenRef.current.set(candidate.slug, candidate);
    }
    const { key, changed } = stabilizerRef.current.push({
      key: next.object?.slug ?? null,
      confidence: next.object?.confidence ?? 0,
    });
    if (key === undefined) return; // not stable yet — keep the previous card
    if (key === null) {
      setScan("unknown");
      if (changed) setShown(null);
      return;
    }
    const latest = next.object?.slug === key ? next.object : seenRef.current.get(key) ?? null;
    setScan(next.object?.slug === key && next.status === "uncertain" ? "uncertain" : "identified");
    if (latest) {
      setShown(latest);
      setShownSource("scan");
    }
    if (changed) {
      setCorrecting(false);
      setCorrectionNote(null);
      setSaveError(null);
    }
  }, []);

  // ── Sampling loop (≤ 1 request in flight, ~1 frame / 1.5 s) ─────────
  useEffect(() => {
    if (camera !== "live" || !sampling || !online) return;
    const sampler = createFrameSampler({
      capture: () => (videoRef.current && canvasRef.current ? captureVideoFrame(videoRef.current, canvasRef.current) : null),
      analyze: async (frame) => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        setScan((current) => (current === "waiting" || current === "error" ? "identifying" : current));
        try {
          return await recognizeFrame(frame, controller.signal);
        } finally {
          window.clearTimeout(timer);
        }
      },
      onResult: applyResult,
      onError: () => {
        setScan("error");
        trackProductEvent("vision.scan_failed", { status: "network", latencyMs: null });
      },
    });
    const interval = window.setInterval(() => void sampler.tick(), SAMPLE_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      sampler.stop();
    };
  }, [camera, sampling, online, applyResult]);

  // ── Actions ─────────────────────────────────────────────────────────
  const onSave = async (item: LibraryItemView) => {
    setSaveError(null);
    try {
      await saveWord(item.id, shownSource);
      setSaved((current) => ({ ...current, [item.id]: true }));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar");
    }
  };

  const recordCorrection = async (selected: LibraryItemView | null) => {
    const predicted = result?.object ?? null;
    try {
      await reportCorrection({
        predictedLibraryItemId: predicted?.id ?? (shown && "confidence" in shown ? shown.id : null),
        selectedLibraryItemId: selected?.id ?? null,
        predictedConfidence: predicted?.confidence ?? null,
        source: result?.source ?? "manual",
      });
      setCorrectionNote(selected ? `Gracias — anotamos que era “${selected.nameEn}”.` : "Gracias — lo anotamos como “no está en la lista”.");
    } catch {
      setCorrectionNote("No se pudo registrar la corrección. Intenta de nuevo.");
    }
    setCorrecting(false);
    if (selected) {
      setShown(selected);
      setShownSource("search");
      setSampling(false); // freeze on the user's choice until they resume
    }
  };

  const showManual = (item: LibraryItemView) => {
    setShown(item);
    setShownSource("search");
    setSampling(false);
    setCorrecting(false);
    setCorrectionNote(null);
    setSaveError(null);
  };

  const scanCopy = !online
    ? { label: "Sin conexión — la búsqueda y el análisis necesitan internet", tone: "var(--warn)" }
    : camera === "live" && !sampling && scan !== "unavailable"
      ? { label: "En pausa", tone: "var(--muted)" }
      : SCAN_COPY[scan];

  const shownConfidence = shown && "confidence" in shown ? shown.confidence : undefined;
  const alternatives = result?.status === "uncertain" && shown && result.object?.slug === shown.slug ? result.alternatives : [];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 40px", display: "grid", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
            <ScanSearch size={22} aria-hidden /> Sense Vision
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--muted)" }}>Apunta a una herramienta o pieza y aprende cómo se llama.</p>
        </div>
        <Link href="/worker/dictionary" className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40 }}>
          <BookOpen size={16} aria-hidden /> Mi Diccionario
        </Link>
      </header>

      {/* ── Live camera ─────────────────────────────────────────────── */}
      <section
        aria-label="Cámara en vivo"
        style={{
          position: "relative",
          background: "#000",
          borderRadius: "var(--radius-xl, 18px)",
          overflow: "hidden",
          aspectRatio: "3 / 4",
          maxHeight: "62vh",
          width: "100%",
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{ width: "100%", height: "100%", objectFit: "cover", display: camera === "live" ? "block" : "none" }}
        />
        <canvas ref={canvasRef} hidden />

        {camera !== "live" && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 24, textAlign: "center", color: "#fff" }}>
            <CameraPlaceholder state={camera} onRetry={() => void startCamera()} />
          </div>
        )}

        {camera === "live" && (
          <>
            <div
              role="status"
              aria-live="polite"
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                right: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 999,
                background: "rgba(0,0,0,.6)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {!online ? <WifiOff size={14} aria-hidden /> : <span style={{ width: 8, height: 8, borderRadius: 99, background: scanCopy.tone }} aria-hidden />}
              {scanCopy.label}
            </div>
            {scan !== "unavailable" && (
              <button
                type="button"
                onClick={() => setSampling((value) => !value)}
                aria-label={sampling ? "Pausar análisis" : "Reanudar análisis"}
                style={{
                  position: "absolute",
                  bottom: 12,
                  right: 12,
                  width: 48,
                  height: 48,
                  borderRadius: 99,
                  border: "none",
                  background: "rgba(0,0,0,.6)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                {sampling ? <Pause size={20} /> : <Play size={20} />}
              </button>
            )}
            {/* Aim reticle — a hint to center one object, not a detection box. */}
            <div aria-hidden style={{ position: "absolute", inset: "22% 18%", border: "2px dashed rgba(255,255,255,.45)", borderRadius: 16, pointerEvents: "none" }} />
          </>
        )}
      </section>

      {scan === "unavailable" && (
        <p role="note" style={{ margin: 0, padding: 12, borderRadius: 10, background: "var(--raised)", color: "var(--muted)", fontSize: 14 }}>
          El reconocimiento automático todavía no está activado en este entorno. Puedes buscar cualquier pieza por su nombre en inglés o español aquí abajo.
        </p>
      )}

      {/* ── Result card ─────────────────────────────────────────────── */}
      {shown ? (
        <WordCard
          item={shown}
          confidence={shownConfidence}
          actions={
            <>
              <button
                type="button"
                className="btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44 }}
                disabled={Boolean(saved[shown.id])}
                onClick={() => void onSave(shown)}
              >
                {saved[shown.id] ? <Check size={16} aria-hidden /> : <Star size={16} aria-hidden />}
                {saved[shown.id] ? "Guardada en Mi Diccionario" : "Save Word · Guardar"}
              </button>
              {shownSource === "scan" && (
                <button type="button" className="btn-ghost" style={{ minHeight: 44 }} onClick={() => setCorrecting((value) => !value)}>
                  Not this? · ¿No es esto?
                </button>
              )}
              {!sampling && camera === "live" && scan !== "unavailable" && (
                <button type="button" className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44 }} onClick={() => setSampling(true)}>
                  <RefreshCw size={14} aria-hidden /> Seguir escaneando
                </button>
              )}
            </>
          }
        />
      ) : (
        camera === "live" && scan !== "unavailable" && (
          <EmptyResult scan={scan} />
        )
      )}

      {saveError && <p role="alert" style={{ margin: 0, color: "var(--error)", fontSize: 13 }}>{saveError}</p>}
      {correctionNote && <p role="status" style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>{correctionNote}</p>}

      {alternatives.length > 0 && !correcting && (
        <section aria-label="Alternativas" style={{ display: "grid", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>¿O quizá es…?</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {alternatives.map((alt) => (
              <button key={alt.id} type="button" className="btn-ghost" style={{ minHeight: 44 }} onClick={() => void recordCorrection(alt)}>
                {alt.nameEn} · {alt.nameEs} ({Math.round(alt.confidence * 100)}%)
              </button>
            ))}
          </div>
        </section>
      )}

      {correcting && (
        <CorrectionPanel
          alternatives={result?.alternatives ?? []}
          currentId={shown?.id ?? null}
          onPick={(item) => void recordCorrection(item)}
          onNotListed={() => void recordCorrection(null)}
          onClose={() => setCorrecting(false)}
        />
      )}

      {/* ── Manual search ───────────────────────────────────────────── */}
      <ManualSearch online={online} onPick={showManual} />
    </div>
  );
}

function CameraPlaceholder({ state, onRetry }: { state: CameraState; onRetry: () => void }) {
  const copy: Record<Exclude<CameraState, "live">, { title: string; body: string; retry: boolean }> = {
    starting: { title: "Abriendo cámara…", body: "Si tu teléfono lo pide, permite el acceso a la cámara.", retry: false },
    denied: {
      title: "Cámara bloqueada",
      body: "Sense Vision necesita la cámara. Habilítala en los permisos del navegador y vuelve a intentar — o busca la pieza por nombre abajo.",
      retry: true,
    },
    unsupported: { title: "Cámara no disponible", body: "Este dispositivo o navegador no ofrece cámara. Usa la búsqueda manual abajo.", retry: true },
    error: { title: "No pudimos abrir la cámara", body: "Puede estar en uso por otra app. Ciérrala y reintenta.", retry: true },
    paused: { title: "Cámara en pausa", body: "La apagamos al salir de la pantalla para cuidar tu batería y privacidad.", retry: true },
  };
  const c = copy[state as Exclude<CameraState, "live">];
  return (
    <div style={{ display: "grid", gap: 10, justifyItems: "center", maxWidth: 320 }}>
      {state === "starting" ? <Camera size={36} aria-hidden /> : <CameraOff size={36} aria-hidden />}
      <strong style={{ fontSize: 17 }}>{c.title}</strong>
      <span style={{ fontSize: 14, opacity: 0.85 }}>{c.body}</span>
      {c.retry && (
        <button type="button" className="btn-primary" style={{ minHeight: 44 }} onClick={onRetry}>
          {state === "paused" ? "Reanudar cámara" : "Reintentar"}
        </button>
      )}
    </div>
  );
}

function EmptyResult({ scan }: { scan: ScanState }) {
  const text =
    scan === "unknown"
      ? "No reconozco esta pieza con suficiente seguridad. Acércate, mejora la luz o busca por nombre."
      : scan === "error"
        ? "Hubo un problema al analizar. Seguimos intentando con el siguiente cuadro."
        : "Centra una sola pieza dentro del recuadro y mantén el teléfono quieto un momento.";
  return (
    <div style={{ padding: 16, borderRadius: 14, border: "1px dashed var(--border)", color: "var(--muted)", fontSize: 14, textAlign: "center" }}>
      {scan === "identifying" ? <div className="skel" style={{ height: 96, borderRadius: 10 }} aria-label="Identificando" /> : text}
    </div>
  );
}

function CorrectionPanel({
  alternatives,
  currentId,
  onPick,
  onNotListed,
  onClose,
}: {
  alternatives: RecognizedLibraryItem[];
  currentId: string | null;
  onPick: (item: LibraryItemView) => void;
  onNotListed: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const results = useLibrarySearch(query, true);
  const options = useMemo(() => {
    const merged = new Map<string, LibraryItemView>();
    for (const item of [...alternatives, ...results.items]) if (item.id !== currentId) merged.set(item.id, item);
    return [...merged.values()].slice(0, 8);
  }, [alternatives, results.items, currentId]);

  return (
    <section aria-label="Corregir identificación" style={{ display: "grid", gap: 10, padding: 14, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: 15, color: "var(--ink)" }}>¿Qué es realmente?</h3>
        <button type="button" className="btn-ghost" aria-label="Cerrar" onClick={onClose} style={{ minHeight: 36 }}><X size={16} /></button>
      </div>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Escribe el nombre (inglés o español)"
        aria-label="Buscar la pieza correcta"
        style={{ minHeight: 44, padding: "0 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)", fontSize: 16 }}
      />
      <div style={{ display: "grid", gap: 6 }}>
        {options.map((item) => (
          <button key={item.id} type="button" className="btn-ghost" style={{ textAlign: "left", minHeight: 44 }} onClick={() => onPick(item)}>
            <strong>{item.nameEn}</strong> · {item.nameEs}
          </button>
        ))}
        <button type="button" className="btn-ghost" style={{ minHeight: 44 }} onClick={onNotListed}>
          No está en la lista
        </button>
      </div>
    </section>
  );
}

function useLibrarySearch(query: string, enabled: boolean) {
  const [state, setState] = useState<{ items: LibraryItemView[]; loading: boolean; error: string | null }>({ items: [], loading: false, error: null });
  useEffect(() => {
    const q = query.trim();
    if (!enabled || q.length < 2) {
      setState({ items: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));
    const timer = window.setTimeout(() => {
      searchLibrary({ q, limit: 8 })
        .then((data) => !cancelled && setState({ items: data.items, loading: false, error: null }))
        .catch(() => !cancelled && setState({ items: [], loading: false, error: "No se pudo buscar. Revisa tu conexión." }));
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, enabled]);
  return state;
}

function ManualSearch({ online, onPick }: { online: boolean; onPick: (item: LibraryItemView) => void }) {
  const [query, setQuery] = useState("");
  const { items, loading, error } = useLibrarySearch(query, online);
  const q = query.trim();
  return (
    <section aria-label="Búsqueda manual" style={{ display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 16, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
        <Search size={16} aria-hidden /> Buscar en la librería
      </h2>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="fish tape, cinta guía, channel locks…"
        aria-label="Buscar herramienta o material"
        disabled={!online}
        style={{ minHeight: 48, padding: "0 14px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 16 }}
      />
      {!online && <p style={{ margin: 0, fontSize: 13, color: "var(--warn)" }}>Sin conexión: la búsqueda vuelve cuando recuperes internet.</p>}
      {loading && <div className="skel" style={{ height: 44, borderRadius: 10 }} aria-label="Buscando" />}
      {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--error)" }}>{error}</p>}
      {!loading && !error && q.length >= 2 && items.length === 0 && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Nada con “{q}”. Prueba otro nombre o alias.</p>
      )}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onPick(item)}
              style={{
                width: "100%",
                textAlign: "left",
                minHeight: 52,
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--ink)",
                cursor: "pointer",
              }}
            >
              <strong>{item.nameEn}</strong>
              <span style={{ color: "var(--muted)" }}> · {item.nameEs}</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--faint)" }}>{item.category} · {item.subcategory}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
