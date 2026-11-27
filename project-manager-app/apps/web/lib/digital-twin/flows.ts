import type {
  DigitalTwinEdge,
  DigitalTwinFlow,
  DigitalTwinSnapshot,
} from "./view-model.ts";

export const DIGITAL_TWIN_FLOW_IDS = [
  "intake_to_contract",
  "execution_to_evidence",
  "evidence_to_payment",
] as const;

type FlowDefinition = Omit<DigitalTwinFlow, "edgeIds">;

export const DIGITAL_TWIN_FLOW_DEFINITIONS: readonly FlowDefinition[] = [
  {
    id: "intake_to_contract",
    label: "Intake → Contract",
    description: "Entrada, estimación, matching y creación del proyecto.",
    nodeIds: ["landing", "smart_intake", "protools_agent", "marketplace", "projects"],
  },
  {
    id: "execution_to_evidence",
    label: "Execution → Evidence",
    description: "Ejecución por hitos, captura de campo y revisión de evidencia.",
    nodeIds: ["projects", "milestones", "field_updates", "evidence_upload", "evidence_review"],
  },
  {
    id: "evidence_to_payment",
    label: "Evidence → Payment → Trust",
    description: "Validación, gobierno de pago, procesamiento y reputación.",
    nodeIds: [
      "evidence_upload", "vision_analysis", "evidence_review", "payment_governance",
      "escrow", "payment_engine", "trust_passport",
    ],
  },
] as const;

export function buildDigitalTwinFlowGraph(baseEdges: DigitalTwinEdge[]): {
  edges: DigitalTwinEdge[];
  flows: DigitalTwinFlow[];
} {
  const edges = [...baseEdges];
  const flows = DIGITAL_TWIN_FLOW_DEFINITIONS.map((definition) => {
    const edgeIds: string[] = [];
    for (let index = 0; index < definition.nodeIds.length - 1; index += 1) {
      const source = definition.nodeIds[index];
      const target = definition.nodeIds[index + 1];
      let edge = edges.find((item) => item.source === source && item.target === target);
      if (!edge) {
        edge = {
          id: `flow:${definition.id}:${index}`,
          source,
          target,
          relation: "value_flow",
          strength: 0.75,
          derived: true,
        };
        edges.push(edge);
      }
      edgeIds.push(edge.id);
    }
    return { ...definition, nodeIds: [...definition.nodeIds], edgeIds };
  });
  return { edges, flows };
}

export function getFlowSegments(snapshot: DigitalTwinSnapshot, flowId: string) {
  const flow = snapshot.flows.find((item) => item.id === flowId);
  if (!flow) return [];
  return flow.nodeIds.slice(0, -1).map((source, index) => {
    const target = flow.nodeIds[index + 1];
    const edge = snapshot.edges.find((item) => item.source === source && item.target === target);
    if (!edge) throw new Error(`Missing flow edge: ${flow.id}:${source}->${target}`);
    return { source, target, edge };
  });
}

export interface FlowPlaybackFrame {
  phase: "playing" | "complete";
  segmentIndex: number;
  progress: number;
}

export function getFlowPlaybackFrame(
  flow: DigitalTwinFlow,
  startedAt: number,
  now: number,
  reducedMotion: boolean,
  stepMs = 650,
): FlowPlaybackFrame {
  const lastSegment = flow.nodeIds.length - 2;
  if (reducedMotion) return { phase: "complete", segmentIndex: lastSegment, progress: 1 };
  const elapsed = Math.max(0, now - startedAt);
  const totalMs = (lastSegment + 1) * stepMs;
  if (elapsed >= totalMs) return { phase: "complete", segmentIndex: lastSegment, progress: 1 };
  const segmentIndex = Math.floor(elapsed / stepMs);
  return {
    phase: "playing",
    segmentIndex,
    progress: (elapsed - segmentIndex * stepMs) / stepMs,
  };
}
