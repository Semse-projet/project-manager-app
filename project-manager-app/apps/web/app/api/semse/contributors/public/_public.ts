import { NextResponse } from "next/server";
import { handleServerError, upstreamErrorResponse } from "../../_server";

/**
 * The contributor program's public endpoints are @Public on the API. These
 * routes have no signed-in user, so they must not act as the server's static
 * identity: they call the API with only the tenant header, like
 * public/worker-openings and stats/public, and relay its real status.
 */
export async function fetchPublicContributorData(path: string): Promise<NextResponse> {
  const apiBase = process.env.SEMSE_API_BASE_URL ?? "http://127.0.0.1:4000";
  try {
    const response = await fetch(`${apiBase}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: { "x-tenant-id": process.env.SEMSE_TENANT_ID ?? "tenant_default" },
    });
    if (!response.ok) return upstreamErrorResponse(response, path);
    const json = (await response.json()) as { data?: unknown };
    return NextResponse.json({ data: json.data ?? null });
  } catch (error) {
    return handleServerError(error);
  }
}
