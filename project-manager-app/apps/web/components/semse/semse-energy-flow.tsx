"use client";

import React, { useEffect, useState } from "react";
import { SEMSE_CORTEX, MONETIZATION_FLOWS } from "@/lib/data/semse-consciousness-topology";

interface EnergyParticle {
  id: string;
  x: number;
  y: number;
  life: number; // 0-1
  vx: number;
  vy: number;
}

interface SemseEnergyFlowProps {
  show: boolean;
}

export const SemseEnergyFlow: React.FC<SemseEnergyFlowProps> = ({ show }) => {
  const [particles, setParticles] = useState<EnergyParticle[]>([]);

  // Simular flujo de energía
  useEffect(() => {
    if (!show) return;

    const interval = setInterval(() => {
      setParticles((prev) => {
        // Remover partículas muertas
        const alive = prev.filter((p) => p.life > 0);

        // Actualizar partículas
        const updated = alive.map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          life: p.life - 0.02,
        }));

        // Agregar nuevas partículas (flujos de dinero)
        if (Math.random() > 0.3) {
          const flow = MONETIZATION_FLOWS[Math.floor(Math.random() * MONETIZATION_FLOWS.length)];
          updated.push({
            id: Math.random().toString(),
            x: Math.random() * 1200,
            y: Math.random() * 800,
            life: 1,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
          });
        }

        return updated;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [show]);

  if (!show) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-1 h-1 rounded-full bg-amber-400"
          style={{
            left: `${particle.x}px`,
            top: `${particle.y}px`,
            opacity: particle.life,
            boxShadow: `0 0 ${particle.life * 4}px #fbbf24`,
          }}
        />
      ))}
    </div>
  );
};
