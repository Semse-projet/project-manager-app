import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isLikelyEquirectangular, validateLocalPanoramaFile, validateLocalTourBatch, validatePanoramaDimensions } from "../../apps/web/app/workspace/lib/panorama-validation.ts";

test("local panoramas accept bounded JPEG, PNG and WebP images", () => {
  assert.equal(validateLocalPanoramaFile({ type: "image/jpeg", size: 1_000_000 }), null);
  assert.equal(validateLocalPanoramaFile({ type: "image/png", size: 3_000_000 }), null);
  assert.equal(validateLocalPanoramaFile({ type: "image/webp", size: 1_000_000 }), null);
  assert.ok(validateLocalPanoramaFile({ type: "image/heic", size: 1000 }));
  assert.ok(validateLocalPanoramaFile({ type: "image/jpeg", size: 0 }));
  assert.ok(validateLocalPanoramaFile({ type: "image/jpeg", size: 31 * 1024 * 1024 }));
});

test("aspect ratio and decoded image size are bounded", () => {
  assert.equal(isLikelyEquirectangular(4096, 2048), true);
  assert.equal(isLikelyEquirectangular(1600, 1200), false);
  assert.equal(isLikelyEquirectangular(0, 200), false);
  assert.equal(isLikelyEquirectangular(100, Number.NaN), false);
  assert.equal(validatePanoramaDimensions(8192, 4096), null);
  assert.ok(validatePanoramaDimensions(12000, 6000));
  assert.ok(validatePanoramaDimensions(1600, 1200));
});

test("tour stations are limited by total size and count", () => {
  assert.equal(validateLocalTourBatch([], [1000]), null);
  assert.ok(validateLocalTourBatch(new Array(6).fill(1000), [1000]));
  assert.ok(validateLocalTourBatch([], new Array(7).fill(1000)));
  assert.ok(validateLocalTourBatch([30 * 1024 * 1024], [31 * 1024 * 1024]));
  assert.ok(validateLocalTourBatch([], []));
});

test("the panorama route only uses local object URLs and never calls Evidence", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const page = readFileSync(path.join(root, "apps/web/app/workspace/recorridos-360/page.tsx"), "utf8");
  assert.match(page, /URL.createObjectURL\(file\)/);
  assert.match(page, /URL.revokeObjectURL\(url\)/);
  assert.match(page, /multiple/);
  assert.match(page, /moveTo/);
  assert.doesNotMatch(page, /\bfetch\(/);
  assert.doesNotMatch(page, /XMLHttpRequest/);
  assert.match(page, /no se suben/);
});
