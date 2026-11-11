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

test("parsePromptToolCall preserves unmatched literal braces in valid tool JSON strings", () => {
  const payload = {
    tool: "edit_file",
    input: {
      path: "notes.md",
      content: 'This JSON string contains an opening brace { and a closing brace } at other positions',
      comment: 'A literal { brace with no balancing pair',
    },
  };
  const call = parsePromptToolCall(JSON.stringify(payload));
  assert.ok(call);
  assert.equal(call.toolName, "edit_file");
  assert.deepEqual(call.input, payload.input);
});

test("parsePromptToolCall respects JSON escaped quotation marks and backslashes", () => {
  const payload = {
    tool: "run_command",
    input: {
      command: 'printf "unbalanced } text \\{ and an escaped quote \\" in shell argument"',
      text: 'quoted "}" then unmatched {',
    },
  };
  const call = parsePromptToolCall(`Tool call:\n${JSON.stringify(payload)}\nProceeding.`);
  assert.ok(call);
  assert.deepEqual(call.input, payload.input);
});

test("parsePromptToolCall still rejects incomplete structured JSON after quoted braces", () => {
  assert.equal(parsePromptToolCall('{"tool":"edit_file","input":{"content":"} and {"'), null);
});
