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

test("T-030/T-041: all 7 write tools are now wired (none adapterPending)", () => {
  const wiredWriteTools = [
    ["time_tracker", "start"],
    ["time_tracker", "pause"],
    ["time_tracker", "resume"],
    ["time_tracker", "stop"],
    ["time_tracker", "create_manual_entry"],
    ["agro", "create_task"],
    ["payments", "propose_release"],
  ];
  const tools = listPrometeoToolRegistry();

  for (const [namespace, name] of wiredWriteTools) {
    const tool = tools.find((t) => t.namespace === namespace && t.name === name);
    assert.ok(tool, `expected ${namespace}.${name} to be registered`);
    assert.equal(tool?.adapterPending, false, `expected ${namespace}.${name} to be executable`);
  }
});

test("T-040: payments.propose_release requires finance:write, not the nonexistent payments:write, and stays human_required", () => {
  const tools = listPrometeoToolRegistry();
  const tool = tools.find((t) => t.namespace === "payments" && t.name === "propose_release");
  assert.ok(tool);
  assert.deepEqual(tool?.permissions, ["finance:write"]);
  assert.equal(tool?.approvalPolicy, "human_required");
  assert.equal(tool?.riskLevel, "critical");
});
