"use client";

import { useEffect, useRef } from "react";
import { MascotScene } from "../../../lib/prometeo-mascot-scene";
import type { MascotMood } from "../../../lib/prometeo-mascot";

export type PrometeoMascot3DProps = {
  mood?: MascotMood;
  size?: number;
  onActivate?: () => void;
  label?: string;
};

/** Montaje React de la escena 3D. El lienzo se crea una vez; `mood` y `onActivate` se actualizan sin recrearla. */
export default function PrometeoMascot3D({ mood = "idle", size = 120, onActivate, label = "Prometeo" }: PrometeoMascot3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<MascotScene | null>(null);
  const activateRef = useRef(onActivate);
  activateRef.current = onActivate;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new MascotScene(canvas, { onActivate: () => activateRef.current?.() });
    scene.resize(size);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // El tamaño se aplica en el efecto de abajo; la escena no se recrea por él.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sceneRef.current?.resize(size);
  }, [size]);

  useEffect(() => {
    sceneRef.current?.setMood(mood);
  }, [mood]);

  return (
    <canvas
      ref={canvasRef}
      role="button"
      tabIndex={0}
      aria-label={label}
      style={{ width: size, height: size, touchAction: "none", outline: "none", display: "block" }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate?.();
        }
      }}
    />
  );
}
