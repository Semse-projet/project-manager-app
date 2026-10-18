import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import type { CopilotTool, CopilotToolCall } from "../types.js";

// ── Anthropic ─────────────────────────────────────────────────────────────────

export function toAnthropicTools(tools: CopilotTool[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));
}

export function fromAnthropicToolUse(
  blocks: Anthropic.ToolUseBlock[],
): CopilotToolCall[] {
  return blocks.map((b) => ({
    toolName: b.name,
    toolUseId: b.id,
    input: b.input as Record<string, unknown>,
  }));
}

// ── OpenAI ────────────────────────────────────────────────────────────────────

export function toOpenAITools(tools: CopilotTool[]): OpenAI.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

export function fromOpenAIToolCalls(
  calls: OpenAI.ChatCompletionMessageToolCall[],
): CopilotToolCall[] {
  return calls.map((c) => {
    const fn = (c as unknown as { function?: { name: string; arguments: string } }).function;
    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(fn?.arguments ?? "{}") as Record<string, unknown>;
    } catch {
      // ignore malformed JSON from model
    }
    return { toolName: fn?.name ?? c.id, toolUseId: c.id, input };
  });
}

// ── Prompt (Ollama / open-source without native tool calling) ─────────────────

export function toPromptTools(tools: CopilotTool[]): string {
  if (tools.length === 0) return "";
  const lines = tools.map((t) => {
    const required = (t.inputSchema as { required?: string[] }).required ?? [];
    const props = (t.inputSchema as { properties?: Record<string, { type: string; description?: string }> }).properties ?? {};
    const params = Object.entries(props)
      .map(([k, v]) => `  - ${k} (${v.type}${required.includes(k) ? ", required" : ""}): ${v.description ?? ""}`)
      .join("\n");
    return `### ${t.name}\n${t.description}\nParámetros:\n${params}`;
  });

  return `\n\nHerramientas disponibles:\n${lines.join("\n\n")}\n\nSi consideras que debes usar una herramienta, responde con JSON estrictamente así:\n{"tool":"<nombre>","input":{...}}\nSolo una herramienta por respuesta. Si no necesitas herramienta, responde con texto normal.`;
}

export function parsePromptToolCall(text: string): CopilotToolCall | null {
  const trimmed = text.trim();
  // Find outermost JSON object containing a "tool" key
  const start = trimmed.indexOf("{");
  if (start === -1) return null;

  // Match structural braces only. Valid tool arguments may contain literal
  // unmatched braces or escaped quotes inside JSON string values.
  let depth = 0;
  let end = -1;
  let inString = false;
  let escaped = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
      if (depth < 0) return null;
    }
  }
  if (end === -1 || inString) return null;

  const candidate = trimmed.slice(start, end + 1);
  try {
    const parsed = JSON.parse(candidate) as { tool?: string; input?: Record<string, unknown> };
    if (!parsed.tool) return null;
    return {
      toolName: parsed.tool,
      toolUseId: `local_${Date.now()}`,
      input: parsed.input ?? {},
    };
  } catch {
    return null;
  }
}
