import { toolResultSchema, type ToolResultPart } from "@semse/schemas";

/**
 * docs/specs/prometeo/tool-result-multimodal.spec.md. Returns the parsed
 * ToolResultPart[] only when `output.outputKind === "ToolResult"` and
 * `output.data` actually matches the schema — any mismatch (older tool,
 * or a future part `type` this build doesn't know yet) returns null so
 * the caller falls back to the existing text/JSON summary. No per-part
 * fallback: a whole-result parse failure degrades to that same summary,
 * which already never crashes.
 */
export function extractToolResultParts(output: unknown): ToolResultPart[] | null {
  if (typeof output !== "object" || output === null) return null;
  if ((output as { outputKind?: unknown }).outputKind !== "ToolResult") return null;
  const parsed = toolResultSchema.safeParse((output as { data?: unknown }).data);
  if (!parsed.success || parsed.data.parts.length === 0) return null;
  return parsed.data.parts;
}

export function getPrometeoToolResultDetail(input: {
  outputKind: string;
  summary: string | null;
  errorMessage?: string;
}): string {
  return input.outputKind || input.summary || input.errorMessage || "Sin detalle adicional";
}

export function shouldRenderPrometeoToolError(input: {
  detail: string;
  errorMessage?: string;
}): boolean {
  return Boolean(input.errorMessage && input.detail !== input.errorMessage);
}
