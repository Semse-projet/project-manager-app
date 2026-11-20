"use client";

import { useEffect, useRef } from "react";
import { SemseDigitalTwinScene } from "./SemseDigitalTwinScene.ts";
import type {
  DigitalTwinPerspective,
  DigitalTwinPlayback,
  DigitalTwinSnapshot,
} from "@/lib/digital-twin/view-model";

interface Props {
  snapshot: DigitalTwinSnapshot;
  selectedId: string | null;
  perspective: DigitalTwinPerspective;
  activeFlowId: string;
  emphasisKey: string;
  playback: DigitalTwinPlayback | null;
  reducedMotion: boolean;
  resetToken: number;
  onSelect: (nodeId: string | null) => void;
  onUnavailable: () => void;
}

export default function SemseDigitalTwin3D(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SemseDigitalTwinScene | null>(null);
  const callbacksRef = useRef({ onSelect: props.onSelect, onUnavailable: props.onUnavailable });
  callbacksRef.current = { onSelect: props.onSelect, onUnavailable: props.onUnavailable };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let scene: SemseDigitalTwinScene | null = null;
    try {
      scene = new SemseDigitalTwinScene(container, props.snapshot, {
        selectedId: props.selectedId,
        perspective: props.perspective,
        activeFlowId: props.activeFlowId,
        emphasisKey: props.emphasisKey,
      }, {
        onSelect: (nodeId) => callbacksRef.current.onSelect(nodeId),
        onContextLost: () => callbacksRef.current.onUnavailable(),
      });
      sceneRef.current = scene;
      scene.setPlayback(props.playback, props.reducedMotion);
    } catch {
      callbacksRef.current.onUnavailable();
    }
    return () => {
      scene?.dispose();
      sceneRef.current = null;
    };
    // A new snapshot rebuilds GPU resources; interaction props update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.snapshot]);

  useEffect(() => {
    sceneRef.current?.setVisualState({
      selectedId: props.selectedId,
      perspective: props.perspective,
      activeFlowId: props.activeFlowId,
      emphasisKey: props.emphasisKey,
    });
  }, [props.selectedId, props.perspective, props.activeFlowId, props.emphasisKey]);

  useEffect(() => {
    sceneRef.current?.setPlayback(props.playback, props.reducedMotion);
  }, [props.playback, props.reducedMotion]);

  useEffect(() => {
    if (props.resetToken > 0) sceneRef.current?.resetCamera();
  }, [props.resetToken]);

  return <div ref={containerRef} className="absolute inset-0 overflow-hidden" data-testid="digital-twin-3d" />;
}
