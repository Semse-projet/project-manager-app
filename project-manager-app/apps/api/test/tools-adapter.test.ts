import test from "node:test";
import assert from "node:assert/strict";
import { toPromptTools, parsePromptToolCall, toAnthropicTools, toOpenAITools } from "../dist/infrastructure/llm/adapters/tools.adapter.js";

const TOOL = {
  name: "propose_milestone_approval",
  description: "Propone aprobar un milestone",
  inputSchema: {
    type: "object",
    properties: {
      milestoneId: { type: "string", description: "ID" },
      rationale: { type: "string", description: "Razón" },
    },
    required: ["milestoneId", "rationale"],
  },
};

test("toAnthropicTools maps name and description", () => {
  const [t] = toAnthropicTools([TOOL]);
  assert.equal(t.name, "propose_milestone_approval");
  assert.ok(t.description.length > 0);
});

test("toOpenAITools wraps in function object", () => {
  const [t] = toOpenAITools([TOOL]);
  assert.equal(t.type, "function");
  assert.equal(t.function.name, "propose_milestone_approval");
});

test("toPromptTools generates text with tool name", () => {
  const text = toPromptTools([TOOL]);
  assert.ok(text.includes("propose_milestone_approval"));
  assert.ok(text.includes("milestoneId"));
});

test("parsePromptToolCall extracts tool from JSON response", () => {
  const text = '{"tool":"propose_milestone_approval","input":{"milestoneId":"ms_1","rationale":"ok"}}';
  const call = parsePromptToolCall(text);
  assert.ok(call !== null);
  assert.equal(call.toolName, "propose_milestone_approval");
  assert.equal(call.input["milestoneId"], "ms_1");
});

test("parsePromptToolCall returns null for plain text", () => {
  const call = parsePromptToolCall("El proyecto está en progreso.");
  assert.equal(call, null);
});

test("parsePromptToolCall returns null for malformed JSON", () => {
  const call = parsePromptToolCall('{"tool":}');
  assert.equal(call, null);
});
