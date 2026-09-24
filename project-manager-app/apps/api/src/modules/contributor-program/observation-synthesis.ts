// PR-12 (docs/specs/core/knowledge-contributor-observation-synthesis.spec.md):
// pure prompt-building and response-parsing logic for turning real
// TranscriptSegment rows into candidate Observation rows via an LLM call.
// Kept free of any SDK/network/DB dependency so the interesting logic
// (prompt shape, citation validation, never-fabricate guard) is testable
// without a live model.

export type SynthesisSegment = { id: string; startMs: number; endMs: number; text: string };

export type SynthesizedObservation = {
  objective?: string | null;
  condition?: string | null;
  decision?: string | null;
  reason?: string | null;
  method?: string | null;
  action?: string | null;
  result?: string | null;
  sourceSegmentIds: string[];
};

const SYSTEM_PROMPT = `Eres un analista de conocimiento de campo para SEMSEproject.
Tu tarea es leer un transcript de audio de un trabajador de campo (construcción/servicios)
e identificar observaciones de trabajo reales, estructuradas como:
OBJECTIVE (qué se buscaba lograr), CONDITION (condición encontrada),
DECISION (decisión tomada), REASON (por qué), METHOD (cómo se hizo),
ACTION (qué se hizo), RESULT (resultado obtenido).

Reglas estrictas:
- Cada campo es opcional — no inventes un valor si el transcript no lo dice.
- Cada observación DEBE citar al menos un id de segmento ([s1], [s2], ...) que
  la respalde, usando exactamente los ids dados. Nunca inventes un id.
- Si el transcript no contiene ninguna observación de trabajo real (charla
  irrelevante, silencio, ruido), responde con una lista vacía. No fuerces
  una observación de relleno.
- Una observación por cada evento de trabajo distinto — no combines eventos
  no relacionados en una sola observación.
- Responde SIEMPRE con un objeto JSON válido, sin texto fuera del JSON:
{
  "observaciones": [
    {
      "objective": string | null,
      "condition": string | null,
      "decision": string | null,
      "reason": string | null,
      "method": string | null,
      "action": string | null,
      "result": string | null,
      "segmentIds": string[]
    }
  ]
}`;

export function buildSynthesisPrompt(segments: readonly SynthesisSegment[]): {
  systemPrompt: string;
  userPrompt: string;
  aliasToSegmentId: Map<string, string>;
} {
  const aliasToSegmentId = new Map<string, string>();
  const lines = segments.map((segment, index) => {
    const alias = `s${index + 1}`;
    aliasToSegmentId.set(alias, segment.id);
    const startS = (segment.startMs / 1000).toFixed(1);
    const endS = (segment.endMs / 1000).toFixed(1);
    return `[${alias}] ${startS}s-${endS}s: ${segment.text}`;
  });

  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Transcript (segmentos en orden):\n${lines.join("\n")}`,
    aliasToSegmentId
  };
}

function parseJsonLoose(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Never trusts the model's citations blindly: any alias it names that isn't
// one we actually handed it is dropped, and an observation left with zero
// valid citations after that is dropped entirely — "no puede generar una
// Observation sin un TranscriptSegment de origen citado" (PR-5 spec §3).
export function parseSynthesisResponse(
  raw: string,
  aliasToSegmentId: ReadonlyMap<string, string>
): SynthesizedObservation[] {
  const parsed = parseJsonLoose(raw) as { observaciones?: unknown } | null;
  const list = Array.isArray(parsed?.observaciones) ? parsed!.observaciones : [];

  const results: SynthesizedObservation[] = [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;

    const aliases = Array.isArray(e.segmentIds) ? e.segmentIds : [];
    const sourceSegmentIds = aliases
      .filter((a): a is string => typeof a === "string")
      .map((alias) => aliasToSegmentId.get(alias))
      .filter((id): id is string => typeof id === "string");

    if (sourceSegmentIds.length === 0) continue;

    const observation: SynthesizedObservation = {
      objective: str(e.objective),
      condition: str(e.condition),
      decision: str(e.decision),
      reason: str(e.reason),
      method: str(e.method),
      action: str(e.action),
      result: str(e.result),
      sourceSegmentIds: [...new Set(sourceSegmentIds)]
    };

    // Every field null is not an observation — the model citing a segment
    // but saying nothing about it is the same as saying nothing.
    const hasContent = [observation.objective, observation.condition, observation.decision, observation.reason, observation.method, observation.action, observation.result].some(
      (v) => v !== null
    );
    if (!hasContent) continue;

    results.push(observation);
  }

  return results;
}
