"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { LocalPanoramaViewer } from "../components/LocalPanoramaViewer";
import { validateLocalPanoramaFile, validateLocalTourBatch, validatePanoramaDimensions } from "../lib/panorama-validation";

type Station = { id: string; filename: string; objectUrl: string; size: number };

/** Local only. No upload, Evidence registration, geometry reconstruction or Org scope. */
export default function LocalPanoramaPreviewPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestNumber = useRef(0);
  const createdUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = createdUrls.current;
    return () => {
      requestNumber.current++;
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const currentIndex = Math.max(0, stations.findIndex((item) => item.id === activeId));
  const current = stations[currentIndex] ?? null;

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!incoming.length || checking) return;
    const requestId = ++requestNumber.current;
    setChecking(true);
    setError(null);

    const batchError = validateLocalTourBatch(stations.map((item) => item.size), incoming.map((item) => item.size));
    if (batchError) {
      setError(batchError);
      setChecking(false);
      return;
    }

    try {
      for (const file of incoming) {
        const errorMessage = validateLocalPanoramaFile(file);
        if (errorMessage) throw new Error(file.name + ": " + errorMessage);
        const bitmap = await createImageBitmap(file);
        const dimensionsError = validatePanoramaDimensions(bitmap.width, bitmap.height);
        bitmap.close();
        if (dimensionsError) throw new Error(file.name + ": " + dimensionsError);
        if (requestNumber.current !== requestId) return;
      }
      const added = incoming.map((file) => {
        const objectUrl = URL.createObjectURL(file);
        createdUrls.current.add(objectUrl);
        return { id: crypto.randomUUID(), filename: file.name, objectUrl, size: file.size };
      });
      setStations((old) => [...old, ...added]);
      setActiveId((old) => old ?? added[0].id);
    } catch (e) {
      if (requestNumber.current === requestId) {
        setError(e instanceof Error ? e.message : "No se pudieron procesar las fotografías.");
      }
    } finally {
      if (requestNumber.current === requestId) setChecking(false);
    }
  }

  function clearTour() {
    requestNumber.current++;
    createdUrls.current.forEach((url) => URL.revokeObjectURL(url));
    createdUrls.current.clear();
    setStations([]);
    setActiveId(null);
    setError(null);
    setChecking(false);
  }

  function moveTo(index: number) {
    if (index < 0 || index >= stations.length) return;
    setActiveId(stations[index].id);
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] p-4 text-[var(--ink)] sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/workspace" className="inline-flex items-center gap-2 text-sm text-[var(--brand)]">
          <ArrowLeft className="h-4 w-4" /> Volver al Workspace
        </Link>
        <header className="space-y-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Camera className="h-6 w-6 text-[var(--brand)]" /> Recorridos 360°
          </h1>
          <p className="text-[var(--muted)]">
            Abre varias panorámicas equirectangulares y recórrelas como estaciones conectadas.
          </p>
        </header>
        <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
          <p className="rounded-lg border border-[var(--border)] bg-[var(--raised)] p-3 text-sm text-[var(--muted)]">
            <strong className="text-[var(--ink)]">Solo vista previa local.</strong> Las fotos no se suben
            ni se registran como evidencia. Cada estación es una fotografía separada.
            No se reconstruyen superficies 3D ni cambios históricos entre fechas.
          </p>
          <label className="flex flex-col gap-2 text-sm font-semibold" htmlFor="workspace-panorama-files">
            Selecciona hasta seis panoramas JPG, PNG o WebP (formato 2:1, máximo 60 MB en conjunto).
            <input
              id="workspace-panorama-files"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => { void addFiles(event); }}
              disabled={checking}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 text-sm"
            />
          </label>
          {checking && <p role="status" className="text-sm text-[var(--muted)]">Comprobando las imágenes…</p>}
          {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
          {current ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="break-all text-sm text-[var(--muted)]">
                  Estación {currentIndex + 1} de {stations.length}: {current.filename}
                </p>
                <button type="button" onClick={clearTour} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--raised)]">
                  <RotateCcw className="h-4 w-4" /> Cerrar recorrido
                </button>
              </div>
              <LocalPanoramaViewer key={current.objectUrl} src={current.objectUrl} />
              <nav aria-label="Estaciones del recorrido" className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => moveTo(currentIndex - 1)} disabled={currentIndex === 0} aria-label="Estación anterior" className="rounded-lg border border-[var(--border)] p-2 disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {stations.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => moveTo(index)}
                    aria-current={current.id === item.id ? "step" : undefined}
                    title={item.filename}
                    className={current.id === item.id
                      ? "rounded-lg bg-[var(--brand-dim)] px-3 py-2 text-sm font-semibold text-[var(--brand)]"
                      : "rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--raised)]"}
                  >
                    Punto {index + 1}
                  </button>
                ))}
                <button type="button" onClick={() => moveTo(currentIndex + 1)} disabled={currentIndex === stations.length - 1} aria-label="Estación siguiente" className="rounded-lg border border-[var(--border)] p-2 disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </nav>
              <p className="text-xs text-[var(--muted)]">
                Arrastra o usa las flechas para girar. Rueda o +/- para acercar. El paso entre estaciones no calcula vistas intermedias.
                No usar para mediciones ni decisiones de perforación.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--raised)] p-10 text-center text-sm text-[var(--muted)]">
              Ninguna panorámica seleccionada. No mostramos escenas ficticias como evidencia de una obra.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
