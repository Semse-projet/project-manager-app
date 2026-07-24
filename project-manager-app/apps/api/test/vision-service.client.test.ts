import test from "node:test";
import assert from "node:assert/strict";

import { VisionServiceClient } from "../dist/modules/vision/clients/vision-service.client.js";

test("VisionServiceClient sends the server-side API key", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.VISION_SERVICE_API_KEY;
  const originalServiceUrl = process.env.VISION_SERVICE_URL;
  let receivedHeaders: Headers | undefined;

  process.env.VISION_SERVICE_API_KEY = "shared-vision-secret";
  process.env.VISION_SERVICE_URL = "https://vision.internal";
  globalThis.fetch = async (_input, init) => {
    receivedHeaders = new Headers(init?.headers);
    return new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await new VisionServiceClient().analyzeBlueprint({
      imageUrl: "https://storage.example/image.jpg",
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.VISION_SERVICE_API_KEY;
    else process.env.VISION_SERVICE_API_KEY = originalApiKey;
    if (originalServiceUrl === undefined) delete process.env.VISION_SERVICE_URL;
    else process.env.VISION_SERVICE_URL = originalServiceUrl;
  }

  assert.equal(receivedHeaders?.get("X-Vision-Api-Key"), "shared-vision-secret");
});
