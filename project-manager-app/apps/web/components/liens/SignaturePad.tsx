"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

/**
 * Minimal pointer-based signature pad. Emits a PNG data URL (base64), which
 * is what `POST /v1/projects/:projectId/liens/waivers/:waiverId/sign`
 * stores in `LienWaiver.signature`. Emits `null` while the pad is empty.
 *
 * The stroke color is read from the `--ink` token at draw time; the PNG keeps
 * a transparent background so it renders on any theme.
 */
export function SignaturePad({ onChange, height = 160 }: { onChange: (dataUrl: string | null) => void; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const context = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return null;
    return { canvas, ctx };
  }, []);

  useEffect(() => {
    const target = context();
    if (!target) return;
    const { canvas, ctx } = target;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.2;
  }, [context]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const target = context();
    if (!target) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    // Canvas 2D never resolves CSS var(); read the token's computed value.
    target.ctx.strokeStyle = getComputedStyle(event.currentTarget).getPropertyValue("--ink").trim() || "#0f172a";
    const { x, y } = point(event);
    target.ctx.beginPath();
    target.ctx.moveTo(x, y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const target = context();
    if (!target) return;
    const { x, y } = point(event);
    target.ctx.lineTo(x, y);
    target.ctx.stroke();
    if (!hasInk) setHasInk(true);
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const target = context();
    if (target && hasInk) onChange(target.canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const target = context();
    if (!target) return;
    target.ctx.clearRect(0, 0, target.canvas.width, target.canvas.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div>
      <div style={{ position: "relative", border: "1px dashed var(--border-2, var(--border))", borderRadius: 12, background: "var(--bg)" }}>
        <canvas
          ref={canvasRef}
          aria-label="Área de firma"
          role="img"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          style={{ display: "block", width: "100%", height, touchAction: "none", cursor: "crosshair" }}
        />
        {!hasInk ? (
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              pointerEvents: "none",
              color: "var(--faint)",
              fontSize: 13
            }}
          >
            Firma aquí con el mouse o el dedo
          </span>
        ) : null}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
        <button
          type="button"
          onClick={clear}
          disabled={!hasInk}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: "none",
            border: "none",
            color: hasInk ? "var(--muted)" : "var(--faint)",
            fontSize: 12,
            cursor: hasInk ? "pointer" : "default"
          }}
        >
          <Eraser size={12} aria-hidden /> Borrar
        </button>
      </div>
    </div>
  );
}
