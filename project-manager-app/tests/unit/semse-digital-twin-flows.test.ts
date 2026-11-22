import test from "node:test";
import assert from "node:assert/strict";
import { createStaticDigitalTwinSnapshot } from "../../apps/web/lib/digital-twin/topology-adapter.ts";
import { DIGITAL_TWIN_FLOW_IDS, getFlowPlaybackFrame, getFlowSegments } from "../../apps/web/lib/digital-twin/flows.ts";

test("define los tres flujos autorizados con paths completos", () => {
  const snapshot = createStaticDigitalTwinSnapshot();
  assert.deepEqual(snapshot.flows.map((flow) => flow.id), [...DIGITAL_TWIN_FLOW_IDS]);
  assert.deepEqual(snapshot.flows.map((flow) => flow.label), [
    "Intake → Contract",
    "Execution → Evidence",
    "Evidence → Payment → Trust",
  ]);

  const ids = new Set(snapshot.nodes.map((node) => node.id));
  const edges = new Set(snapshot.edges.map((edge) => `${edge.source}->${edge.target}`));
  for (const flow of snapshot.flows) {
    assert.ok(flow.nodeIds.length >= 2);
    for (const id of flow.nodeIds) assert.ok(ids.has(id));
    for (let index = 0; index < flow.nodeIds.length - 1; index += 1) {
      const pair = `${flow.nodeIds[index]}->${flow.nodeIds[index + 1]}`;
      assert.ok(edges.has(pair), `arista ausente para ${flow.id}: ${pair}`);
    }
  }
});

test("los segmentos conservan orden y marcan las conexiones añadidas como derivadas", () => {
  const snapshot = createStaticDigitalTwinSnapshot();
  const flow = snapshot.flows.find((item) => item.id === "evidence_to_payment");
  assert.ok(flow);
  const segments = getFlowSegments(snapshot, flow.id);
  assert.equal(segments.length, flow.nodeIds.length - 1);
  assert.equal(segments[0].source, "evidence_upload");
  assert.equal(segments.at(-1).target, "trust_passport");
  assert.ok(segments.some((segment) => segment.edge.derived));
});

test("el playback avanza por pasos y termina sin loop ambiental", () => {
  const snapshot = createStaticDigitalTwinSnapshot();
  const flow = snapshot.flows[0];
  const stepMs = 400;
  const totalMs = (flow.nodeIds.length - 1) * stepMs;

  assert.deepEqual(getFlowPlaybackFrame(flow, 1_000, 1_000, false, stepMs), {
    phase: "playing", segmentIndex: 0, progress: 0,
  });
  assert.deepEqual(getFlowPlaybackFrame(flow, 1_000, 1_450, false, stepMs), {
    phase: "playing", segmentIndex: 1, progress: 0.125,
  });
  assert.deepEqual(getFlowPlaybackFrame(flow, 1_000, 1_000 + totalMs, false, stepMs), {
    phase: "complete", segmentIndex: flow.nodeIds.length - 2, progress: 1,
  });
  assert.deepEqual(getFlowPlaybackFrame(flow, 1_000, 99_000, false, stepMs), {
    phase: "complete", segmentIndex: flow.nodeIds.length - 2, progress: 1,
  });
});

test("reduced motion muestra directamente el estado final", () => {
  const snapshot = createStaticDigitalTwinSnapshot();
  const flow = snapshot.flows[0];
  assert.deepEqual(getFlowPlaybackFrame(flow, 1_000, 1_000, true, 400), {
    phase: "complete", segmentIndex: flow.nodeIds.length - 2, progress: 1,
  });
});
