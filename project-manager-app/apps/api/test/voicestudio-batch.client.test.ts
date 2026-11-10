import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import {
  VoiceStudioBatchClient,
  VoiceStudioGatewayError,
  VoiceStudioTranscriptionProvider,
  resolveVoiceStudioDevConfiguration,
} from "../dist/modules/contributor-program/voicestudio-batch.client.js";

// Isolate the VoiceStudio test fixture from production defaults. The tests
// below deliberately remove these flags to assert fail-closed behavior.
const priorVoiceEnabled = process.env.SEMSE_VOICE_ENABLED;
const priorVoiceStudioDevEnabled = process.env.SEMSE_VOICESTUDIO_DEV_ENABLED;
test.before(() => {
  process.env.SEMSE_VOICE_ENABLED = "true";
  process.env.SEMSE_VOICESTUDIO_DEV_ENABLED = "true";
});
test.after(() => {
  if (priorVoiceEnabled === undefined) delete process.env.SEMSE_VOICE_ENABLED;
  else process.env.SEMSE_VOICE_ENABLED = priorVoiceEnabled;
  if (priorVoiceStudioDevEnabled === undefined) delete process.env.SEMSE_VOICESTUDIO_DEV_ENABLED;
  else process.env.SEMSE_VOICESTUDIO_DEV_ENABLED = priorVoiceStudioDevEnabled;
});

const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE"), Buffer.alloc(36)]);

const base = {
  baseUrl: "https://speech.example.com/",
  apiKey: "test-secret",
  asrModel: "faster-whisper",
  ttsModel: "kittentts",
  ttsVoice: "alloy",
  timeoutMs: 3000,
};

const verbose = (data: object): Response =>
  new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });

function errorCode(value: unknown, expected: string): boolean {
  assert.ok(value instanceof VoiceStudioGatewayError);
  assert.equal(value.code, expected);
  return true;
}

test("ASR batch posts authorized bytes as multipart without a user supplied upstream URL", async () => {
  let calls = 0;
  const fetchImpl = async (url: string | URL, init?: RequestInit): Promise<Response> => {
    calls++;
    assert.equal(String(url), "https://speech.example.com/v1/audio/transcriptions");
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "error");
    assert.equal((init?.headers as Record<string, string>)?.Authorization, "Bearer test-secret");
    assert.equal((init?.headers as Record<string, string>)?.["Content-Type"], undefined, "let FormData set boundary");
    const body = init?.body as FormData;
    assert.equal(body.get("model"), "faster-whisper");
    assert.equal(body.get("response_format"), "verbose_json");
    assert.equal(body.get("language"), "es");
    const attachment = body.get("file") as Blob;
    assert.equal(attachment.type, "audio/wav");
    assert.deepEqual(Buffer.from(await attachment.arrayBuffer()), wav);
    return verbose({
      text: "Buenos días",
      segments: [{ start: 0.25, end: 1.75, text: " Buenos días ", avg_logprob: 0 }],
    });
  };
  const client = new VoiceStudioBatchClient({ ...base, fetchImpl: fetchImpl as typeof fetch });
  assert.deepEqual(await client.transcribe(wav, "audio/x-wav", "es"), [{
    startMs: 250, endMs: 1750, text: "Buenos días",
  }]);
  assert.equal(calls, 1);
});

test("ASR locale es/en is forwarded, omitted when absent, and rejects unsupported values before egress", async () => {
  const languages: Array<string | null> = [];
  const client = new VoiceStudioBatchClient({
    ...base,
    fetchImpl: (async (_url: string | URL, init?: RequestInit) => {
      const form = init?.body as FormData;
      languages.push(form.get("language") as string | null);
      return verbose({ text: "hello", segments: [{ start: 0, end: 1, text: "hello" }] });
    }) as typeof fetch,
  });
  await client.transcribe(wav, "audio/wav", "en");
  await client.transcribe(wav);
  await assert.rejects(() => client.transcribe(wav, "audio/wav", "fr" as "en"),
    (e: unknown) => errorCode(e, "VOICE_ASR_LANGUAGE_UNSUPPORTED"));
  assert.deepEqual(languages, ["en", null], "invalid locale never reaches the upstream");
});

test("ASR batch treats silence as empty, but refuses text without timestamp segments", async () => {
  const silent = new VoiceStudioBatchClient({
    ...base, fetchImpl: (async () => verbose({ text: "", segments: [] })) as typeof fetch,
  });
  assert.deepEqual(await silent.transcribe(wav), []);
  const noTimings = new VoiceStudioBatchClient({
    ...base, fetchImpl: (async () => verbose({ text: "hello", segments: [] })) as typeof fetch,
  });
  await assert.rejects(() => noTimings.transcribe(wav), (e: unknown) => errorCode(e, "VOICE_SEGMENT_TIMESTAMPS_MISSING"));
});

test("ASR batch rejects invalid buffer or mismatch BEFORE network egress", async () => {
  let calls = 0;
  const client = new VoiceStudioBatchClient({
    ...base, fetchImpl: (async () => { calls++; throw new Error("unexpected outbound"); }) as typeof fetch,
  });
  await assert.rejects(() => client.transcribe(Buffer.alloc(0)), (e: unknown) => errorCode(e, "VOICE_AUDIO_EMPTY"));
  await assert.rejects(() => client.transcribe(Buffer.from("not audio")), (e: unknown) => errorCode(e, "VOICE_AUDIO_UNSUPPORTED"));
  await assert.rejects(() => client.transcribe(Buffer.alloc(15 * 1024 * 1024 + 1)), (e: unknown) => errorCode(e, "VOICE_AUDIO_TOO_LARGE"));
  await assert.rejects(() => client.transcribe(wav, "audio/mpeg"), (e: unknown) => errorCode(e, "VOICE_AUDIO_MIME_MISMATCH"));
  assert.equal(calls, 0);
});

test("ASR provider uses storage key, not arbitrary URL; no original file key leaves the process", async () => {
  let requestedKey: string | undefined;
  const provider = new VoiceStudioTranscriptionProvider({
    async readBuffer() { throw new Error("unbounded read not permitted"); },
    createReadStream(key: string) { requestedKey = key; return Readable.from([wav]); },
  }, {
    ...base,
    fetchImpl: (async (_url: string | URL, init?: RequestInit) => {
      const form = init?.body as FormData;
      assert.equal((form.get("file") as File).name, "recording.wav");
      return verbose({ text: "review", segments: [{ start: 1, end: 2, text: "review" }] });
    }) as typeof fetch,
  });
  await assert.rejects(() => provider.transcribe({ storageKey: "http://metadata.internal/secret", mimeType: "audio/wav" }),
    (e: unknown) => errorCode(e, "VOICE_STORAGE_KEY_INVALID"));
  assert.equal(requestedKey, undefined);
  const segments = await provider.transcribe({ storageKey: "tenants/tenant_a/assets/private.wav", mimeType: "audio/wav" });
  assert.equal(requestedKey, "tenants/tenant_a/assets/private.wav");
  assert.deepEqual(segments, [{ startMs: 1000, endMs: 2000, text: "review" }]);
});

test("batch transport refuses unsafe origins and admin paths", () => {
  for (const origin of [
    "http://169.254.169.254/", "http://127.0.0.1:3900/",
    "https://user:pass@speech.example.com/", "https://speech.example.com/system/info",
    "https://speech.example.com/?target=http://internal",
    "https://127.0.0.1/", "https://169.254.169.254/", "https://[::1]/",
  ]) {
    assert.throws(() => new VoiceStudioBatchClient({ ...base, baseUrl: origin }), VoiceStudioGatewayError);
  }
  assert.doesNotThrow(() => new VoiceStudioBatchClient({
    ...base, baseUrl: "http://voice.railway.internal/", allowPrivateHttp: true,
  }));
  assert.throws(() => new VoiceStudioBatchClient({
    ...base, baseUrl: "http://voice.railway.internal/", allowPrivateHttp: false,
  }), (e: unknown) => errorCode(e, "VOICE_CONFIG_UNSAFE_ORIGIN"));
});

test("TTS batch outputs verified WAV and keeps fixed server-owned model/voice", async () => {
  let outbound = 0;
  const client = new VoiceStudioBatchClient({
    ...base,
    fetchImpl: (async (url: string | URL, init?: RequestInit) => {
      outbound++;
      assert.equal(String(url), "https://speech.example.com/v1/audio/speech");
      assert.equal((init?.headers as Record<string, string>)?.Authorization, "Bearer test-secret");
      assert.equal(init?.redirect, "error");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        model: "kittentts", voice: "alloy", input: "Hola supervisor", response_format: "wav",
      });
      return new Response(wav, { status: 200, headers: { "content-type": "audio/wav" } });
    }) as typeof fetch,
  });
  const result = await client.synthesize("Hola supervisor");
  assert.equal(result.mimeType, "audio/wav");
  assert.deepEqual(result.audio, wav);
  assert.equal(outbound, 1);
});

test("TTS fails closed on malformed audio, content-type mismatch, and excessive output", async () => {
  const invalid = new VoiceStudioBatchClient({
    ...base, fetchImpl: (async () => new Response("not a wave", {
      status: 200, headers: { "content-type": "audio/wav" },
    })) as typeof fetch,
  });
  await assert.rejects(() => invalid.synthesize("hello"), (e: unknown) => errorCode(e, "VOICE_UPSTREAM_INVALID_AUDIO"));
  const wrongType = new VoiceStudioBatchClient({
    ...base, fetchImpl: (async () => new Response("{}", {
      status: 200, headers: { "content-type": "application/json" },
    })) as typeof fetch,
  });
  await assert.rejects(() => wrongType.synthesize("hello"), (e: unknown) => errorCode(e, "VOICE_UPSTREAM_INVALID_CONTENT_TYPE"));
  const huge = new VoiceStudioBatchClient({
    ...base, fetchImpl: (async () => new Response("x", {
      status: 200, headers: { "content-type": "audio/wav", "content-length": String(16 * 1024 * 1024) },
    })) as typeof fetch,
  });
  await assert.rejects(() => huge.synthesize("hello"), (e: unknown) => errorCode(e, "VOICE_UPSTREAM_BODY_TOO_LARGE"));
});

test("batch errors are redacted, explicit and never retry or fall back silently", async () => {
  let calls = 0;
  const client = new VoiceStudioBatchClient({
    ...base,
    fetchImpl: (async () => {
      calls++;
      return new Response("secret host details", { status: 429, headers: { "content-type": "text/plain" } });
    }) as typeof fetch,
  });
  await assert.rejects(() => client.transcribe(wav), (e: unknown) => errorCode(e, "VOICE_UPSTREAM_HTTP_429"));
  assert.equal(calls, 1);
});

test("dev resolver never permits production; dev OFF is inert", () => {
  const config: NodeJS.ProcessEnv = {
    NODE_ENV: "test", SEMSE_VOICE_ENABLED: "true", SEMSE_VOICESTUDIO_DEV_ENABLED: "true",
    SEMSE_VOICESTUDIO_BASE_URL: "https://speech.example.com/",
    SEMSE_VOICESTUDIO_API_KEY: "test-secret",
    SEMSE_VOICESTUDIO_ASR_MODEL: "faster-whisper",
  };
  assert.equal(resolveVoiceStudioDevConfiguration(config).asrModel, "faster-whisper");
  assert.throws(() => resolveVoiceStudioDevConfiguration({ ...config, NODE_ENV: "production" }),
    (e: unknown) => errorCode(e, "VOICE_PRODUCTION_ACTIVATION_BLOCKED"));
  assert.throws(() => resolveVoiceStudioDevConfiguration({ ...config, RAILWAY_ENVIRONMENT_NAME: "production" }),
    (e: unknown) => errorCode(e, "VOICE_PRODUCTION_ACTIVATION_BLOCKED"));
  assert.throws(() => resolveVoiceStudioDevConfiguration({ ...config, SEMSE_VOICESTUDIO_DEV_ENABLED: undefined }),
    (e: unknown) => errorCode(e, "VOICE_FEATURE_DISABLED"));
  assert.throws(() => resolveVoiceStudioDevConfiguration({ ...config, SEMSE_VOICE_ENABLED: undefined }),
    (e: unknown) => errorCode(e, "VOICE_FEATURE_DISABLED"));
});


test("Railway staging with Docker NODE_ENV=production requires a separate explicit opt-in", () => {
  const fixture: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    RAILWAY_ENVIRONMENT_NAME: "staging",
    SEMSE_VOICE_ENABLED: "true",
    SEMSE_VOICESTUDIO_DEV_ENABLED: "true",
    SEMSE_VOICESTUDIO_BASE_URL: "http://voice.railway.internal:3900",
    SEMSE_VOICESTUDIO_PRIVATE_HTTP_OK: "true",
    SEMSE_VOICESTUDIO_API_KEY: "staging-test-key",
    SEMSE_VOICESTUDIO_ASR_MODEL: "faster-whisper",
    SEMSE_VOICESTUDIO_STAGING_NODE_ENV_OK: "true",
  };
  assert.doesNotThrow(() => resolveVoiceStudioDevConfiguration(fixture));
  assert.throws(() => resolveVoiceStudioDevConfiguration({
    ...fixture, SEMSE_VOICESTUDIO_STAGING_NODE_ENV_OK: undefined,
  }), (e: unknown) => errorCode(e, "VOICE_PRODUCTION_ACTIVATION_BLOCKED"));
  for (const marker of [
    { RAILWAY_ENVIRONMENT_NAME: "production" },
    { RAILWAY_ENVIRONMENT: "prod" },
    { SEMSE_ENVIRONMENT: "production" },
    { RAILWAY_ENVIRONMENT_NAME: undefined },
  ]) {
    assert.throws(() => resolveVoiceStudioDevConfiguration({ ...fixture, ...marker }),
      (e: unknown) => errorCode(e, "VOICE_PRODUCTION_ACTIVATION_BLOCKED"));
  }
  assert.throws(() => resolveVoiceStudioDevConfiguration({
    ...fixture, SEMSE_VOICESTUDIO_DEV_ENABLED: undefined,
  }), (e: unknown) => errorCode(e, "VOICE_FEATURE_DISABLED"));
});

test("direct client construction cannot bypass the production gate", () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.throws(() => new VoiceStudioBatchClient(base),
      (e: unknown) => errorCode(e, "VOICE_PRODUCTION_ACTIVATION_BLOCKED"));
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});


test("direct VoiceStudio construction in Railway staging requires BOTH feature flags", () => {
  const keys = [
    "NODE_ENV", "SEMSE_ENVIRONMENT", "RAILWAY_ENVIRONMENT",
    "RAILWAY_ENVIRONMENT_NAME", "SEMSE_VOICESTUDIO_STAGING_NODE_ENV_OK",
    "SEMSE_VOICE_ENABLED", "SEMSE_VOICESTUDIO_DEV_ENABLED",
  ] as const;
  const previous = keys.map((key) => [key, process.env[key]] as const);
  try {
    for (const key of keys) delete process.env[key];
    process.env.NODE_ENV = "production";
    process.env.RAILWAY_ENVIRONMENT_NAME = "staging";
    process.env.SEMSE_VOICESTUDIO_STAGING_NODE_ENV_OK = "true";
    assert.throws(() => new VoiceStudioBatchClient(base),
      (e: unknown) => errorCode(e, "VOICE_FEATURE_DISABLED"));
    process.env.SEMSE_VOICE_ENABLED = "true";
    assert.throws(() => new VoiceStudioBatchClient(base),
      (e: unknown) => errorCode(e, "VOICE_FEATURE_DISABLED"));
    process.env.SEMSE_VOICESTUDIO_DEV_ENABLED = "true";
    assert.doesNotThrow(() => new VoiceStudioBatchClient(base));
    process.env.SEMSE_ENVIRONMENT = "production";
    assert.throws(() => new VoiceStudioBatchClient(base),
      (e: unknown) => errorCode(e, "VOICE_PRODUCTION_ACTIVATION_BLOCKED"));
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("turning off voice after client creation prevents all network egress", async () => {
  let egress = 0;
  const client = new VoiceStudioBatchClient({
    ...base,
    fetchImpl: (async () => { egress++; throw new Error("unexpected network request"); }) as typeof fetch,
  });
  const previous = process.env.SEMSE_VOICESTUDIO_DEV_ENABLED;
  try {
    delete process.env.SEMSE_VOICESTUDIO_DEV_ENABLED;
    await assert.rejects(() => client.transcribe(wav),
      (e: unknown) => errorCode(e, "VOICE_FEATURE_DISABLED"));
    assert.equal(egress, 0);
  } finally {
    if (previous === undefined) delete process.env.SEMSE_VOICESTUDIO_DEV_ENABLED;
    else process.env.SEMSE_VOICESTUDIO_DEV_ENABLED = previous;
  }
});

test("VoiceStudio requires a bounded stream and never falls back to full readFile", async () => {
  let reads = 0;
  const provider = new VoiceStudioTranscriptionProvider({
    async readBuffer() { reads++; return wav; },
  }, { ...base, fetchImpl: (async () => { throw new Error("unexpected egress"); }) as typeof fetch });
  await assert.rejects(() => provider.transcribe({ storageKey: "tenants/test/audio.wav", mimeType: "audio/wav" }),
    (e: unknown) => errorCode(e, "VOICE_BOUNDED_STORAGE_REQUIRED"));
  assert.equal(reads, 0);
});

test("bounded storage rejects files above 15 MiB before any network egress or unbounded buffering", async () => {
  let reads = 0;
  let egress = 0;
  const provider = new VoiceStudioTranscriptionProvider({
    async readBuffer() { reads++; return wav; },
    createReadStream() {
      return Readable.from((function* () {
        yield wav;
        for (let i = 0; i < 16; i++) yield Buffer.alloc(1024 * 1024);
      })());
    },
  }, {
    ...base, fetchImpl: (async () => { egress++; throw new Error("unexpected outbound"); }) as typeof fetch,
  });
  await assert.rejects(() => provider.transcribe({ storageKey: "tenants/test/huge.wav", mimeType: "audio/wav" }),
    (e: unknown) => errorCode(e, "VOICE_AUDIO_TOO_LARGE"));
  assert.equal(reads, 0);
  assert.equal(egress, 0);
});

test("bounded storage rejects damaged streams without network egress", async () => {
  let egress = 0;
  const provider = new VoiceStudioTranscriptionProvider({
    async readBuffer() { throw new Error("unbounded read"); },
    createReadStream() {
      return Readable.from((async function* () {
        yield wav;
        throw new Error("local path and sensitive details");
      })());
    },
  }, { ...base, fetchImpl: (async () => { egress++; throw new Error("unexpected"); }) as typeof fetch });
  await assert.rejects(() => provider.transcribe({ storageKey: "tenants/test/corrupt.wav", mimeType: "audio/wav" }),
    (e: unknown) => errorCode(e, "VOICE_STORAGE_READ_FAILED"));
  assert.equal(egress, 0);
});
