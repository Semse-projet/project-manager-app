import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { AgroVisionService } from "../dist/modules/agro/agro-vision.service.js";

function withClient(recognizeObjects: (payload: any) => Promise<any>) {
  return new AgroVisionService({ recognizeObjects } as never);
}

test("agro-vision: disabled provider → null (not an error)", async () => {
  const svc = withClient(async () => ({ disabled: true }));
  assert.equal(await svc.recognize("https://cdn.test/a.jpg"), null);
});

test("agro-vision: successful response → parsed candidates", async () => {
  const svc = withClient(async (payload) => {
    assert.equal(payload.imageUrl, "https://cdn.test/a.jpg");
    assert.ok(payload.vocabulary.some((v: any) => v.slug === "pig"));
    return { disabled: false, body: { provider: "ollama", model: "qwen2.5vl:3b", candidates: [{ slug: "pig", label: "Pig", confidence: 0.87 }] } };
  });
  const result = await svc.recognize("https://cdn.test/a.jpg");
  assert.deepEqual(result, { provider: "ollama", model: "qwen2.5vl:3b", candidates: [{ slug: "pig", label: "Pig", confidence: 0.87 }] });
});

test("agro-vision: malformed body → null, never throws", async () => {
  const svc = withClient(async () => ({ disabled: false, body: { candidates: "not-an-array" } }));
  assert.equal(await svc.recognize("https://cdn.test/a.jpg"), null);
});

test("agro-vision: candidate with garbage fields is sanitized, not dropped", async () => {
  const svc = withClient(async () => ({
    disabled: false,
    body: { provider: "ollama", model: "m", candidates: [{ slug: 123, label: null, confidence: "high" }] },
  }));
  const result = await svc.recognize("https://cdn.test/a.jpg");
  assert.deepEqual(result?.candidates, [{ slug: null, label: null, confidence: 0 }]);
});

test("agro-vision: network/timeout error → null, never throws", async () => {
  const svc = withClient(async () => { throw new Error("timeout"); });
  assert.equal(await svc.recognize("https://cdn.test/a.jpg"), null);
});
