import test from "node:test";
import assert from "node:assert/strict";
import { listPrometeoToolRegistry } from "../dist/modules/prometeo/prometeo-tool-registry.js";

test("T-024: the 6 unwired vision:run read tools are marked adapterPending", () => {
  const pendingVisionTools = [
    "analyze_image",
    "compare_before_after",
    "detect_material",
    "classify_space",
    "check_safety",
    "analyze_video",
  ];
  const tools = listPrometeoToolRegistry();

  for (const name of pendingVisionTools) {
    const tool = tools.find((t) => t.namespace === "vision" && t.name === name);
    assert.ok(tool, `expected vision.${name} to be registered`);
    assert.equal(tool?.adapterPending, true, `expected vision.${name} to be adapterPending`);
  }
});

test("T-024b: the 3 wired vision read tools are NOT marked adapterPending", () => {
  const wiredVisionTools = ["get_analysis", "get_job_analyses", "get_milestone_analyses"];
  const tools = listPrometeoToolRegistry();

  for (const name of wiredVisionTools) {
    const tool = tools.find((t) => t.namespace === "vision" && t.name === name);
    assert.ok(tool, `expected vision.${name} to be registered`);
    assert.equal(tool?.adapterPending, false, `expected vision.${name} to be executable`);
  }
});

test("T-024c: all 7 write tools are adapterPending (no invokeWriteTool exists yet)", () => {
  const tools = listPrometeoToolRegistry();
  const writeTools = tools.filter((t) => t.mode === "write" || t.mode === "critical");

  assert.equal(writeTools.length, 7);
  for (const tool of writeTools) {
    assert.equal(tool.adapterPending, true, `expected ${tool.namespace}.${tool.name} to be adapterPending (no write execution path exists)`);
  }
});
