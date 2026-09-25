import test from "node:test";
import assert from "node:assert/strict";
import {
  mapWhisperSegments,
  resolveTranscriptionProvider
} from "../dist/modules/contributor-program/transcription-provider.js";

// PR-11 (docs/specs/core/knowledge-contributor-asr-openai-whisper.spec.md):
// pure-logic tests for the real OpenAI Whisper provider wiring — no DB, no
// network, no OpenAI SDK mock needed. The env-var gating and the
// segment-mapping math are the only genuinely new logic; the network call
// itself is exercised by the SDK's own test suite, not ours.

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) previous[key] = process.env[key];
  try {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const fakeStorage = { async readBuffer() { return Buffer.from(""); } };

test("resolveTranscriptionProvider: no SEMSE_ASR_PROVIDER set returns null", () => {
  withEnv({ SEMSE_ASR_PROVIDER: undefined, OPENAI_API_KEY: "sk-test" }, () => {
    assert.equal(resolveTranscriptionProvider(fakeStorage), null);
  });
});

test("resolveTranscriptionProvider: openai-whisper without OPENAI_API_KEY throws loudly", () => {
  withEnv({ SEMSE_ASR_PROVIDER: "openai-whisper", OPENAI_API_KEY: undefined }, () => {
    assert.throws(() => resolveTranscriptionProvider(fakeStorage), /OPENAI_API_KEY is not configured/);
  });
});

test("resolveTranscriptionProvider: openai-whisper with a key returns a real provider", () => {
  withEnv({ SEMSE_ASR_PROVIDER: "openai-whisper", OPENAI_API_KEY: "sk-test" }, () => {
    const provider = resolveTranscriptionProvider(fakeStorage);
    assert.ok(provider);
    assert.equal(typeof provider.transcribe, "function");
  });
});

test("resolveTranscriptionProvider: unrecognized value fails loudly instead of silently returning null", () => {
  withEnv({ SEMSE_ASR_PROVIDER: "some-typo", OPENAI_API_KEY: "sk-test" }, () => {
    assert.throws(() => resolveTranscriptionProvider(fakeStorage), /not a recognized transcription provider/);
  });
});

test("mapWhisperSegments: converts seconds to ms and avg_logprob to a confidence proxy", () => {
  const result = mapWhisperSegments([
    { start: 0, end: 2.5, text: "  Instaló el conduit por la pared norte  ", avg_logprob: -0.1 },
    { start: 2.5, end: 5.75, text: "Verificó el nivel del piso", avg_logprob: -0.4 }
  ]);
  assert.equal(result.length, 2);
  assert.deepEqual(
    { startMs: result[0].startMs, endMs: result[0].endMs, text: result[0].text },
    { startMs: 0, endMs: 2500, text: "Instaló el conduit por la pared norte" }
  );
  assert.equal(result[1].startMs, 2500);
  assert.equal(result[1].endMs, 5750);
  assert.ok(result[0].confidence! > result[1].confidence!, "a less negative avg_logprob should map to a higher confidence");
  assert.ok(result[0].confidence! > 0 && result[0].confidence! <= 1);
});

test("mapWhisperSegments: drops segments whose text is empty or whitespace-only", () => {
  const result = mapWhisperSegments([
    { start: 0, end: 1, text: "   ", avg_logprob: -0.2 },
    { start: 1, end: 2, text: "real content", avg_logprob: -0.2 }
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].text, "real content");
});

test("mapWhisperSegments: an empty segment list (silent clip) is an honest empty result, not an error", () => {
  assert.deepEqual(mapWhisperSegments([]), []);
});
