import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isLikelyEquirectangular, validateLocalPanoramaFile } from "../../apps/web/app/workspace/lib/panorama-validation.ts";

test("panorama preview only accepts bounded web image formats", () => {
  assert.equal(validateLocalPanoramaFile({ type: "image/jpeg", size: 1_000_000 }), null);
  assert.equal(validateLocalPanoramaFile({ type: "image/png", size: 3_000_000 }), null);
  assert.equal(validateLocalPanoramaFile({ type: "image/webp", size: 1_000_000 }), null);
  assert.ok(validateLocalPanoramaFile({ type: "image/heic", size: 1000 }));
  assert.ok(validateLocalPanoramaFile({ type: "application/pdf", size: 1000 }));
  assert.ok(validateLocalPanoramaFile({ type: "image/jpeg", size: 0 }));
  assert.ok(validateLocalPanoramaFile({ type: "image/jpeg", size: 31 * 1024 * 1024 }));
});

test("360 preview rejects ordinary and invalid aspect ratios", () => {
  assert.equal(isLikelyEquirectangular(4096, 2048), true);
  assert.equal(isLikelyEquirectangular(3840, 1920), true);
  assert.equal(isLikelyEquirectangular(1600, 1200), false);
  assert.equal(isLikelyEquirectangular(0, 200), false);
  assert.equal(isLikelyEquirectangular(100, Number.NaN), false);
});

test("local preview never uploads the selected photo or rebrands it as verified evidence", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const page = readFileSync(path.join(root, "apps/web/app/workspace/recorridos-360/page.tsx"), "utf8");
  assert.match(page, /URL.createObjectURL\(file\)/);
  assert.match(page, /URL.revokeObjectURL\(objectUrl\)/);
  assert.doesNotMatch(page, /\bfetch\(/);
  assert.doesNotMatch(page, /XMLHttpRequest/);
  assert.match(page, /no se sube/);
});
