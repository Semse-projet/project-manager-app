import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_VISION_FRAME_MAX_BYTES,
  resolveFrameMaxBytes,
  sniffImageMime,
  validateVisionInput,
} from "../dist/modules/vision/vision-frame.js";

// Sense Vision — frame validation for POST /v1/vision/recognize.
// Spec: docs/specs/vision/sense-vision-field-library.spec.md §4 P5 / §9.

const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01];
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d];
const WEBP_HEAD = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

function b64(head: number[], totalBytes = 48): string {
  const bytes = Buffer.alloc(totalBytes, 7);
  Buffer.from(head).copy(bytes);
  return bytes.toString("base64");
}

test("imageUrl stays supported (backwards-compatible input)", () => {
  const result = validateVisionInput({ imageUrl: "https://cdn.example.railway.app/a.jpg" });
  assert.deepEqual(result, { ok: true, value: { kind: "url", imageUrl: "https://cdn.example.railway.app/a.jpg" } });
});

test("imageUrl must be absolute http(s)", () => {
  for (const imageUrl of ["not a url", "ftp://host/a.jpg", "file:///etc/passwd", "javascript:alert(1)"]) {
    const result = validateVisionInput({ imageUrl });
    assert.equal(result.ok, false, imageUrl);
    assert.equal(!result.ok && result.code, "invalid_url");
  }
});

test("exactly one image source is required", () => {
  assert.equal((validateVisionInput({}) as any).code, "missing_image");
  assert.equal((validateVisionInput({ imageUrl: "   " }) as any).code, "missing_image");
  assert.equal(
    (validateVisionInput({ imageUrl: "https://x.railway.app/a.jpg", imageData: b64(JPEG_HEAD), mimeType: "image/jpeg" }) as any).code,
    "ambiguous_image",
  );
});

test("accepts jpeg, png and webp frames whose bytes match the declared mime", () => {
  for (const [head, mimeType] of [
    [JPEG_HEAD, "image/jpeg"],
    [PNG_HEAD, "image/png"],
    [WEBP_HEAD, "image/webp"],
  ] as const) {
    const result = validateVisionInput({ imageData: b64([...head]), mimeType });
    assert.equal(result.ok, true, mimeType);
    assert.equal(result.ok && result.value.kind === "data" && result.value.mimeType, mimeType);
    assert.equal(result.ok && result.value.kind === "data" && result.value.byteLength, 48);
  }
});

test("accepts a canvas data URL and takes the mime from it", () => {
  const result = validateVisionInput({ imageData: `data:image/jpeg;base64,${b64(JPEG_HEAD)}` });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value.kind === "data" && result.value.imageData, b64(JPEG_HEAD));
});

test("rejects a missing or unsupported mime type", () => {
  assert.equal((validateVisionInput({ imageData: b64(JPEG_HEAD) }) as any).code, "missing_mime_type");
  assert.equal((validateVisionInput({ imageData: b64(JPEG_HEAD), mimeType: "image/gif" }) as any).code, "unsupported_mime_type");
  assert.equal((validateVisionInput({ imageData: b64(JPEG_HEAD), mimeType: "text/html" }) as any).code, "unsupported_mime_type");
});

test("rejects an empty payload", () => {
  assert.equal((validateVisionInput({ imageData: "", mimeType: "image/jpeg" }) as any).code, "empty_image");
  assert.equal((validateVisionInput({ imageData: "data:image/jpeg;base64,", mimeType: "image/jpeg" }) as any).code, "empty_image");
});

test("rejects invalid base64", () => {
  for (const imageData of ["@@@@", "abc", "ab!d", "YWJj ZA=="]) {
    assert.equal((validateVisionInput({ imageData, mimeType: "image/jpeg" }) as any).code, "invalid_base64", imageData);
  }
});

test("rejects oversized frames", () => {
  const big = b64(JPEG_HEAD, 2000);
  assert.equal((validateVisionInput({ imageData: big, mimeType: "image/jpeg" }, 1000) as any).code, "image_too_large");
  assert.equal(validateVisionInput({ imageData: big, mimeType: "image/jpeg" }, 5000).ok, true);
});

test("rejects bytes that do not match the declared mime (e.g. HTML smuggled as jpeg)", () => {
  const html = Buffer.from("<html><script>alert(1)</script></html>").toString("base64");
  assert.equal((validateVisionInput({ imageData: html, mimeType: "image/jpeg" }) as any).code, "mime_mismatch");
  assert.equal((validateVisionInput({ imageData: b64(PNG_HEAD), mimeType: "image/jpeg" }) as any).code, "mime_mismatch");
});

test("sniffImageMime recognises the three allowed formats only", () => {
  assert.equal(sniffImageMime(Uint8Array.from(JPEG_HEAD)), "image/jpeg");
  assert.equal(sniffImageMime(Uint8Array.from(PNG_HEAD)), "image/png");
  assert.equal(sniffImageMime(Uint8Array.from(WEBP_HEAD)), "image/webp");
  assert.equal(sniffImageMime(Uint8Array.from([0x47, 0x49, 0x46, 0x38])), null);
});

test("frame size limit is configurable and defaults safely under Fastify's 1 MiB body limit", () => {
  assert.equal(resolveFrameMaxBytes({}), DEFAULT_VISION_FRAME_MAX_BYTES);
  assert.equal(resolveFrameMaxBytes({ VISION_FRAME_MAX_BYTES: "250000" }), 250000);
  assert.equal(resolveFrameMaxBytes({ VISION_FRAME_MAX_BYTES: "-3" }), DEFAULT_VISION_FRAME_MAX_BYTES);
  assert.ok(Math.ceil(DEFAULT_VISION_FRAME_MAX_BYTES / 3) * 4 < 1024 * 1024);
});
