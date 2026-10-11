import { NextResponse } from "next/server";
import { toPublicStats } from "../../../../../lib/public-stats";

export const dynamic = "force-dynamic";

/**
 * Public landing statistics. This route has no signed-in user, so it must not
 * act as the server's static identity: it calls the API's own @Public overview
 * endpoint with only the tenant header (same pattern as public/worker-openings)
 * and reports exactly what that endpoint returns. If the API is unavailable the
 * answer is an error, never made-up numbers.
 */
export async function GET() {
  try {
    const apiBase = process.env.SEMSE_API_BASE_URL ?? "http://127.0.0.1:4000";
    const response = await fetch(`${apiBase}/v1/intelligence/public/overview?limit=1`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: {
        "x-tenant-id": process.env.SEMSE_TENANT_ID ?? "tenant_default",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: { message: "Public statistics are temporarily unavailable." } },
        { status: 502 },
      );
    }

    const json = (await response.json()) as { data?: unknown };
    const data = toPublicStats(json.data);
    if (!data) {
      return NextResponse.json(
        { error: { message: "Public statistics are temporarily unavailable." } },
        { status: 502 },
      );
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: { message: "Service unavailable" } }, { status: 503 });
  }
}
