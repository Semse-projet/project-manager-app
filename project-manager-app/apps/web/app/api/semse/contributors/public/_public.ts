import { NextResponse, type NextRequest } from "next/server";
import { handleServerError, trustedClientHeaders, upstreamErrorResponse } from "../../_server";

/**
 * The contributor-program read endpoints are @Public in the API and the
 * /contributors page has no signed-in user, so they are called anonymously:
 * no Authorization, no server identity. Only the tenant header and the
 * BFF transport headers (bootstrap token + visitor IP), which put each
 * visitor in their own throttling bucket instead of the BFF's shared one.
 */
export async function fetchPublicContributorData(path: string, request: NextRequest): Promise<NextResponse> {
  const apiBase = (process.env.SEMSE_API_BASE_URL ?? "http://127.0.0.1:4000").replace(/\/+$/, "");
  try {
    const response = await fetch(`${apiBase}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: {
        ...trustedClientHeaders(request),
        "x-tenant-id": process.env.SEMSE_TENANT_ID ?? "tenant_default",
      },
    });
    if (!response.ok) return upstreamErrorResponse(response, path);
    const json = (await response.json()) as { data?: unknown };
    return NextResponse.json({ data: json.data ?? null });
  } catch (error) {
    return handleServerError(error);
  }
}
