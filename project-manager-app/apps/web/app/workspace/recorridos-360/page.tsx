"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, RotateCcw } from "lucide-react";
import { LocalPanoramaViewer } from "../components/LocalPanoramaViewer";
import { isLikelyEquirectangular, validateLocalPanoramaFile } from "../lib/panorama-validation";

/**
 * Preview in this browser only. It deliberately does not create an Evidence
 * entity, a CaptureSession, any cross-organization data or a reconstruction job.
 */
export default function LocalPanoramaPreviewPage() {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const nextSelection = useRef(0);

  useEffect(() => {
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [objectUrl]);

  useEffect(() => {
    return () => { nextSelection.current += 1; };
  }, []);

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const requestId = ++nextSelection.current;
    if (!file) return;
    setChecking(true);
    setError(null);

    const basicError = validateLocalPanoramaFile(file);
    if (basicError) {
      setError(basicError);
      setChecking(false);
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      const accepted = isLikelyEquirectangular(bitmap.width, bitmap.height);
      bitmap.close();
      if (requestId !== nextSelection.current) return;
      if (!accepted) {
        setError("Esta fotografía no parece ser un panorama equirectangular 360° (relación cercana a 2:1). No es posible reconstruir una escena desde una foto ordinaria en este visor.");
        return;
      }
      setObjectUrl(URL.createObjectURL(file));
      setFilename(file.name);
    } catch {
      if (requestId === nextSelection.current) {
        setError("No se pudo decodificar la imagen. Exporta el panorama en formato JPG, PNG o WebP.");
      }
    } finally {
      if (requestId === nextSelection.current) setChecking(false);
    }
  }

  function clearPreview() {
    nextSelection.current += 1;
    setObjectUrl(null);
    setFilename(null);
    setError(null);
    setChecking(false);
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
            Prueba local: abre una fotografía panorámica equirectangular 360° y explora la vista moviendo el dedo, el mouse o las flechas.
          </p>
        </header>
        <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
          <p className="rounded-lg border border-[var(--border)] bg-[var(--raised)] p-3 text-sm text-[var(--muted)]">
            <strong className="text-[var(--ink)]">Solo vista previa en tu dispositivo.</strong> La imagen no se sube,
            no queda guardada como evidencia y no se comparte con Prometeo ni con terceros. Esta función no
            combina fotos ni reconstruye el sitio en 3D; esas etapas requieren el flujo Evidence y procesamiento autorizado.
          </p>
          <label className="flex flex-col gap-2 text-sm font-semibold" htmlFor="workspace-panorama-file">
            Selecciona un panorama JPG, PNG o WebP de hasta 30 MB (aproximadamente 2:1).
            <input
              id="workspace-panorama-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => { void selectFile(event); }}
              disabled={checking}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 text-sm"
            />
          </label>
          {checking && <p role="status" className="text-sm text-[var(--muted)]">Verificando la fotografía…</p>}
          {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
          {objectUrl && filename ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="break-all text-sm text-[var(--muted)]">Vista previa: {filename}</p>
                <button type="button" onClick={clearPreview} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--raised)]">
                  <RotateCcw className="h-4 w-4" /> Cerrar vista
                </button>
              </div>
              <LocalPanoramaViewer key={objectUrl} src={objectUrl} />
              <p className="text-xs text-[var(--muted)]">
                Arrastra para girar. Usa la rueda o +/- para acercar. No utilizar para mediciones ni decisiones de perforación.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--raised)] p-10 text-center text-sm text-[var(--muted)]">
              Todavía no has seleccionado una imagen. El visor no muestra escenas de demostración como si fueran evidencia de una obra.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
