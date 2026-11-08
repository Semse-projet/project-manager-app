/**
 * Internal VoiceStudio batch adapters. No controller or public route may use
 * these until media/response ownership, consent and D4/D5 have been approved.
 * In particular, never pass AgroEvidenceItem.fileUrl to this module.
 *
 * The development resolver refuses production regardless of environment flags.
 * A separate reviewed change is required for commercial activation.
 */
import type {
  TranscriptionProvider,
  TranscriptionSegment,
  TranscriptionStorageReader,
} from "./transcription-provider.js";

const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 15 * 1024 * 1024;
const MAX_JSON_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 120_000;

export type VoiceStudioConfiguration = {
  baseUrl: string;
  apiKey: string;
  asrModel?: string;
  ttsModel?: string;
  ttsVoice?: string;
  allowPrivateHttp?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export class VoiceStudioGatewayError extends Error {
  constructor(public readonly code: string, public readonly upstreamStatus?: number) {
    super(code);
    this.name = "VoiceStudioGatewayError";
  }
}

function fixedOrigin(config: VoiceStudioConfiguration): string {
  let parsed: URL;
  try {
    parsed = new URL(config.baseUrl);
  } catch {
    throw new VoiceStudioGatewayError("VOICE_CONFIG_INVALID");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    throw new VoiceStudioGatewayError("VOICE_CONFIG_INVALID");
  }
  const hostname = parsed.hostname.toLowerCase();
  const privateRailway = hostname.endsWith(".railway.internal");
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && privateRailway && config.allowPrivateHttp === true)) {
    throw new VoiceStudioGatewayError("VOICE_CONFIG_UNSAFE_ORIGIN");
  }
  if (parsed.protocol === "https:" && (hostname === "localhost" || hostname.endsWith(".local"))) {
    throw new VoiceStudioGatewayError("VOICE_CONFIG_UNSAFE_ORIGIN");
  }
  return parsed.origin;
}

function nonempty(value: string | undefined, code: string): string {
  const v = value?.trim();
  if (!v) throw new VoiceStudioGatewayError(code);
  return v;
}

function modelName(value: string | undefined): string {
  const model = nonempty(value, "VOICE_MODEL_NOT_CONFIGURED");
  // Aliases silently use the currently selected engine in VoiceStudio.
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(model) ||
      ["whisper-1", "tts-1", "tts-1-hd", "gpt-4o-mini-tts"].includes(model)) {
    throw new VoiceStudioGatewayError("VOICE_MODEL_MUST_BE_EXPLICIT");
  }
  return model;
}

function timeoutMs(value?: number): number {
  const ms = value ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(ms) || ms < 1000 || ms > 180_000) {
    throw new VoiceStudioGatewayError("VOICE_CONFIG_INVALID");
  }
  return ms;
}

function sniffAudio(bytes: Buffer): { mimeType: string; filename: string } {
  if (!bytes.length || bytes.length > MAX_INPUT_BYTES) {
    throw new VoiceStudioGatewayError(bytes.length ? "VOICE_AUDIO_TOO_LARGE" : "VOICE_AUDIO_EMPTY");
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE")
    return { mimeType: "audio/wav", filename: "recording.wav" };
  if (bytes.length >= 4 && bytes.toString("ascii", 0, 4) === "OggS")
    return { mimeType: "audio/ogg", filename: "recording.ogg" };
  if (bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])))
    return { mimeType: "audio/webm", filename: "recording.webm" };
  if (bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp")
    return { mimeType: "audio/mp4", filename: "recording.m4a" };
  if (bytes.length >= 3 && bytes.toString("ascii", 0, 3) === "ID3" ||
      bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0)
    return { mimeType: "audio/mpeg", filename: "recording.mp3" };
  if (bytes.length >= 4 && bytes.toString("ascii", 0, 4) === "fLaC")
    return { mimeType: "audio/flac", filename: "recording.flac" };
  throw new VoiceStudioGatewayError("VOICE_AUDIO_UNSUPPORTED");
}

async function readLimited(response: Response, maxBytes: number): Promise<Buffer> {
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    await response.body?.cancel().catch(() => undefined);
    throw new VoiceStudioGatewayError("VOICE_UPSTREAM_BODY_TOO_LARGE");
  }
  if (!response.body) throw new VoiceStudioGatewayError("VOICE_UPSTREAM_EMPTY_BODY");
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        // Cancel without awaiting an uncooperative upstream.
        void reader.cancel().catch(() => undefined);
        throw new VoiceStudioGatewayError("VOICE_UPSTREAM_BODY_TOO_LARGE");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

function normalizeSegments(raw: unknown): TranscriptionSegment[] {
  if (typeof raw !== "object" || raw === null) throw new VoiceStudioGatewayError("VOICE_UPSTREAM_INVALID_RESPONSE");
  const data = raw as Record<string, unknown>;
  if (typeof data.text !== "string" || !Array.isArray(data.segments)) {
    throw new VoiceStudioGatewayError("VOICE_UPSTREAM_INVALID_RESPONSE");
  }
  if (data.segments.length === 0) {
    if (!data.text.trim()) return []; // silence is not an invented transcript
    throw new VoiceStudioGatewayError("VOICE_SEGMENT_TIMESTAMPS_MISSING");
  }
  const segments: TranscriptionSegment[] = [];
  for (const entry of data.segments) {
    if (typeof entry !== "object" || entry === null) throw new VoiceStudioGatewayError("VOICE_UPSTREAM_INVALID_RESPONSE");
    const part = entry as Record<string, unknown>;
    if (typeof part.text !== "string" || typeof part.start !== "number" || typeof part.end !== "number" ||
        !Number.isFinite(part.start) || !Number.isFinite(part.end) || part.start < 0 || part.end < part.start) {
      throw new VoiceStudioGatewayError("VOICE_UPSTREAM_INVALID_RESPONSE");
    }
    const text = part.text.trim();
    if (text) segments.push({
      startMs: Math.round(part.start * 1000),
      endMs: Math.round(part.end * 1000),
      text,
      // VoiceStudio emits neutral avg_logprob values for some models; do not
      // invent or infer confidence from those placeholders.
    });
  }
  if (data.text.trim() && segments.length === 0) throw new VoiceStudioGatewayError("VOICE_UPSTREAM_INVALID_RESPONSE");
  return segments;
}

export class VoiceStudioBatchClient {
  private readonly origin: string;
  private readonly apiKey: string;
  private readonly transport: typeof fetch;
  private readonly duration: number;

  constructor(private readonly config: VoiceStudioConfiguration) {
    this.origin = fixedOrigin(config);
    this.apiKey = nonempty(config.apiKey, "VOICE_API_KEY_NOT_CONFIGURED");
    this.transport = config.fetchImpl ?? fetch;
    this.duration = timeoutMs(config.timeoutMs);
  }

  private async post(path: "/v1/audio/transcriptions" | "/v1/audio/speech", body: BodyInit, contentType?: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.duration);
    try {
      const response = await this.transport(this.origin + path, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + this.apiKey,
          ...(contentType ? { "Content-Type": contentType } : {}),
        },
        body,
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new VoiceStudioGatewayError("VOICE_UPSTREAM_HTTP_" + response.status, response.status);
      }
      // Caller must consume the response before the configured timeout.
      return response;
    } catch (error) {
      if (error instanceof VoiceStudioGatewayError) throw error;
      throw new VoiceStudioGatewayError(controller.signal.aborted ? "VOICE_UPSTREAM_TIMEOUT" : "VOICE_UPSTREAM_UNAVAILABLE");
    } finally {
      clearTimeout(timer);
    }
  }

  async transcribe(bytes: Buffer): Promise<TranscriptionSegment[]> {
    const model = modelName(this.config.asrModel);
    const audio = sniffAudio(bytes);
    const form = new FormData();
    form.append("model", model);
    form.append("response_format", "verbose_json");
    form.append("file", new Blob([Uint8Array.from(bytes)], { type: audio.mimeType }), audio.filename);
    const response = await this.post("/v1/audio/transcriptions", form);
    if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      await response.body?.cancel().catch(() => undefined);
      throw new VoiceStudioGatewayError("VOICE_UPSTREAM_INVALID_CONTENT_TYPE");
    }
    const raw = await readLimited(response, MAX_JSON_BYTES);
    try {
      return normalizeSegments(JSON.parse(raw.toString("utf8")));
    } catch (error) {
      if (error instanceof VoiceStudioGatewayError) throw error;
      throw new VoiceStudioGatewayError("VOICE_UPSTREAM_INVALID_RESPONSE");
    }
  }

  async synthesize(text: string): Promise<{ audio: Buffer; mimeType: "audio/wav" }> {
    const model = modelName(this.config.ttsModel);
    const voice = nonempty(this.config.ttsVoice, "VOICE_TTS_VOICE_NOT_CONFIGURED");
    // Only a fixed server-owned voice. Profiles, instructions and voice design
    // must not be accepted from user content or a transcript.
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(voice)) throw new VoiceStudioGatewayError("VOICE_TTS_VOICE_INVALID");
    if (!text.trim() || text.length > 4096) throw new VoiceStudioGatewayError("VOICE_TTS_TEXT_INVALID");
    const response = await this.post(
      "/v1/audio/speech",
      JSON.stringify({ model, voice, input: text, response_format: "wav" }),
      "application/json",
    );
    const mimeType = response.headers.get("content-type")?.toLowerCase().split(";", 1)[0].trim();
    if (mimeType !== "audio/wav" && mimeType !== "audio/x-wav" && mimeType !== "application/octet-stream") {
      await response.body?.cancel().catch(() => undefined);
      throw new VoiceStudioGatewayError("VOICE_UPSTREAM_INVALID_CONTENT_TYPE");
    }
    const audio = await readLimited(response, MAX_OUTPUT_BYTES);
    if (audio.length < 12 || audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 12) !== "WAVE") {
      throw new VoiceStudioGatewayError("VOICE_UPSTREAM_INVALID_AUDIO");
    }
    return { audio, mimeType: "audio/wav" };
  }
}

function productionEnvironment(env: NodeJS.ProcessEnv): boolean {
  return [env.NODE_ENV, env.SEMSE_ENVIRONMENT, env.RAILWAY_ENVIRONMENT_NAME, env.RAILWAY_ENVIRONMENT]
    .some((value) => typeof value === "string" && (value.toLowerCase() === "production" || value.toLowerCase() === "prod"));
}

export function resolveVoiceStudioDevConfiguration(env: NodeJS.ProcessEnv = process.env): VoiceStudioConfiguration {
  if (productionEnvironment(env)) throw new VoiceStudioGatewayError("VOICE_PRODUCTION_ACTIVATION_BLOCKED");
  if (env.SEMSE_VOICE_ENABLED !== "true" || env.SEMSE_VOICESTUDIO_DEV_ENABLED !== "true") {
    throw new VoiceStudioGatewayError("VOICE_FEATURE_DISABLED");
  }
  const baseUrl = nonempty(env.SEMSE_VOICESTUDIO_BASE_URL, "VOICE_CONFIG_NOT_CONFIGURED");
  const apiKey = nonempty(env.SEMSE_VOICESTUDIO_API_KEY, "VOICE_API_KEY_NOT_CONFIGURED");
  const config: VoiceStudioConfiguration = {
    baseUrl,
    apiKey,
    asrModel: env.SEMSE_VOICESTUDIO_ASR_MODEL,
    ttsModel: env.SEMSE_VOICESTUDIO_TTS_MODEL,
    ttsVoice: env.SEMSE_VOICESTUDIO_TTS_VOICE,
    allowPrivateHttp: env.SEMSE_VOICESTUDIO_PRIVATE_HTTP_OK === "true",
  };
  fixedOrigin(config);
  return config;
}

export class VoiceStudioTranscriptionProvider implements TranscriptionProvider {
  private readonly client: VoiceStudioBatchClient;
  constructor(private readonly storage: TranscriptionStorageReader, config: VoiceStudioConfiguration) {
    this.client = new VoiceStudioBatchClient(config);
    modelName(config.asrModel);
  }

  async transcribe(input: { storageKey: string; mimeType: string | null }): Promise<TranscriptionSegment[]> {
    // A key is never supplied by a browser to this class. Its caller is
    // responsible for authorization and an immutable storage asset receipt.
    if (!input.storageKey || /^[a-z]+:\/\//i.test(input.storageKey)) throw new VoiceStudioGatewayError("VOICE_STORAGE_KEY_INVALID");
    const bytes = await this.storage.readBuffer(input.storageKey);
    return this.client.transcribe(bytes);
  }
}
