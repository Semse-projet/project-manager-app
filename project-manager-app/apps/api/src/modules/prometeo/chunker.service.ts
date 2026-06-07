import { Injectable } from "@nestjs/common";

export type TextChunk = {
  index: number;
  text: string;
  tokenCount: number;
  metadata: { heading?: string; section?: string };
};

const AVG_CHARS_PER_TOKEN = 4;
const DEFAULT_CHUNK_TOKENS = 400;
const DEFAULT_OVERLAP_TOKENS = 60;

@Injectable()
export class ChunkerService {
  chunk(
    text: string,
    opts?: { chunkTokens?: number; overlapTokens?: number },
  ): TextChunk[] {
    const chunkSize = (opts?.chunkTokens ?? DEFAULT_CHUNK_TOKENS) * AVG_CHARS_PER_TOKEN;
    const overlap   = (opts?.overlapTokens ?? DEFAULT_OVERLAP_TOKENS) * AVG_CHARS_PER_TOKEN;

    const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!cleaned) return [];

    // Split by paragraph boundaries first, then merge into target size
    const paragraphs = cleaned.split(/\n\n+/).filter((p) => p.trim().length > 0);

    const chunks: TextChunk[] = [];
    let buffer = "";
    let heading = "";

    const flush = () => {
      const t = buffer.trim();
      if (!t) return;
      chunks.push({
        index: chunks.length,
        text: t,
        tokenCount: Math.ceil(t.length / AVG_CHARS_PER_TOKEN),
        metadata: { heading: heading || undefined },
      });
    };

    for (const para of paragraphs) {
      // Detect headings (lines starting with # or ALL CAPS short lines)
      if (/^#{1,6}\s/.test(para) || /^[A-ZÁÉÍÓÚ\s]{5,50}$/.test(para.split("\n")[0] ?? "")) {
        heading = para.split("\n")[0]?.replace(/^#+\s*/, "").trim() ?? heading;
      }

      if (buffer.length + para.length > chunkSize && buffer.length > 0) {
        flush();
        // Overlap: keep last overlap chars
        buffer = buffer.slice(-overlap) + "\n\n" + para;
      } else {
        buffer = buffer ? buffer + "\n\n" + para : para;
      }
    }
    flush();

    return chunks;
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / AVG_CHARS_PER_TOKEN);
  }
}
