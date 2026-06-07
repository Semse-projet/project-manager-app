import { test, expect } from "@playwright/test";

/**
 * Smoke tests for web push notification subscription endpoint.
 * Tests the BFF + API route chain: POST /api/semse/notifications/push-subscribe
 */

type ApiResult<T> = { data?: T; error?: { message?: string }; requestId?: string };

test.describe("Push Notifications — subscription smoke", () => {
  test.skip(!process.env.SEMSE_RUNTIME_ENABLED, "SEMSE runtime not enabled");

  test("POST /api/semse/notifications/push-subscribe returns 401 without auth", async ({ request, baseURL }) => {
    const res = await request.post(`${baseURL}/api/semse/notifications/push-subscribe`, {
      data: {
        endpoint: "https://example.com/push/test-endpoint",
        keys: { p256dh: "test-key", auth: "test-auth" },
      },
      headers: { "content-type": "application/json" },
      failOnStatusCode: false,
    });
    // Without auth cookie, must return 401 or 403
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/semse/notifications returns list shape", async ({ request, baseURL }) => {
    const res = await request.get(`${baseURL}/api/semse/notifications`, {
      failOnStatusCode: false,
    });
    // Either authenticated (200) or not (401/403) — both are valid
    expect([200, 401, 403]).toContain(res.status());
    if (res.status() === 200) {
      const json = (await res.json()) as ApiResult<{ items: unknown[]; unread: number }>;
      expect(json).toHaveProperty("data");
      expect(json.data).toHaveProperty("items");
      expect(json.data).toHaveProperty("unread");
    }
  });
});
