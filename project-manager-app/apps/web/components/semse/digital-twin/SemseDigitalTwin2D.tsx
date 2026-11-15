"use client";

import { createDigitalTwinLayout, createDomainLayout } from "@/lib/digital-twin/layout";
import {
  DOMAIN_BY_ID,
  type DigitalTwinPlayback,
  type DigitalTwinPerspective,
  type DigitalTwinSnapshot,
} from "@/lib/digital-twin/view-model";

interface Props {
  snapshot: DigitalTwinSnapshot;
  selectedId: string | null;
  perspective: DigitalTwinPerspective;
  activeFlowId: string;
  emphasisKey: string;
  playback: DigitalTwinPlayback | null;
  reducedMotion: boolean;
  onSelect: (nodeId: string | null) => void;
}

const HEALTH_COLORS = { critical: "#F87171", high: "#FBBF24", medium: "#60A5FA", low: "#64748B" };

export function SemseDigitalTwin2D({
  snapshot, selectedId, perspective, activeFlowId, emphasisKey, playback, reducedMotion, onSelect,
}: Props) {
  const positions = createDigitalTwinLayout(snapshot.nodes);
  const domains = createDomainLayout();
  const emphasized = new Set(emphasisKey.split(",").filter(Boolean));
  const activeFlow = snapshot.flows.find((flow) => flow.id === activeFlowId);
  const activeEdges = new Set(activeFlow?.edgeIds ?? []);
  const flowNodes = new Set(activeFlow?.nodeIds ?? []);
  const playbackFlow = playback ? snapshot.flows.find((flow) => flow.id === playback.flowId) : undefined;
  const motionPath = playbackFlow?.nodeIds.map((id) => positions[id]).filter(Boolean)
    .map((position, index) => `${index === 0 ? "M" : "L"} ${position.x} ${position.z}`).join(" ");
  const finalPosition = playbackFlow ? positions[playbackFlow.nodeIds.at(-1) ?? ""] : undefined;

  return (
    <div className="absolute inset-0 overflow-auto bg-[#060B14] p-2" data-testid="digital-twin-2d">
      <svg
        viewBox="-23 -19 46 38"
        className="h-full min-h-[480px] w-full min-w-[620px] select-none"
        role="group"
        aria-label="Vista 2D interactiva del ecosistema"
      >
        <rect x="-23" y="-19" width="46" height="38" fill="#060B14" />
        {domains.map((domainPosition) => {
          const domain = DOMAIN_BY_ID[domainPosition.id];
          const count = snapshot.nodes.filter((node) => node.canonicalDomain === domain.id).length;
          return (
            <g key={domain.id} aria-hidden="true">
              <circle cx={domainPosition.x} cy={domainPosition.z} r="5.25" fill={domain.color} fillOpacity="0.035" stroke={domain.color} strokeOpacity="0.45" strokeWidth="0.06" />
              <text x={domainPosition.x} y={domainPosition.z - 5.65} textAnchor="middle" fill={domain.color} fontSize="0.58" fontWeight="700" letterSpacing="0.05">
                {domain.shortLabel.toUpperCase()} · {count}
              </text>
            </g>
          );
        })}
        {snapshot.edges.map((edge) => {
          const source = positions[edge.source];
          const target = positions[edge.target];
          if (!source || !target) return null;
          const isFlow = perspective === "flows" && activeEdges.has(edge.id);
          const isSelected = edge.source === selectedId || edge.target === selectedId;
          return (
            <line
              key={edge.id} x1={source.x} y1={source.z} x2={target.x} y2={target.z}
              stroke={isFlow ? "#D4A853" : isSelected ? "#2EC4B6" : "#243247"}
              strokeWidth={isFlow ? 0.14 : 0.07} strokeOpacity={isFlow || isSelected ? 0.95 : 0.58}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {snapshot.nodes.map((node) => {
          const position = positions[node.id];
          if (!position) return null;
          const isSelected = node.id === selectedId;
          const isEmphasized = emphasized.size === 0 || emphasized.has(node.id);
          const isOutsideFlow = perspective === "flows" && activeFlow && !flowNodes.has(node.id);
          const fill = perspective === "health" ? HEALTH_COLORS[node.criticality] : DOMAIN_BY_ID[node.canonicalDomain].color;
          return (
            <g
              key={node.id}
              transform={`translate(${position.x} ${position.z})`}
              role="button"
              aria-label={`${node.label}, ${DOMAIN_BY_ID[node.canonicalDomain].label}`}
              aria-pressed={isSelected}
              tabIndex={isEmphasized ? 0 : -1}
              className="cursor-pointer outline-none focus-visible:outline-none"
              opacity={!isEmphasized ? 0.2 : isOutsideFlow ? 0.28 : 1}
              onClick={() => onSelect(node.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(node.id);
                }
                if (event.key === "Escape") onSelect(null);
              }}
            >
              <title>{node.label} — {node.description}</title>
              {isSelected && <circle r="0.9" fill="none" stroke="#E8EDF3" strokeWidth="0.09" />}
              <circle r={isSelected ? 0.62 : 0.46} fill={fill} stroke={isSelected ? "#FFFFFF" : "#060B14"} strokeWidth="0.08" />
              <circle r="0.14" fill="#E8EDF3" fillOpacity="0.75" pointerEvents="none" />
              {isSelected && (
                <text y="-1.15" textAnchor="middle" fill="#E8EDF3" fontSize="0.7" fontWeight="700" pointerEvents="none">
                  {node.label}
                </text>
              )}
            </g>
          );
        })}
        {playbackFlow && finalPosition && reducedMotion && (
          <circle cx={finalPosition.x} cy={finalPosition.z} r="0.28" fill="#FDE68A" stroke="#D4A853" strokeWidth="0.12" pointerEvents="none" />
        )}
        {playbackFlow && motionPath && !reducedMotion && (
          <circle key={playback?.nonce} r="0.3" fill="#FDE68A" stroke="#D4A853" strokeWidth="0.12" pointerEvents="none">
            <animateMotion path={motionPath} dur={`${(playbackFlow.nodeIds.length - 1) * 0.65}s`} repeatCount="1" fill="freeze" />
          </circle>
        )}
      </svg>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-white/10 bg-[#0B1220]/90 px-3 py-1.5 text-[10px] text-slate-400">
        Proyección del mismo layout 3D · Tab para recorrer nodos
      </div>
    </div>
  );
}
