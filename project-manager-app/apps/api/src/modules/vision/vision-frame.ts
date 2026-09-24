// Sense Vision — temporary frame validation for POST /v1/vision/recognize.
// Spec: docs/specs/vision/sense-vision-field-library.spec.md §4 (P5) / §5.2.
//
// Pure (no Nest, no I/O) so every rejection path is unit-testable. Frames
// are validated here and forwarded to vision-service in memory; nothing in
// this file (or its callers) persists them.
import { VISION_FRAME_MIME_TYPES, type VisionFrameMimeType } from "@semse/schemas";

export type ValidatedVisionInput =
  | { kind: "url"; imageUrl: string }
  | { kind: "data"; imageData: string; mimeType: VisionFrameMimeType; byteLength: number };

export type VisionInputErrorCode =
  | "missing_image"
  | "ambiguous_image"
  | "invalid_url"
  | "missing_mime_type"
  | "unsupported_mime_type"
  | "empty_image"
  | "invalid_base64"
  | "image_too_large"
  | "mime_mismatch";

export type VisionInputValidation =
  | { ok: true; value: ValidatedVisionInput }
  | { ok: false; code: VisionInputErrorCode; message: string };

// ~700 KB decoded ≈ 933 KB of base64, which keeps the JSON body under
// Fastify's default 1 MiB bodyLimit (main.ts does not raise it). The web
// client resizes to ≤ 1024 px JPEG before sending, typically 60–250 KB.
export const DEFAULT_VISION_FRAME_MAX_BYTES = 700_000;

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function fail(code: VisionInputErrorCode, message: string): VisionInputValidation {
  return { ok: false, code, message };
}

/** Accepts both raw base64 and a `data:<mime>;base64,` URL (what canvas.toDataURL returns). */
function stripDataUrlPrefix(imageData: string): { payload: string; declaredMime: string | null } {
  const match = /^data:([^;,]+);base64,/.exec(imageData);
  if (!match) return { payload: imageData, declaredMime: null };
  return { payload: imageData.slice(match[0].length), declaredMime: match[1].toLowerCase() };
}

function decodedLength(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length * 3) / 4 - padding;
}

/** Magic-byte sniffing so a declared MIME can't smuggle a different payload. */
export function sniffImageMime(bytes: Uint8Array): VisionFrameMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function resolveFrameMaxBytes(env: NodeJS.ProcessEnv = process.env): number {
  const parsed = Number.parseInt(env.VISION_FRAME_MAX_BYTES ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_VISION_FRAME_MAX_BYTES;
}

export function validateVisionInput(
  raw: { imageUrl?: unknown; imageData?: unknown; mimeType?: unknown },
  maxBytes: number = DEFAULT_VISION_FRAME_MAX_BYTES,
): VisionInputValidation {
  const hasUrl = typeof raw.imageUrl === "string" && raw.imageUrl.trim().length > 0;
  const hasData = typeof raw.imageData === "string";

  if (hasUrl && hasData) return fail("ambiguous_image", "Send either imageUrl or imageData, not both.");
  if (!hasUrl && !hasData) return fail("missing_image", "imageUrl or imageData is required.");

  if (hasUrl) {
    const imageUrl = (raw.imageUrl as string).trim();
    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      return fail("invalid_url", "imageUrl must be an absolute http(s) URL.");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return fail("invalid_url", "imageUrl must be an absolute http(s) URL.");
    }
    // Host allowlisting / private-IP blocking stays in vision-service
    // (image_loader._assert_safe_url) — the single place that fetches.
    return { ok: true, value: { kind: "url", imageUrl } };
  }

  const { payload, declaredMime } = stripDataUrlPrefix((raw.imageData as string).trim());
  const mimeCandidate = typeof raw.mimeType === "string" ? raw.mimeType.toLowerCase() : declaredMime;
  if (!mimeCandidate) return fail("missing_mime_type", "mimeType is required with imageData.");
  if (!(VISION_FRAME_MIME_TYPES as readonly string[]).includes(mimeCandidate)) {
    return fail("unsupported_mime_type", `mimeType must be one of ${VISION_FRAME_MIME_TYPES.join(", ")}.`);
  }
  const mimeType = mimeCandidate as VisionFrameMimeType;

  if (payload.length === 0) return fail("empty_image", "imageData is empty.");
  if (payload.length % 4 !== 0 || !BASE64_RE.test(payload)) {
    return fail("invalid_base64", "imageData is not valid base64.");
  }
  const byteLength = decodedLength(payload);
  if (byteLength > maxBytes) {
    return fail("image_too_large", `Frame exceeds ${maxBytes} bytes; resize before sending.`);
  }

  const head = Buffer.from(payload.slice(0, 24), "base64");
  const sniffed = sniffImageMime(head);
  if (sniffed !== mimeType) {
    return fail("mime_mismatch", "imageData content does not match the declared mimeType.");
  }

  return { ok: true, value: { kind: "data", imageData: payload, mimeType, byteLength } };
}
