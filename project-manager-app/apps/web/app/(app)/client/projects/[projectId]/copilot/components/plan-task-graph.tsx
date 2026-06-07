"use client";

import { useRef, useState } from "react";
import type { CopilotWorkPlan, WorkPlanStep } from "../../../../../../semse-api";

// ── Layout algorithm ──────────────────────────────────────────────────────────

type StepNode = {
  step: WorkPlanStep;
  col: number;
  row: number;
  x: number;
  y: number;
};

const NODE_W = 180;
const NODE_H = 72;
const COL_GAP = 56;
const ROW_GAP = 16;

function buildLayout(steps: WorkPlanStep[]): StepNode[] {
  if (steps.length === 0) return [];

  const byId = new Map(steps.map((s) => [s.id, s]));

  // Topological level (column) assignment via longest path from roots
  const levels = new Map<string, number>();

  function getLevel(id: string): number {
    if (levels.has(id)) return levels.get(id)!;
    const step = byId.get(id);
    if (!step || !step.dependsOnStepIds?.length) {
      levels.set(id, 0);
      return 0;
    }
    const parentMax = Math.max(...step.dependsOnStepIds.map((pid: string) => getLevel(pid)));
    const level = parentMax + 1;
    levels.set(id, level);
    return level;
  }

  steps.forEach((s) => getLevel(s.id));

  // Group by column
  const cols = new Map<number, WorkPlanStep[]>();
  for (const s of steps) {
    const col = levels.get(s.id) ?? 0;
    if (!cols.has(col)) cols.set(col, []);
    cols.get(col)!.push(s);
  }

  // Assign positions
  const nodes: StepNode[] = [];
  const sortedCols = Array.from(cols.keys()).sort((a, b) => a - b);

  for (const col of sortedCols) {
    const colSteps = cols.get(col)!;
    for (let row = 0; row < colSteps.length; row++) {
      const x = col * (NODE_W + COL_GAP);
      const y = row * (NODE_H + ROW_GAP);
      nodes.push({ step: colSteps[row]!, col, row, x, y });
    }
  }

  return nodes;
}

// ── Visual constants ──────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  pending:   { bg: "rgba(100,116,139,.08)", border: "rgba(100,116,139,.25)", text: "var(--ink)",  dot: "var(--faint)" },
  ready:     { bg: "rgba(129,140,248,.12)", border: "rgba(129,140,248,.45)", text: "#818cf8",     dot: "#818cf8" },
  executing: { bg: "rgba(99,102,241,.15)",  border: "rgba(99,102,241,.55)",  text: "#6366f1",     dot: "#6366f1" },
  completed: { bg: "rgba(16,185,129,.10)",  border: "rgba(16,185,129,.40)",  text: "#10b981",     dot: "#10b981" },
  blocked:   { bg: "rgba(245,158,11,.10)",  border: "rgba(245,158,11,.40)",  text: "#f59e0b",     dot: "#f59e0b" },
  failed:    { bg: "rgba(239,68,68,.10)",   border: "rgba(239,68,68,.40)",   text: "#ef4444",     dot: "#ef4444" },
  skipped:   { bg: "rgba(100,116,139,.06)", border: "rgba(100,116,139,.18)", text: "var(--faint)", dot: "var(--faint)" },
};

const RISK_COLORS: Record<string, string> = { low: "#10b981", medium: "#f59e0b", high: "#ef4444" };

const CAPABILITY_EMOJI: Record<string, string> = {
  searching:    "🔍",
  dispute:      "⚖️",
  shelling:     "💻",
  editing:      "✏️",
  testing:      "🧪",
  waiting:      "⏳",
  worker:       "⚙️",
  composing:    "📝",
  clouding:     "☁️",
  perambulating:"🗺️",
  delegating:   "🤝",
};

const STATUS_GLYPH: Record<string, string> = {
  completed: "✓",
  failed:    "✗",
  blocked:   "!",
  executing: "▶",
  ready:     "○",
  skipped:   "⤼",
  pending:   "·",
};

// ── SVG arrows ────────────────────────────────────────────────────────────────

function Arrow({ fromX, fromY, toX, toY, blocked }: {
  fromX: number; fromY: number; toX: number; toY: number; blocked: boolean;
}) {
  // Draw a smooth bezier curve from right edge of source to left edge of target
  const mx = (fromX + toX) / 2;
  const d = `M ${fromX} ${fromY} C ${mx} ${fromY}, ${mx} ${toY}, ${toX} ${toY}`;
  const color = blocked ? "rgba(245,158,11,.5)" : "rgba(129,140,248,.4)";
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray={blocked ? "4 3" : "none"} />
      {/* arrowhead */}
      <polygon
        points={`${toX},${toY} ${toX - 7},${toY - 4} ${toX - 7},${toY + 4}`}
        fill={color}
      />
    </g>
  );
}

// ── Step node ─────────────────────────────────────────────────────────────────

function StepNodeCard({
  node,
  isCurrent,
  isSelected,
  onClick,
}: {
  node: StepNode;
  isCurrent: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { step, x, y } = node;
  const style = STATUS_STYLE[step.status] ?? STATUS_STYLE.pending!;
  const glyph = STATUS_GLYPH[step.status] ?? "·";
  const emoji = CAPABILITY_EMOJI[step.capability] ?? "⚙️";
  const riskColor = RISK_COLORS[step.riskLevel] ?? "var(--muted)";

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      {/* Outer glow for current step */}
      {isCurrent && (
        <rect
          x={-3} y={-3} width={NODE_W + 6} height={NODE_H + 6}
          rx={11} fill="none"
          stroke="rgba(99,102,241,.5)" strokeWidth={2}
          strokeDasharray="6 3"
        />
      )}

      {/* Node background */}
      <rect
        x={0} y={0} width={NODE_W} height={NODE_H}
        rx={9} fill={style.bg}
        stroke={isSelected ? "#818cf8" : style.border}
        strokeWidth={isSelected ? 2 : 1}
      />

      {/* Status dot */}
      <circle cx={14} cy={16} r={5} fill={style.dot} />

      {/* Capability emoji */}
      <text x={NODE_W - 14} y={20} fontSize={13} textAnchor="middle" dominantBaseline="middle">
        {emoji}
      </text>

      {/* Title */}
      <text x={8} y={34} fontSize={11} fontWeight={600} fill={style.text}
        clipPath={`url(#clip-${step.id})`}>
        {step.title.length > 22 ? step.title.slice(0, 21) + "…" : step.title}
      </text>

      {/* Status + risk row */}
      <text x={8} y={50} fontSize={10} fill="var(--muted)">
        {glyph} {step.status}
      </text>
      <text x={NODE_W - 8} y={50} fontSize={10} fill={riskColor} textAnchor="end" fontWeight={700}>
        {step.riskLevel}
      </text>

      {/* Approval badge */}
      {step.requiresApproval && (
        <rect x={NODE_W - 38} y={54} width={32} height={13} rx={4}
          fill="rgba(245,158,11,.18)" stroke="rgba(245,158,11,.3)" strokeWidth={0.5} />
      )}
      {step.requiresApproval && (
        <text x={NODE_W - 22} y={63} fontSize={8} fill="#f59e0b" textAnchor="middle" fontWeight={700}>
          APROV
        </text>
      )}

      {/* Clip path */}
      <defs>
        <clipPath id={`clip-${step.id}`}>
          <rect x={8} y={26} width={NODE_W - 36} height={18} />
        </clipPath>
      </defs>
    </g>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function StepDetail({ step, onClose }: { step: WorkPlanStep; onClose: () => void }) {
  return (
    <div style={{
      marginTop: 12, padding: "14px 16px", borderRadius: 12,
      border: "1px solid rgba(99,102,241,.3)", background: "rgba(99,102,241,.04)",
      display: "grid", gap: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>{step.title}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{step.description}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 16 }}>✕</button>
      </div>

      {step.expectedOutcome && (
        <div style={{ fontSize: 11, color: "var(--ink)" }}>
          <span style={{ color: "var(--muted)", fontWeight: 700 }}>Resultado: </span>
          {step.expectedOutcome}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "rgba(99,102,241,.1)", color: "#818cf8", fontWeight: 700 }}>
          {CAPABILITY_EMOJI[step.capability] ?? "⚙️"} {step.capability}
        </span>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: `${RISK_COLORS[step.riskLevel] ?? "var(--muted)"}18`, color: RISK_COLORS[step.riskLevel] ?? "var(--muted)", fontWeight: 700 }}>
          riesgo: {step.riskLevel}
        </span>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--muted)" }}>
          {STATUS_GLYPH[step.status] ?? "·"} {step.status}
        </span>
      </div>

      {step.toolsAllowed.length > 0 && (
        <div style={{ fontSize: 10, color: "var(--muted)" }}>
          <span style={{ fontWeight: 700 }}>Tools: </span>{step.toolsAllowed.join(", ")}
        </div>
      )}
      {step.dependsOnStepIds && step.dependsOnStepIds.length > 0 && (
        <div style={{ fontSize: 10, color: "var(--muted)" }}>
          <span style={{ fontWeight: 700 }}>Depende de: </span>{step.dependsOnStepIds.join(", ")}
        </div>
      )}
      {step.requiredEvidence && step.requiredEvidence.length > 0 && (
        <div style={{ fontSize: 10, color: "#f59e0b" }}>
          <span style={{ fontWeight: 700 }}>Evidencia: </span>{step.requiredEvidence.join(", ")}
        </div>
      )}
      {(step.blockReason || step.blockedReason) && (
        <div style={{ fontSize: 10, color: "#ef4444", background: "rgba(239,68,68,.06)", padding: "6px 8px", borderRadius: 7 }}>
          <span style={{ fontWeight: 700 }}>Bloqueo: </span>{step.blockReason ?? step.blockedReason}
        </div>
      )}
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function GraphLegend() {
  const items: Array<{ label: string; color: string }> = [
    { label: "Listo",      color: "#818cf8" },
    { label: "Ejecutando", color: "#6366f1" },
    { label: "Completado", color: "#10b981" },
    { label: "Bloqueado",  color: "#f59e0b" },
    { label: "Fallido",    color: "#ef4444" },
    { label: "Pendiente",  color: "var(--faint)" },
  ];
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
      {items.map(({ label, color }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--muted)" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
          {label}
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--muted)", marginLeft: "auto" }}>
        <div style={{ width: 20, height: 1, background: "rgba(245,158,11,.5)", borderTop: "1.5px dashed rgba(245,158,11,.5)" }} />
        dep. bloqueada
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlanTaskGraph({ plan }: { plan: CopilotWorkPlan }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const nodes = buildLayout(plan.steps);
  if (nodes.length === 0) return null;

  // SVG canvas size
  const maxX = Math.max(...nodes.map((n) => n.x + NODE_W)) + 20;
  const maxY = Math.max(...nodes.map((n) => n.y + NODE_H)) + 20;

  // Build node position lookup for arrow drawing
  const posById = new Map(nodes.map((n) => [n.step.id, n]));

  // Next actionable step
  const nextStep = plan.steps.find((s: WorkPlanStep) => s.status === "executing")
    ?? plan.steps.find((s: WorkPlanStep) => s.status === "ready")
    ?? null;

  const selectedNode = selectedId ? nodes.find((n) => n.step.id === selectedId) : null;

  return (
    <div ref={containerRef}>
      <div style={{ overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch" }}>
        <svg
          width={maxX}
          height={maxY}
          style={{ display: "block", minWidth: maxX }}
        >
          {/* Arrows for dependencies */}
          {nodes.map((node) => {
            const deps = node.step.dependsOnStepIds ?? [];
            return deps.map((depId: string) => {
              const from = posById.get(depId);
              if (!from) return null;
              const fromX = from.x + NODE_W;
              const fromY = from.y + NODE_H / 2;
              const toX   = node.x;
              const toY   = node.y + NODE_H / 2;
              const blocked = from.step.status !== "completed" && from.step.status !== "skipped";
              return (
                <Arrow
                  key={`${depId}->${node.step.id}`}
                  fromX={fromX} fromY={fromY}
                  toX={toX}   toY={toY}
                  blocked={blocked}
                />
              );
            });
          })}

          {/* Step nodes */}
          {nodes.map((node) => (
            <StepNodeCard
              key={node.step.id}
              node={node}
              isCurrent={node.step.id === nextStep?.id}
              isSelected={node.step.id === selectedId}
              onClick={() => setSelectedId(node.step.id === selectedId ? null : node.step.id)}
            />
          ))}
        </svg>
      </div>

      <GraphLegend />

      {selectedNode && (
        <StepDetail
          step={selectedNode.step}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
