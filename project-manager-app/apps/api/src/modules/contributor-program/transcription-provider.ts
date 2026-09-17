// Pluggable ASR (speech-to-text) provider for the contributor-program
// TRANSCRIPTION extraction pipeline. No provider is wired up today — which
// provider to use (local Whisper vs. a hosted API), its cost, and its
// privacy tradeoff are explicitly out of scope for this slice: see
// docs/specs/core/knowledge-contributor-transcript-observation.spec.md §11.
// Until a human makes that call and a real implementation lands here,
// resolveTranscriptionProvider() returning null is the correct, honest
// behavior — the extraction pipeline (contributor-program.service.ts
// processPendingExtractions) moves every claimed row straight to FAILED
// with reason ASR_PROVIDER_NOT_CONFIGURED, never a fabricated transcript.

export type TranscriptionSegment = { startMs: number; endMs: number; text: string; confidence?: number };

export interface TranscriptionProvider {
  transcribe(input: { storageKey: string; mimeType: string | null }): Promise<TranscriptionSegment[]>;
}

export function resolveTranscriptionProvider(): TranscriptionProvider | null {
  // SEMSE_ASR_PROVIDER_URL is not set anywhere in this repo or in production
  // today (confirmed read-only via Railway in the PR-3 session of this same
  // program) — so this always returns null right now, by design.
  if (!process.env.SEMSE_ASR_PROVIDER_URL) {
    return null;
  }
  // Reachable only once a human sets the env var without a real client
  // behind it yet — fail loudly instead of silently returning a stub
  // provider that would fabricate segments.
  throw new Error("SEMSE_ASR_PROVIDER_URL is configured but no TranscriptionProvider implementation exists yet");
}
