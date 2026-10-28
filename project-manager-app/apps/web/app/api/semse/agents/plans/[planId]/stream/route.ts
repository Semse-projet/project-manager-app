import { type NextRequest } from "next/server";
import { buildAuthorizedHeaders, getServerConfig, routeErrorResponse, upstreamErrorResponse } from "../../../../_server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ planId: string }> },
) {
  try {
    const { planId } = await context.params;
    const cfg = await getServerConfig(request);
    const headers = (await buildAuthorizedHeaders(cfg));

    const apiRes = await fetch(
      `${cfg.apiBaseUrl}/v1/sse/plans/${encodeURIComponent(planId)}`,
      { headers, signal: request.signal },
    );

    if (!apiRes.ok) {
      return upstreamErrorResponse(apiRes, `/v1/sse/plans/${encodeURIComponent(planId)}`);
    }
    if (!apiRes.body) {
      return routeErrorResponse(new Error("SEMSE API stream returned no body"));
    }

    return new Response(apiRes.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
