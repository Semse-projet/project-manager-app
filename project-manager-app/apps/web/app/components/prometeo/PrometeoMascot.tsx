"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { shouldRender3D, type MascotMood } from "../../../lib/prometeo-mascot";

// three.js solo se descarga cuando la mascota realmente se muestra en 3D.
const PrometeoMascot3D = dynamic(() => import("./PrometeoMascot3D"), { ssr: false, loading: () => null });

function detectWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

class Mascot3DBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export type PrometeoMascotProps = {
  mood?: MascotMood;
  size?: number;
  onActivate?: () => void;
  label?: string;
};

/**
 * Mascota de Prometeo: robot 3D interactivo (sigue el cursor, saluda, reacciona al estado del asistente y se
 * puede girar arrastrando). Sin WebGL, o con "reducir movimiento", se muestra la imagen de marca.
 */
export function PrometeoMascot({ mood = "idle", size = 120, onActivate, label = "Prometeo" }: PrometeoMascotProps) {
  const [use3D, setUse3D] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  // "Reducir movimiento" se lee al montar Y se vigila: si el usuario lo cambia con la página abierta, la mascota cambia
  // entre el 3D y la imagen sin recargar.
  useEffect(() => {
    const webgl = detectWebgl();
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const apply = () => setUse3D(shouldRender3D({ webgl, reducedMotion: query?.matches ?? false }));
    apply();
    query?.addEventListener?.("change", apply);
    return () => query?.removeEventListener?.("change", apply);
  }, []);

  const fallback = (
    <button
      type="button"
      onClick={onActivate}
      aria-label={label}
      style={{ width: size, height: size }}
      className="flex items-center justify-center overflow-hidden rounded-full bg-slate-900 shadow-lg transition hover:scale-105"
    >
      <Image src="/brand/prometeo/avatar-256.png" alt="" width={size} height={size} className="h-full w-full object-cover" />
    </button>
  );

  if (!use3D || contextLost) return fallback;
  return (
    <Mascot3DBoundary fallback={fallback}>
      <PrometeoMascot3D mood={mood} size={size} onActivate={onActivate} onContextLost={() => setContextLost(true)} label={label} />
    </Mascot3DBoundary>
  );
}
