import { type NextRequest, NextResponse } from "next/server";
import {
  fetchSemseDataForAuthenticatedRequest,
  handleServerError,
  isApiBaseConfigured,
  runtimeDisabledResponse
} from "./_server";

/**
 * Thin BFF proxy for sensitive surfaces (liens, forge, satellites).
 *
 * Uses `fetchSemseDataForAuthenticatedRequest`, which never falls back to the
 * server's static OPS_ADMIN identity: a request without a signed session gets
 * a 401 instead of silently running as an operator. Path segments must be
 * encoded by the caller with `segment()`.
 */
export async function proxyAuthenticated(
  request: NextRequest,
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; status?: number } = {}
): Promise<NextResponse> {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  const method = options.method ?? "GET";
  try {
    const init: RequestInit = { method };
    if (method === "POST" || method === "PUT") {
      init.headers = { "content-type": "application/json" };
      init.body = JSON.stringify(options.body ?? {});
    }
    const data = await fetchSemseDataForAuthenticatedRequest<unknown>(path, request, init);
    return NextResponse.json({ data }, { status: options.status ?? 200 });
  } catch (error) {
    return handleServerError(error);
  }
}

/** Reads a JSON body without throwing on an empty/invalid payload. */
export async function readJsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  const body = (await request.json().catch(() => ({}))) as unknown;
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

export const segment = (value: string) => encodeURIComponent(value);
