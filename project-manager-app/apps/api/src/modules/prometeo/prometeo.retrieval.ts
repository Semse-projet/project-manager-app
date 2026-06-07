import type { PrometeoSearchHit } from "./prometeo.types.js";

type ChunkOptions = {
  maxChars?: number;
  minChars?: number;
};

export type DraftChunk = {
  chunkIndex: number;
  text: string;
  tokenCount: number;
  metadata: Record<string, unknown>;
};

const DEFAULT_MAX_CHARS = 900;
const DEFAULT_MIN_CHARS = 220;

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitOversizedSentence(input: string, maxChars: number): string[] {
  const words = input.split(/\s+/).filter(Boolean);
  const pieces: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) pieces.push(current);
    current = word;
  }

  if (current) pieces.push(current);
  return pieces;
}

function splitOversizedBlock(input: string, maxChars: number): string[] {
  const sentences = input.match(/[^.!?\n]+(?:[.!?]+|\n|$)/g)?.map((item) => item.trim()).filter(Boolean) ?? [input];
  const segments: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current) {
        segments.push(current);
        current = "";
      }
      segments.push(...splitOversizedSentence(sentence, maxChars));
      continue;
    }

    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) segments.push(current);
    current = sentence;
  }

  if (current) segments.push(current);
  return segments;
}

function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function chunkText(input: string, options: ChunkOptions = {}): DraftChunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const minChars = options.minChars ?? DEFAULT_MIN_CHARS;
  const text = normalizeWhitespace(input);
  if (!text) return [];

  const rawBlocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block) => (block.length > maxChars ? splitOversizedBlock(block, maxChars) : [block]));

  const chunks: string[] = [];
  let current = "";

  for (const block of rawBlocks) {
    const next = current ? `${current}\n\n${block}` : block;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current && current.length < minChars) {
      current = next;
      continue;
    }

    if (current) chunks.push(current);
    current = block;
  }

  if (current) chunks.push(current);

  return chunks.map((chunk, index) => ({
    chunkIndex: index,
    text: chunk,
    tokenCount: estimateTokenCount(chunk),
    metadata: {
      charLength: chunk.length,
      paragraphCount: chunk.split(/\n{2,}/).length
    }
  }));
}

export function extractSearchTokens(query: string): string[] {
  return query
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

export function buildSearchSnippet(text: string, query: string, maxChars = 220): string {
  const clean = normalizeWhitespace(text);
  if (clean.length <= maxChars) {
    return clean;
  }

  const tokens = extractSearchTokens(query);
  const lower = clean.toLowerCase();
  const startIndex = tokens
    .map((token) => lower.indexOf(token))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0] ?? 0;

  const sliceStart = Math.max(0, startIndex - Math.floor(maxChars / 3));
  const sliceEnd = Math.min(clean.length, sliceStart + maxChars);
  const prefix = sliceStart > 0 ? "..." : "";
  const suffix = sliceEnd < clean.length ? "..." : "";

  return `${prefix}${clean.slice(sliceStart, sliceEnd).trim()}${suffix}`;
}

export function buildFallbackAnswer(question: string, hits: PrometeoSearchHit[]): string {
  if (hits.length === 0) {
    return `No encontré contexto suficiente para responder "${question}" con la base documental actual.`;
  }

  const fragments = hits.slice(0, 3).map((hit, index) => {
    const snippet = buildSearchSnippet(hit.text, question, 180);
    return `${index + 1}. ${hit.documentTitle}: ${snippet}`;
  });

  return [
    "Encontré contexto relevante, pero no hubo síntesis LLM disponible.",
    "Fragmentos más útiles:",
    ...fragments
  ].join("\n");
}
