"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  SEMSE_NEURONS,
  SEMSE_SYNAPSES,
  SEMSE_CORTEX,
  Neuron,
  Synapse,
  CortexType,
} from "@/lib/data/semse-consciousness-topology";

interface NeuralGraphProps {
  selectedNeuron: string | null;
  onSelectNeuron: (id: string) => void;
  activeCortex: CortexType | null;
}

export const SemseNeuralGraph: React.FC<NeuralGraphProps> = ({
  selectedNeuron,
  onSelectNeuron,
  activeCortex,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }> | null>(null);

  // Inicializar posiciones de neuronas en círculos por cortex
  useEffect(() => {
    const newPositions = new Map<string, { x: number; y: number }>();
    const width = 1200;
    const height = 800;
    const centerX = width / 2;
    const centerY = height / 2;

    // Posicionar cortex en círculo mayor
    const cortexRadius = 250;
    const cortexEntries = Object.entries(SEMSE_CORTEX);

    cortexEntries.forEach((entry, idx) => {
      const [cortexId, cortex] = entry;
      const angle = (idx / cortexEntries.length) * Math.PI * 2;
      const cortexX = centerX + Math.cos(angle) * cortexRadius;
      const cortexY = centerY + Math.sin(angle) * cortexRadius;

      // Posicionar neuronas en círculo alrededor de su cortex
      const neuronRadius = 80;
      cortex.neurons.forEach((neuron, nIdx) => {
        const nAngle = (nIdx / cortex.neurons.length) * Math.PI * 2;
        const nX = cortexX + Math.cos(nAngle) * neuronRadius;
        const nY = cortexY + Math.sin(nAngle) * neuronRadius;
        newPositions.set(neuron.id, { x: nX, y: nY });
      });
    });

    setPositions(newPositions);
  }, []);

  // Renderizar grafo en canvas
  useEffect(() => {
    if (!canvasRef.current || !positions) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Limpiar canvas
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dibujar sinapsis (conexiones)
    ctx.globalAlpha = 0.3;
    SEMSE_SYNAPSES.forEach((synapse) => {
      const source = positions.get(synapse.source);
      const target = positions.get(synapse.target);
      if (!source || !target) return;

      // Color según tipo
      const strengthColor: Record<string, string> = {
        weak: "#4b5563",
        medium: "#64748b",
        strong: "#cbd5e1",
        critical: "#ef4444",
      };

      ctx.strokeStyle = strengthColor[synapse.strength] || "#64748b";
      ctx.lineWidth = synapse.strength === "critical" ? 3 : 1;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    });

    // Dibujar neuronas
    ctx.globalAlpha = 1;
    Object.entries(SEMSE_NEURONS).forEach(([id, neuron]) => {
      const pos = positions.get(id);
      if (!pos) return;

      const cortex = SEMSE_CORTEX[neuron.cortex];
      const isSelected = id === selectedNeuron;
      const isInActiveCortex = !activeCortex || neuron.cortex === activeCortex;

      // Tamaño según criticidad
      const sizeMap = { low: 4, medium: 6, high: 8, critical: 10 };
      const radius = sizeMap[neuron.criticality] || 6;

      // Color según cortex
      const alpha = isInActiveCortex ? 1 : 0.2;
      ctx.globalAlpha = alpha;

      // Brillo según energía
      const brightness = Math.min(100, neuron.energy + 50);
      ctx.fillStyle = cortex.color;
      ctx.shadowBlur = brightness / 10;
      ctx.shadowColor = cortex.color;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Anillo de selección
      if (isSelected) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    ctx.shadowBlur = 0;
  }, [positions, selectedNeuron, activeCortex]);

  // Manejo de clicks
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!positions) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Buscar neurona cercana
    let closestNeuron: string | null = null;
    let closestDistance = 15;

    positions.forEach((pos, id) => {
      const distance = Math.hypot(pos.x - x, pos.y - y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestNeuron = id;
      }
    });

    if (closestNeuron) {
      onSelectNeuron(closestNeuron);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={800}
      onClick={handleCanvasClick}
      className="w-full border border-slate-700 bg-slate-950 rounded-lg cursor-pointer"
    />
  );
};
