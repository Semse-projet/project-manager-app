// Pluggable ASR (speech-to-text) provider for the contributor-program
// TRANSCRIPTION extraction pipeline.
//
// PR-11 (docs/specs/core/knowledge-contributor-asr-openai-whisper.spec.md):
// the provider choice deferred by PR-5 §11 was put back to the product
// owner — hosted OpenAI Whisper was chosen over deploying a new local ASR
// service (the "ollama" Railway service only carries text models today,
// qwen2.5:3b/glm4 — no ASR). Activation is a SEPARATE, explicit opt-in
// (SEMSE_ASR_PROVIDER=openai-whisper) from OPENAI_API_KEY, which is already
// set in production for unrelated reasons (RAG embeddings, LLM
// orchestrator) — reusing the key's mere presence would have silently
// activated real audio processing the moment this PR merged. The worker's
// own kill switch (CONTRIBUTOR_EXTRACTION_SWEEP_ENABLED, apps/worker/src/
// main.mjs) is a second, independent gate.
import OpenAI, { toFile } from "openai";

export type TranscriptionSegment = { startMs: number; endMs: number; text: string; confidence?: number };

export interface TranscriptionProvider {
  transcribe(input: { storageKey: string; mimeType: string | null }): Promise<TranscriptionSegment[]>;
}

export interface TranscriptionStorageReader {
  readBuffer(key: string): Promise<Buffer>;
}

// Extracted as a pure function so the timestamp/confidence mapping is
// unit-testable without a real network call or mocking the OpenAI SDK.
export function mapWhisperSegments(
  segments: ReadonlyArray<{ start: number; end: number; text: string; avg_logprob: number }>
): TranscriptionSegment[] {
  return segments
    .map((segment) => ({
      startMs: Math.round(segment.start * 1000),
      endMs: Math.round(segment.end * 1000),
      text: segment.text.trim(),
      // avg_logprob is a natural log-probability (<= 0); exp() maps it back
      // to a 0..1-ish confidence proxy. OpenAI's own docs flag < -1 as
      // "consider the logprobs failed" — still surfaced as a low number
      // here rather than dropped, so a human reviewer can see it was weak.
      confidence: Math.exp(segment.avg_logprob)
    }))
    .filter((segment) => segment.text.length > 0);
}

class OpenAIWhisperTranscriptionProvider implements TranscriptionProvider {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly storage: TranscriptionStorageReader
  ) {
    // Field audio can run several minutes — the default SDK timeout is too
    // short for that, and (unlike DeepSeekProvider elsewhere in this repo)
    // this call site does set one rather than hanging indefinitely.
    this.client = new OpenAI({ apiKey, timeout: 120_000 });
  }

  async transcribe(input: { storageKey: string; mimeType: string | null }): Promise<TranscriptionSegment[]> {
    const buffer = await this.storage.readBuffer(input.storageKey);
    const filename = input.storageKey.split("/").pop() || "audio";
    const file = await toFile(buffer, filename, { type: input.mimeType ?? "application/octet-stream" });

    const response = await this.client.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json"
    });

    // A real (non-silent) clip with no segments would be surprising, but is
    // an honest "nothing said" result, not a failure — never fabricate.
    return mapWhisperSegments(response.segments ?? []);
  }
}

export function resolveTranscriptionProvider(storage: TranscriptionStorageReader): TranscriptionProvider | null {
  const selected = process.env.SEMSE_ASR_PROVIDER;

  if (!selected) {
    // No explicit opt-in — the extraction pipeline moves every claimed row
    // straight to FAILED with reason ASR_PROVIDER_NOT_CONFIGURED, never a
    // fabricated transcript. This is the correct default even though
    // OPENAI_API_KEY may already be set for unrelated purposes.
    return null;
  }

  if (selected === "openai-whisper") {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("SEMSE_ASR_PROVIDER=openai-whisper is set but OPENAI_API_KEY is not configured");
    }
    return new OpenAIWhisperTranscriptionProvider(process.env.OPENAI_API_KEY, storage);
  }

  // Fail loudly on an unrecognized value instead of silently falling back
  // to "no provider" — a typo in Railway shouldn't be indistinguishable
  // from "ASR intentionally not configured".
  throw new Error(`SEMSE_ASR_PROVIDER=${selected} is not a recognized transcription provider`);
}
