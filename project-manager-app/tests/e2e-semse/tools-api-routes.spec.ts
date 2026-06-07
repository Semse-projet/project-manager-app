import { test, expect } from "@playwright/test";
import { CONCRETE_PAYLOAD } from "./utils/test-data";
import { buildReport, writeEvidenceReport } from "./utils/evidence";

/**
 * Smoke tests for the Next.js API routes that proxy to the SEMSE backend.
 * Uses Playwright's request context — no browser UI needed.
 * These tests skip gracefully if SEMSE_RUNTIME_ENABLED is false (API not running).
 */

type ApiResult<T> = { data?: T; error?: { message?: string }; requestId?: string };

async function postRoute<T>(
  request: ReturnType<typeof test.info>["attachments"] extends never ? never : unknown,
  baseURL: string,
  path: string,
  body: unknown
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  // We cast request as any because we receive it via the test fixture
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (request as any).post(`${baseURL}${path}`, {
    data: body,
    headers: { "content-type": "application/json" },
    failOnStatusCode: false,
  });
  const json = (await res.json()) as ApiResult<T>;
  return { ok: res.ok(), status: res.status(), data: json.data as T, error: json.error?.message };
}

test.describe("Tools API Routes — smoke tests", () => {
  const ROUTES = [
    { name: "calculate", path: "/api/semse/tools/calculate", body: CONCRETE_PAYLOAD },
    { name: "quote", path: "/api/semse/tools/quote", body: { result: null } },
    { name: "milestones", path: "/api/semse/tools/milestones", body: { result: null } },
    { name: "escrow", path: "/api/semse/tools/escrow", body: { result: null } },
    { name: "change-order", path: "/api/semse/tools/change-order", body: { result: null, deltaPercent: 10 } },
    { name: "dispute-risk", path: "/api/semse/tools/dispute-risk", body: { result: null } },
  ];

  for (const route of ROUTES) {
    test(`POST ${route.path} responds (not 404/HTML)`, async ({ request, baseURL }) => {
      const startedAt = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (request as any).post(`${baseURL}${route.path}`, {
        data: route.body,
        headers: { "content-type": "application/json" },
        failOnStatusCode: false,
      });

      const status: number = res.status();
      const contentType: string = res.headers()["content-type"] ?? "";

      // Must return JSON (not HTML error page) and must not 404
      expect(status).not.toBe(404);
      expect(contentType).toContain("application/json");

      // 200 = runtime enabled + valid payload
      // 503/400/500 = runtime disabled or missing SEMSE API — acceptable in local dev
      // What we're testing is that the Next.js route EXISTS and returns JSON
      const json = await res.json().catch(() => null);
      expect(json).not.toBeNull();

      writeEvidenceReport(
        buildReport(
          `api-route-${route.name}`,
          status === 200 ? "passed" : status === 404 ? "failed" : "blocked",
          startedAt,
          baseURL ?? "",
          {
            errors: status >= 500 ? [`HTTP ${status} on ${route.path}`] : [],
            recommendedActions:
              status !== 200 && status !== 400
                ? ["Ensure SEMSE API is running on port 4000 and SEMSE_RUNTIME_ENABLED=true"]
                : [],
          }
        )
      );
    });
  }

  test("calculate route returns SemseToolResult shape with valid payload", async ({ request, baseURL }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (request as any).post(`${baseURL}/api/semse/tools/calculate`, {
      data: CONCRETE_PAYLOAD,
      headers: { "content-type": "application/json" },
      failOnStatusCode: false,
    });

    if (res.status() !== 200) {
      test.skip(true, `SEMSE runtime not available (HTTP ${res.status()})`);
      return;
    }

    const json = await res.json() as ApiResult<Record<string, unknown>>;
    const result = json.data;
    expect(result).toBeDefined();
    expect(result).toHaveProperty("toolId");
    expect(result).toHaveProperty("trade", "concrete");
    expect(result).toHaveProperty("costs");
    expect(result).toHaveProperty("risk");
    expect(result).toHaveProperty("milestones");
    expect(result).toHaveProperty("materials");
  });
});
