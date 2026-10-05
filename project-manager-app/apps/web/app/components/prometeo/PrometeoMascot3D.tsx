"use client";

import { useEffect, useRef, useState } from "react";
import { MascotScene } from "../../../lib/prometeo-mascot-scene";
import type { MascotMood } from "../../../lib/prometeo-mascot";

export type PrometeoMascot3DProps = {
  mood?: MascotMood;
  size?: number;
  onActivate?: () => void;
  /** Se invoca si el navegador pierde el contexto WebGL: el padre muestra la imagen de marca. */
  onContextLost?: () => void;
  label?: string;
};

/**
 * Montaje React de la escena 3D. Cada escena crea su PROPIO `<canvas>`: al desmontar se pierde su contexto WebGL
 * (`forceContextLoss`) y reutilizar el mismo elemento (React StrictMode monta, desmonta y vuelve a montar)
 * dejaría un lienzo inservible. `mood` y `onActivate` se actualizan sin recrear la escena.
 */
export default function PrometeoMascot3D({ mood = "idle", size = 120, onActivate, onContextLost, label = "Prometeo" }: PrometeoMascot3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MascotScene | null>(null);
  const activateRef = useRef(onActivate);
  const contextLostRef = useRef(onContextLost);
  const [focusVisible, setFocusVisible] = useState(false);
  contextLostRef.current = onContextLost;
  const sizeRef = useRef(size);
  const moodRef = useRef(mood);
  activateRef.current = onActivate;
  sizeRef.current = size;
  moodRef.current = mood;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, { display: "block", width: "100%", height: "100%", touchAction: "none", outline: "none" });
    host.appendChild(canvas);
    const scene = new MascotScene(canvas, {
      onActivate: () => activateRef.current?.(),
      onContextLost: () => contextLostRef.current?.(),
    });
    scene.resize(sizeRef.current);
    scene.setMood(moodRef.current);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
      canvas.remove();
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.resize(size);
  }, [size]);

  useEffect(() => {
    sceneRef.current?.setMood(mood);
  }, [mood]);

  return (
    <div
      ref={hostRef}
      role="button"
      tabIndex={0}
      aria-label={label}
      // El foco por teclado debe verse: un anillo cian solo con :focus-visible (no al hacer clic con el ratón).
      onFocus={(e) => setFocusVisible(e.currentTarget.matches(":focus-visible"))}
      onBlur={() => setFocusVisible(false)}
      style={{
        width: size,
        height: size,
        outline: focusVisible ? "3px solid #29d3ff" : "none",
        outlineOffset: 2,
        borderRadius: 24,
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate?.();
        }
      }}
    />
  );
}
